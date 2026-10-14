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
import { MONTHS_SHORT, MONTHS_TINY, POSTES, POSTE_LABELS, lineName, linePeriods, monthsRangeLabel, normalizeLine, periodMonths, yearMonths, type BillingLine, type BillingPoste, type SuggestedLine } from "@/components/billing/shared";

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
  const { data: contract } = useSWR<{ yearStartMonth?: number }>(`/api/contracts/${contractId}`, fetcher);
  const yearStart = typeof contract?.yearStartMonth === "number" ? contract.yearStartMonth : 7;
  // Cache SWR possiblement d'une version précédente : on normalise chaque ligne
  const lines = useMemo(() => (Array.isArray(data) ? data.filter((l) => l && typeof l.id === "string").map(normalizeLine) : []), [data]);
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
        // Découpage égal par défaut = on n'enregistre rien ; sinon les périodes saisies
        periods: draft.periods.join(",") === equalPairs(yearStart, draft.count).join(",") ? [] : draft.periods,
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
            Factures attendues <span className="tabular-nums">({lines.length})</span>
          </span>
          {canEdit && editing === null && (
            <button type="button" onClick={() => startNew()} title="Ajouter une facture attendue" className="flex h-9 w-9 items-center justify-center border border-ink/15 text-ink/55 transition-colors hover:border-accent hover:text-accent">
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
            {lines.length === 0 && editing !== "new" && (
              <div className="px-5 py-12 text-center text-sm text-ink/40">Aucune facture attendue.</div>
            )}

            {lines.map((l) =>
              editing === l.id ? (
                <LineEditor key={l.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} isNew={false} yearStart={yearStart} />
              ) : (
                <LineRow key={l.id} line={l} yearStart={yearStart} canEdit={canEdit} onEdit={() => startEdit(l)} onDelete={() => setDeleting(l)} />
              )
            )}

            {editing === "new" && (
              <LineEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} isNew yearStart={yearStart} suggestions={unusedSuggestions} onPick={(s) => setDraft(draftFrom(s, yearStart))} />
            )}
          </div>
        )}
      </div>

      {canEdit && editing === null && unusedSuggestions.length > 0 && (
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

function LineRow({ line, yearStart, canEdit, onEdit, onDelete }: { line: BillingLine; yearStart: number; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const hasPct = line.percents.length === line.countPerYear;
  const order = yearMonths(yearStart);
  const periods = linePeriods(line, yearStart);
  const periodIndex = new Map<number, number>();
  periods.forEach((ms, i) => ms.forEach((m) => { if (!periodIndex.has(m)) periodIndex.set(m, i); }));
  // Le poste n'est rappelé que s'il n'ouvre pas déjà le libellé (« P2 acomptes » suffit)
  const showPoste = !!line.poste && !!line.label.trim() && !line.label.trim().toUpperCase().startsWith(line.poste);
  return (
    <div className="group grid items-center gap-x-8 gap-y-2 px-5 py-4 transition-colors hover:bg-ink/[0.015] md:grid-cols-[minmax(0,1fr)_6rem_auto_10rem_4.5rem] md:py-3.5">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <span className="truncate text-sm font-medium text-ink">{lineName(line)}</span>
        {showPoste && <span className="font-mono text-[11px] tracking-wider text-ink/40">{POSTE_LABELS[line.poste as BillingPoste]}</span>}
      </div>
      <span className="whitespace-nowrap font-mono text-sm tabular-nums text-ink">
        {line.countPerYear} <span className="text-xs text-ink/40">par an</span>
      </span>
      {/* Frise de l'année contractuelle : un trait d'accent par période (deux intensités alternées), filet fin entre périodes */}
      <div className="flex" title={periods.map((ms, i) => `${i + 1} : ${monthsRangeLabel(ms)}`).join(" · ")}>
        {order.map((m, idx) => {
          const pi = periodIndex.get(m);
          const isStart = pi !== undefined && periods[pi][0] === m;
          return (
            <span
              key={m}
              className={cn(
                "flex h-7 w-6 items-center justify-center border-b-2 font-mono text-[10px]",
                pi === undefined
                  ? "border-ink/10 text-ink/20"
                  : pi % 2 === 0
                    ? "border-accent bg-accent/[0.04] text-ink/55"
                    : "border-accent/35 text-ink/55",
                isStart && idx > 0 && "border-l border-l-ink/15"
              )}
            >
              {MONTHS_TINY[m - 1]}
            </span>
          );
        })}
      </div>
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-ink/60 md:text-right" title={hasPct ? "Part de chaque facture" : "Parts non précisées"}>
        {hasPct ? (
          <>
            {line.percents.join(" · ")} <span className="text-ink/35">%</span>
          </>
        ) : (
          <span className="text-ink/25">—</span>
        )}
      </span>
      <div className={cn("flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100", !canEdit && "invisible")}>
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
      <div className="space-y-5 border border-ink/10 border-l-2 border-l-accent bg-paper p-4 md:p-5">
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
