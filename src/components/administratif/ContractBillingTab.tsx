"use client";

/**
 * Contrat › Facturation : les modalités de facturation du marché, valables
 * pour toute sa durée. Une ligne = « une facture, N fois par an », écrite
 * librement (P1 chauffage acomptes, P3 GE, Intéressement…), avec si on veut
 * les mois de chaque facture et leur part en %.
 * Le suivi saison par saison (reçu / en retard) est dans Finances.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Check, ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { MONTHS_SHORT, POSTES, POSTE_LABELS, lineName, linePeriods, monthsRangeLabel, normalizeLine, periodMonths, yearMonths, type BillingLine, type BillingPoste, type SuggestedLine } from "@/components/billing/shared";

/** Une couleur par poste, désaturée : reconnaissable sans lire. c = trait/texte, t = fond, k = bordure. */
const POSTE_COLORS: Record<string, { c: string; t: string; k: string }> = {
  P1: { c: "#b0501a", t: "#fcebde", k: "#eec5a6" },
  P2: { c: "#14708f", t: "#e1f0f5", k: "#b2d6e3" },
  P3: { c: "#4c771d", t: "#ebf3df", k: "#c3d9a6" },
  AUTRE: { c: "#5d646d", t: "#eef0f2", k: "#d0d5db" },
};
const colorsOf = (poste: BillingPoste | "" | null | undefined) => POSTE_COLORS[poste || "AUTRE"] ?? POSTE_COLORS.AUTRE;

/** Segments [col début, col fin] (1-12) d'une période sur une frise dont l'origine est `origin`. */
function segmentsOf(sm: number, em: number, origin: number): Array<[number, number]> {
  const a = ((sm - origin + 12) % 12) + 1;
  const len = ((em - sm + 12) % 12) + 1;
  const b = a + len - 1;
  return b <= 12 ? [[a, b]] : [[a, 12], [1, b - 12]];
}

/** Barres d'une ligne : positionnées en % sur 12 colonnes, « F1 · sept → nov », part en dessous. */
function Bars({ periods, percents, poste, origin, handles, onHandleDown }: {
  periods: number[][];
  percents: Array<number | string | null>;
  poste: BillingPoste | "" | null;
  origin: number;
  handles?: boolean;
  onHandleDown?: (e: React.PointerEvent, kind: "start" | "end", i: number) => void;
}) {
  const col = colorsOf(poste);
  return (
    <>
      <div className="relative h-11">
        {periods.map((ms, i) => {
          const segs = segmentsOf(ms[0], ms[ms.length - 1], origin);
          return segs.map(([a, b], k) => {
            const first = k === 0;
            const last = k === segs.length - 1;
            return (
              <div
                key={`${i}-${k}`}
                className="absolute inset-y-0 flex flex-col justify-center overflow-visible whitespace-nowrap px-2"
                style={{
                  left: `calc(${(a - 1) / 12 * 100}% + 2px)`,
                  width: `calc(${(b - a + 1) / 12 * 100}% - 4px)`,
                  background: col.t,
                  borderTop: `2px solid ${col.c}`,
                  borderLeft: first ? `1px solid ${col.k}` : "none",
                  borderRight: last ? `1px solid ${col.k}` : "none",
                  borderBottom: `1px solid ${col.k}`,
                }}
                title={`Facture ${i + 1} · ${monthsRangeLabel(ms)}`}
              >
                {first && (
                  <>
                    <span className="truncate font-mono text-[10px] leading-tight" style={{ color: col.c }}>F{i + 1}</span>
                    <span className="truncate text-xs leading-tight text-ink">{monthsRangeLabel(ms)}</span>
                  </>
                )}
                {handles && onHandleDown && i === 0 && first && (
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label="Début de la facture 1"
                    title="Décaler tout le cycle"
                    onPointerDown={(e) => onHandleDown(e, "start", 0)}
                    className="absolute inset-y-1 -left-1 z-10 w-2 cursor-ew-resize"
                    style={{ background: col.c, opacity: 0.6 }}
                  />
                )}
                {handles && onHandleDown && last && (
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label={`Fin de la facture ${i + 1}`}
                    title="Tirer : les factures suivantes suivent"
                    onPointerDown={(e) => onHandleDown(e, "end", i)}
                    className="absolute inset-y-1 -right-1 z-10 w-2 cursor-ew-resize"
                    style={{ background: col.c, opacity: 0.6 }}
                  />
                )}
              </div>
            );
          });
        })}
      </div>
      {/* Règle : 12 graduations */}
      <div
        className="mt-1 h-1.5 border-r border-ink/20"
        style={{ backgroundImage: "linear-gradient(rgba(15,30,51,.2),rgba(15,30,51,.2)), repeating-linear-gradient(to right, rgba(15,30,51,.2) 0 1px, transparent 1px calc(100% / 12))", backgroundSize: "100% 1px, 100% 100%", backgroundRepeat: "no-repeat, repeat" }}
      />
      {/* Parts sous chaque barre */}
      <div className="relative mt-1 h-4">
        {periods.map((ms, i) => {
          const [a] = segmentsOf(ms[0], ms[ms.length - 1], origin)[0];
          const v = percents[i];
          const has = v !== null && v !== undefined && String(v).trim() !== "";
          return (
            <span key={i} className={cn("absolute top-0 font-mono text-xs tabular-nums", has ? "text-ink" : "text-ink/25")} style={{ left: `calc(${(a - 1) / 12 * 100}% + 4px)` }}>
              {has ? `${v} %` : "—"}
            </span>
          );
        })}
      </div>
    </>
  );
}

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";

interface Draft {
  label: string;
  poste: BillingPoste | "";
  count: number;
  periods: number[]; // paires [début, fin] en mois, longueur = 2 × count (toujours renseignées dans l'éditeur)
  percents: string[]; // saisie libre, longueur = count ; toutes remplies = parts précisées
}

/** Paires début/fin d'un découpage égal depuis le début d'année contractuelle. */
function equalPairs(yearStart: number, count: number): number[] {
  return periodMonths(yearStart, count).flatMap((ms) => [ms[0], ms[ms.length - 1]]);
}

const emptyDraft = (yearStart: number): Draft => ({ label: "", poste: "", count: 4, periods: equalPairs(yearStart, 4), percents: ["", "", "", ""] });

function draftFrom(l: Pick<BillingLine, "label" | "poste" | "countPerYear" | "periods" | "percents">, yearStart: number): Draft {
  const n = l.countPerYear;
  return {
    label: l.label,
    poste: l.poste ?? "",
    count: n,
    periods: Array.isArray(l.periods) && l.periods.length === n * 2 ? [...l.periods] : equalPairs(yearStart, n),
    percents: l.percents.length === n ? l.percents.map(String) : Array(n).fill(""),
  };
}

/** Poste deviné d'après le début du libellé (P1 …, P2 …, P3 …). */
function guessPoste(label: string): BillingPoste | "" {
  const m = label.trim().toUpperCase().match(/^P([123])\b/);
  return m ? (`P${m[1]}` as BillingPoste) : "";
}

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const toast = useToast();
  const { canEdit } = usePermissions();
  const linesUrl = `/api/contracts/${contractId}/billing-lines`;
  const { data, isLoading, mutate } = useSWR<BillingLine[]>(linesUrl, fetcher);
  const { data: sugg } = useSWR<{ suggestions: SuggestedLine[] }>(`${linesUrl}/suggest`, fetcher);
  // Début de l'année contractuelle (ex. 7 = juillet) : les périodes des acomptes en découlent
  const { data: contract } = useSWR<{ yearType?: string; yearStartMonth?: number; startDate?: string | null }>(`/api/contracts/${contractId}`, fetcher);
  // Même règle que le moteur côté serveur (contractSeasons) :
  // année civile → janvier ; année contractuelle → mois de la date de début ; saison de chauffe → mois de début de saison
  const contractYearStart = (() => {
    if (contract?.yearType === "CIVIL") return 1;
    if (contract?.yearType === "CONTRACTUAL" && contract.startDate) {
      const m = new Date(contract.startDate).getMonth() + 1;
      if (m >= 1 && m <= 12) return m;
    }
    return typeof contract?.yearStartMonth === "number" ? contract.yearStartMonth : 7;
  })();
  // Cache SWR possiblement d'une version précédente : on normalise chaque ligne
  const lines = useMemo(() => (Array.isArray(data) ? data.filter((l) => l && typeof l.id === "string").map(normalizeLine) : []), [data]);
  const totalPerYear = lines.reduce((n, l) => n + l.countPerYear, 0);
  // La frise démarre au premier mois facturé : la première période saisie
  // (sur la première ligne qui en a), sinon le début d'année du contrat.
  // Ainsi aucune période n'est coupée en deux bouts à l'écran.
  const yearStart = (() => {
    const first = lines.find((l) => Array.isArray(l.periods) && l.periods.length === l.countPerYear * 2);
    const m = first?.periods[0];
    return typeof m === "number" && m >= 1 && m <= 12 ? m : contractYearStart;
  })();
  const suggestions = useMemo(
    () => (Array.isArray(sugg?.suggestions) ? sugg.suggestions.filter((s) => s && typeof s.label === "string").map((s) => ({ ...s, periods: Array.isArray(s.periods) ? s.periods : [], percents: Array.isArray(s.percents) ? s.percents : [] })) : []),
    [sugg]
  );

  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(7));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BillingLine | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Met la liste à jour à l'écran tout de suite (la relecture serveur peut
   * prendre quelques secondes), puis relit, et invalide le suivi de Finances
   * qui lit la même donnée.
   */
  const refreshAll = async (optimistic?: (current: BillingLine[]) => BillingLine[]) => {
    if (optimistic) {
      await mutate((current) => optimistic(Array.isArray(current) ? current : []), { revalidate: true });
    } else {
      await mutate();
    }
    const { mutate: g } = await import("swr");
    await g((key) => typeof key === "string" && key.startsWith(`/api/contracts/${contractId}/billing-schedule`), undefined, { revalidate: true });
  };

  const startNew = (from?: SuggestedLine) => {
    setDraft(from ? draftFrom(from, yearStart) : emptyDraft(yearStart));
    setEditing("new");
  };
  const startEdit = (l: BillingLine) => {
    setDraft(draftFrom(l, yearStart));
    setEditing(l.id);
  };
  const cancel = () => setEditing(null);

  const save = async () => {
    const label = draft.label.trim();
    if (!label && !draft.poste) return;
    setSaving(true);
    try {
      const body = {
        label,
        poste: draft.poste || null,
        countPerYear: draft.count,
        // Toujours explicites : une ligne ne doit jamais dépendre du point de départ de la frise
        periods: draft.periods,
        percents: draft.percents.every((p) => p.trim() !== "") ? draft.percents.map((p) => Number(p)) : [],
      };
      const saved = editing === "new"
        ? await api.post<BillingLine>(linesUrl, body)
        : await api.put<BillingLine>(`${linesUrl}/${editing}`, body);
      const wasNew = editing === "new";
      setEditing(null);
      toast.success(wasNew ? "Ligne ajoutée" : "Ligne enregistrée");
      await refreshAll((current) => (wasNew ? [...current, saved] : current.map((l) => (l.id === saved.id ? saved : l))));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const id = deleting.id;
      await api.del(`${linesUrl}/${id}`);
      setDeleting(null);
      toast.success("Ligne supprimée");
      await refreshAll((current) => current.filter((l) => l.id !== id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Suggestions : vocabulaire de l'organisation, hors libellés déjà présents ici
  const unusedSuggestions = useMemo(() => {
    const have = new Set(lines.map((l) => l.label.trim().toLowerCase()));
    return suggestions.filter((s) => !have.has(s.label.trim().toLowerCase()));
  }, [lines, suggestions]);

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">
          <span className="label-tech">
            Modalités de facturation du marché
          </span>
          {canEdit && (
            <button type="button" onClick={() => startNew()} title="Ajouter une modalité de facturation" className="flex h-9 w-9 items-center justify-center border border-ink/15 text-ink/55 transition-colors hover:border-accent hover:text-accent">
              <Plus size={16} />
            </button>
          )}
        </div>

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-ink/30" />
          </div>
        ) : (
          <div className="divide-y divide-ink/10">
            {lines.length === 0 && (
              <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
                <p className="max-w-md text-sm text-ink/60">Définissez comment l&apos;exploitant facture ce marché : quelles factures, combien de fois par an, sur quelles périodes.</p>
                {canEdit && (
                  <button type="button" onClick={() => startNew()} className="flex h-9 items-center gap-2 border border-accent px-4 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-paper">
                    <Plus size={14} />
                    Définir une première facture
                  </button>
                )}
              </div>
            )}

            {lines.map((l) => (
              <LineRow key={l.id} line={l} contractYearStart={contractYearStart} canEdit={canEdit} onEdit={() => startEdit(l)} onDelete={() => setDeleting(l)} />
            ))}

            {lines.length > 0 && (
              <div className="px-5 py-2.5">
                <span className="label-tech">
                  <span className="tabular-nums">{totalPerYear}</span> facture{totalPerYear > 1 ? "s" : ""} par an
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="label-tech mr-1">Déjà utilisé sur vos autres marchés</span>
          {unusedSuggestions.slice(0, 8).map((s) => (
            <button
              key={s.label || s.poste || ""}
              type="button"
              onClick={() => startNew(s)}
              title={`${s.countPerYear} par an · utilisé sur ${s.uses} marché${s.uses > 1 ? "s" : ""}`}
              className="border border-ink/10 bg-white px-2.5 py-1 text-xs text-ink/65 transition-colors hover:border-accent hover:text-accent"
            >
              <span className="text-ink/35">+</span> {lineName(s)}
            </button>
          ))}
        </div>
      )}

      {editing !== null && (
        <Modal
          title={editing === "new" ? "Nouvelle modalité de facturation" : "Modifier la modalité"}
          size="lg"
          onClose={cancel}
        >
          <LineEditor
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={cancel}
            saving={saving}
            isNew={editing === "new"}
            yearStart={yearStart}
            suggestions={editing === "new" ? unusedSuggestions : []}
            onPick={(s) => setDraft(draftFrom(s, yearStart))}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="Supprimer la ligne"
          subtitle={lineName(deleting)}
          size="sm"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>Annuler</Button>
              <Button size="sm" onClick={remove} disabled={busy} className="bg-red-700 hover:bg-red-800">
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">La ligne sera supprimée.</p>
        </Modal>
      )}
    </div>
  );
}

// ─── Ligne affichée ─────────────────────────────────────────────────────────

function LineRow({ line, contractYearStart, canEdit, onEdit, onDelete }: { line: BillingLine; contractYearStart: number; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const periods = linePeriods(line, contractYearStart);
  const origin = periods[0]?.[0] ?? contractYearStart;
  const hasPct = line.percents.length === line.countPerYear;
  const sum = hasPct ? line.percents.reduce((a, b) => a + b, 0) : null;
  const col = colorsOf(line.poste);
  const n = line.countPerYear;
  const order = yearMonths(origin);
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-ink/[0.015] lg:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_5rem_4.5rem] lg:gap-x-7">
      {/* Souche */}
      <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-3">
        <span className="flex h-[22px] min-w-[38px] flex-shrink-0 items-center justify-center px-1.5 font-mono text-[11px]" style={line.poste ? { color: col.c, background: col.t, border: `1px solid ${col.k}` } : { color: "rgba(15,30,51,.35)", border: "1px dashed rgba(15,30,51,.25)" }}>
          {line.poste ? POSTE_LABELS[line.poste] : "—"}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{lineName(line)}</div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-ink/50">{n} facture{n > 1 ? "s" : ""} / an</div>
        </div>
      </div>
      {/* Frise propre à la ligne */}
      <div className="col-span-3 col-start-1 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <Bars periods={periods} percents={line.percents} poste={line.poste} origin={origin} />
        <div className="mt-1 grid grid-cols-12 font-mono text-[9px] uppercase text-ink/35">
          {order.map((m) => <span key={m} className="truncate pl-0.5">{MONTHS_SHORT[m - 1].replace(".", "")}</span>)}
        </div>
      </div>
      {/* Somme des parts */}
      <div className="col-start-2 row-start-1 flex flex-col items-end gap-1.5 lg:col-start-3">
        <span className={cn("font-mono text-sm tabular-nums", sum === null ? "text-ink/25" : sum > 100 ? "text-red-700" : "text-ink")}>{sum === null ? "—" : `Σ ${sum} %`}</span>
        <span className="relative h-[3px] w-14 overflow-hidden bg-ink/10"><span className="absolute inset-y-0 left-0" style={{ width: `${Math.min(sum ?? 0, 100)}%`, background: col.c }} /></span>
      </div>
      <div className={cn("col-start-3 row-start-1 flex items-center justify-end lg:col-start-4", !canEdit && "invisible")}>
        <button type="button" onClick={onEdit} title="Modifier" className={iconBtn}><Pencil size={14} /></button>
        <button type="button" onClick={onDelete} title="Supprimer" className={cn(iconBtn, "hover:text-red-600")}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ─── Éditeur ────────────────────────────────────────────────────────────────

function LineEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  isNew,
  yearStart,
  suggestions = [],
  onPick,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
  yearStart: number;
  suggestions?: SuggestedLine[];
  onPick?: (s: SuggestedLine) => void;
}) {

  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    labelRef.current?.focus();
  }, []);

  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(12, n));
    setDraft({
      ...draft,
      count,
      periods: equalPairs(yearStart, count),
      percents: Array.from({ length: count }, (_, i) => draft.percents[i] ?? ""),
    });
  };

  /** Mois suivant / précédent sur le cycle 1-12. */
  const nextM = (m: number) => (m % 12) + 1;
  const prevM = (m: number) => ((m + 10) % 12) + 1;
  /** Longueur d'une période [s, e] en mois (1-12). */
  const lengthOf = (sm: number, em: number) => ((em - sm + 12) % 12) + 1;

  /**
   * Modifier une borne fait suivre le reste : la période suivante démarre le
   * mois d'après, chacune garde sa longueur, la dernière se referme avant la
   * première. Modifier le début d'une période recule la fin de la précédente.
   */
  const setPeriod = (i: number, which: 0 | 1, month: number) => {
    const n = draft.count;
    const pr = [...draft.periods];
    const lens = Array.from({ length: n }, (_, k) => lengthOf(pr[k * 2], pr[k * 2 + 1]));
    if (which === 0) {
      if (i === 0) {
        // Début de la première : tout le découpage se décale
        let sm = month;
        for (let k = 0; k < n; k++) {
          pr[k * 2] = sm;
          pr[k * 2 + 1] = ((sm + lens[k] - 2) % 12) + 1;
          sm = nextM(pr[k * 2 + 1]);
        }
      } else {
        pr[i * 2] = month;
        pr[(i - 1) * 2 + 1] = prevM(month);
        pr[i * 2 + 1] = ((month + lens[i] - 2) % 12) + 1;
      }
    } else {
      pr[i * 2 + 1] = month;
    }
    // Cascade vers l'avant depuis la période modifiée
    for (let k = i + 1; k < n; k++) {
      pr[k * 2] = nextM(pr[(k - 1) * 2 + 1]);
      pr[k * 2 + 1] = ((pr[k * 2] + lens[k] - 2) % 12) + 1;
    }
    // La dernière se referme juste avant la première (année complète)
    if (n > 1) pr[(n - 1) * 2 + 1] = prevM(pr[0]);
    setDraft({ ...draft, periods: pr });
  };
  const isEqual = draft.periods.join(",") === equalPairs(yearStart, draft.count).join(",");

  const pctTotal = draft.percents.reduce((s, p) => s + (Number(p) || 0), 0);
  const pctOver = pctTotal > 100;
  const pctAny = draft.percents.some((p) => p.trim() !== "");
  const canSave = (draft.label.trim() !== "" || draft.poste !== "") && !saving && !pctOver;

  const matching = useMemo(() => {
    const q = draft.label.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 6);
  }, [draft.label, suggestions]);

  return (
    <div
      className="bg-ink/[0.02] px-4 py-4 md:px-5"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
          e.preventDefault();
          if (canSave) onSave();
        }
      }}
    >
      <div className="space-y-5">
        {/* Libellé + poste + nombre */}
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <div className="min-w-0">
            <label className="label-tech mb-1.5 block">Facture</label>
            <input
              ref={labelRef}
              type="text"
              value={draft.label}
              onChange={(e) => {
                const label = e.target.value;
                const guessed = guessPoste(label);
                setDraft({ ...draft, label, poste: guessed || (guessPoste(draft.label) ? "" : draft.poste) });
              }}
              placeholder="Intitulé (facultatif) : P1 chauffage, P3 GE, Intéressement…"
              className="h-9 w-full border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="label-tech mb-1.5 block">Poste</label>
            <div className="inline-flex border border-ink/15">
              {POSTES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft({ ...draft, poste: draft.poste === p ? "" : p })}
                  className={cn(
                    "h-[34px] min-w-[2.75rem] border-l border-ink/10 px-2.5 font-mono text-xs transition-colors first:border-l-0",
                    draft.poste === p ? "bg-accent/[0.08] text-accent font-medium" : "text-ink/55 hover:bg-ink/[0.03] hover:text-ink"
                  )}
                >
                  {POSTE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-tech mb-1.5 block">Par an</label>
            <div className="inline-flex border border-ink/15">
              <button type="button" onClick={() => setCount(draft.count - 1)} disabled={draft.count <= 1} title="Une de moins" className="h-[34px] w-9 text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:opacity-30">−</button>
              <input
                type="number"
                min={1}
                max={12}
                value={draft.count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="h-[34px] w-12 border-x border-ink/10 bg-white text-center font-mono text-sm tabular-nums text-ink [appearance:textfield] focus:bg-accent/[0.04] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setCount(draft.count + 1)} disabled={draft.count >= 12} title="Une de plus" className="h-[34px] w-9 text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:opacity-30">+</button>
            </div>
          </div>
        </div>

        {/* Suggestions sous le libellé (vocabulaire des autres marchés) */}
        {isNew && matching.length > 0 && onPick && (
          <div className="-mt-2 flex flex-wrap items-center gap-1.5">
            {matching.map((s) => (
              <button key={s.label || s.poste || ""} type="button" onClick={() => onPick(s)} className="border border-ink/10 px-2 py-1 text-xs text-ink/60 transition-colors hover:border-accent hover:text-accent">
                {s.label} <span className="font-mono text-ink/35">· {s.countPerYear}/an</span>
              </button>
            ))}
          </div>
        )}

        {/* Frise : tirer un bord, les factures suivantes suivent ; la poignée de gauche décale tout */}
        <Timeline draft={draft} setDraft={setDraft} />

        {/* Une ligne par facture : période couverte, part en % */}
        <div className="max-w-xl">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem] items-center border-b border-ink/15 pb-1.5">
            <span className="label-tech">#</span>
            <span className="flex items-center gap-3">
              <span className="label-tech">Période</span>
              {!isEqual && (
                <button type="button" onClick={() => setDraft({ ...draft, periods: equalPairs(yearStart, draft.count) })} className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent">
                  répartir également
                </button>
              )}
            </span>
            <span className="label-tech text-right">Part</span>
          </div>
          <div className="divide-y divide-ink/[0.07]">
            {Array.from({ length: draft.count }, (_, i) => (
              <div key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem] items-center py-1">
                <span className="font-mono text-xs tabular-nums text-ink/35">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex items-center gap-2">
                  <MonthSelect value={draft.periods[i * 2]} onChange={(m) => setPeriod(i, 0, m)} order={yearMonths(yearStart)} />
                  <span className="text-xs text-ink/30">→</span>
                  <MonthSelect value={draft.periods[i * 2 + 1]} onChange={(m) => setPeriod(i, 1, m)} order={yearMonths(yearStart)} />
                </span>
                <span className="flex items-center justify-end gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.percents[i] ?? ""}
                    onChange={(e) => {
                      const next = [...draft.percents];
                      next[i] = e.target.value;
                      setDraft({ ...draft, percents: next });
                    }}
                    placeholder="—"
                    title="Part de cette facture en % (facultatif)"
                    className="h-8 w-14 border-b border-ink/15 bg-transparent px-1 text-right font-mono text-sm tabular-nums text-ink [appearance:textfield] placeholder:text-ink/25 focus:border-accent focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="w-3 font-mono text-xs text-ink/35">%</span>
                </span>
              </div>
            ))}
          </div>
          {pctAny && (
            <div className="flex items-center justify-end gap-4 border-t border-ink/15 pt-2">
              {draft.count > 1 && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, percents: Array(draft.count).fill(String(Math.floor(100 / draft.count))) })}
                  className="text-xs text-ink/45 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                >
                  parts égales
                </button>
              )}
              <span className={cn("font-mono text-sm tabular-nums", pctOver ? "text-red-700" : "text-ink")}>
                = {pctTotal} %{pctTotal < 100 && !pctOver && <span className="text-ink/40"> · reste {100 - pctTotal} %</span>}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-ink/10 pt-4">
          <button type="button" onClick={onSave} disabled={!canSave} className="flex h-9 items-center gap-2 border border-accent px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/[0.06] disabled:pointer-events-none disabled:border-ink/15 disabled:text-ink/30">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isNew ? "Ajouter" : "Enregistrer"}
          </button>
          <button type="button" onClick={onCancel} className="h-9 px-3 text-sm text-ink/50 transition-colors hover:text-ink">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function MonthSelect({ value, onChange, order }: { value: number; onChange: (m: number) => void; order: number[] }) {
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-[4.5rem] cursor-pointer appearance-none border-b border-ink/15 bg-transparent pl-1 pr-5 font-mono text-xs text-ink transition-colors hover:border-ink/40 focus:border-accent focus:outline-none"
      >
        {order.map((m) => (
          <option key={m} value={m}>
            {MONTHS_SHORT[m - 1].replace(".", "")}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ink/35" />
    </span>
  );
}

/** Frise d'édition : les barres de la ligne avec des poignées. */
function Timeline({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "start" | "end"; i: number; x0: number; periods: number[]; last: number } | null>(null);
  const n = draft.count;
  const periods = Array.from({ length: n }, (_, i) => {
    const sm = draft.periods[i * 2];
    const em = draft.periods[i * 2 + 1];
    const ms: number[] = [];
    let m = sm;
    for (let k = 0; k < 12; k++) { ms.push(m); if (m === em) break; m = (m % 12) + 1; }
    return ms;
  });
  const origin = draft.periods[0] ?? 1;
  const order = yearMonths(origin);
  const mo = (x: number) => ((x % 12) + 12) % 12 + 1;

  /** Décale d'un nombre de mois : la fin de la facture i (et tout ce qui suit), ou tout le cycle. */
  const shifted = (base: number[], kind: "start" | "end", i: number, d: number): number[] | null => {
    const pr = [...base];
    const len = (k: number) => ((pr[k * 2 + 1] - pr[k * 2] + 12) % 12) + 1;
    if (kind === "start") {
      for (let k = 0; k < n; k++) { pr[k * 2] = mo(pr[k * 2] - 1 + d); pr[k * 2 + 1] = mo(pr[k * 2 + 1] - 1 + d); }
      return pr;
    }
    if (len(i) + d < 1) return null;
    // Espace total occupé depuis le début de la 1re jusqu'à la fin de la dernière, bornes incluses
    const span = ((pr[(n - 1) * 2 + 1] - pr[0] + 12) % 12) + 1;
    if (span + d > 12) return null;
    pr[i * 2 + 1] = mo(pr[i * 2 + 1] - 1 + d);
    for (let k = i + 1; k < n; k++) { pr[k * 2] = mo(pr[k * 2] - 1 + d); pr[k * 2 + 1] = mo(pr[k * 2 + 1] - 1 + d); }
    return pr;
  };

  const onDown = (e: React.PointerEvent, kind: "start" | "end", i: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, i, x0: e.clientX, periods: [...draft.periods], last: 0 };
  };
  const onMove = (e: React.PointerEvent) => {
    const d0 = drag.current;
    if (!d0 || !ref.current) return;
    const mw = ref.current.getBoundingClientRect().width / 12;
    const d = Math.round((e.clientX - d0.x0) / mw);
    if (d === d0.last) return;
    const next = shifted(d0.periods, d0.kind, d0.i, d);
    if (!next) return;
    d0.last = d;
    setDraft({ ...draft, periods: next });
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute("role") !== "slider") return;
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const kind = t.getAttribute("aria-label")?.startsWith("Début") ? "start" : "end";
    const i = kind === "start" ? 0 : Number((t.getAttribute("aria-label") ?? "").replace(/\D/g, "")) - 1;
    const next = shifted(draft.periods, kind, i, dir);
    if (next) setDraft({ ...draft, periods: next });
  };

  return (
    <div ref={ref} className="select-none border border-ink/10 bg-ink/[0.02] px-3 pb-2 pt-3" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
      <Bars periods={periods} percents={draft.percents} poste={draft.poste} origin={origin} handles onHandleDown={onDown} />
      <div className="mt-1 grid grid-cols-12 font-mono text-[10px] uppercase text-ink/40">
        {order.map((m) => <span key={m} className="truncate pl-0.5">{MONTHS_SHORT[m - 1].replace(".", "")}</span>)}
      </div>
    </div>
  );
}
