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
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { MONTHS_SHORT, MONTHS_TINY, POSTES, POSTE_LABELS, linePeriods, monthsRangeLabel, normalizeLine, periodMonths, yearMonths, type BillingLine, type BillingPoste, type SuggestedLine } from "@/components/billing/shared";

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";

interface Draft {
  label: string;
  poste: BillingPoste | "";
  count: number;
  periods: number[]; // paires [début, fin] en mois, longueur = 2 × count (toujours renseignées dans l'éditeur)
  percents: string[]; // saisie libre, longueur = count
  usePercents: boolean;
}

/** Paires début/fin d'un découpage égal depuis le début d'année contractuelle. */
function equalPairs(yearStart: number, count: number): number[] {
  return periodMonths(yearStart, count).flatMap((ms) => [ms[0], ms[ms.length - 1]]);
}

const emptyDraft = (yearStart: number): Draft => ({ label: "", poste: "", count: 4, periods: equalPairs(yearStart, 4), percents: ["", "", "", ""], usePercents: false });

function draftFrom(l: Pick<BillingLine, "label" | "poste" | "countPerYear" | "periods" | "percents">, yearStart: number): Draft {
  const n = l.countPerYear;
  return {
    label: l.label,
    poste: l.poste ?? "",
    count: n,
    periods: Array.isArray(l.periods) && l.periods.length === n * 2 ? [...l.periods] : equalPairs(yearStart, n),
    percents: l.percents.length === n ? l.percents.map(String) : Array(n).fill(""),
    usePercents: l.percents.length === n,
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

  const refreshAll = async () => {
    await mutate();
    // Le suivi de Finances lit la même donnée : on invalide ses clés
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
    if (!label) return;
    setSaving(true);
    try {
      const body = {
        label,
        poste: draft.poste || null,
        countPerYear: draft.count,
        // Découpage égal par défaut = on n'enregistre rien ; sinon les périodes saisies
        periods: draft.periods.join(",") === equalPairs(yearStart, draft.count).join(",") ? [] : draft.periods,
        percents: draft.usePercents && draft.percents.every((p) => p.trim() !== "") ? draft.percents.map((p) => Number(p)) : [],
      };
      if (editing === "new") await api.post(linesUrl, body);
      else await api.put(`${linesUrl}/${editing}`, body);
      toast.success(editing === "new" ? "Ligne ajoutée" : "Ligne enregistrée");
      setEditing(null);
      await refreshAll();
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
      await api.del(`${linesUrl}/${deleting.id}`);
      toast.success("Ligne supprimée");
      setDeleting(null);
      await refreshAll();
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
            <button type="button" onClick={() => startNew()} title="Ajouter une facture attendue" className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent">
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
              <div className="px-4 py-8 text-center text-sm text-ink/40">Aucune facture attendue.</div>
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-tech">Déjà utilisé sur vos autres marchés</span>
          {unusedSuggestions.slice(0, 8).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => startNew(s)}
              title={`${s.countPerYear} par an · utilisé sur ${s.uses} marché${s.uses > 1 ? "s" : ""}`}
              className="border border-ink/15 px-2.5 py-1 text-xs text-ink/70 transition-colors hover:border-accent hover:text-accent"
            >
              + {s.label}
            </button>
          ))}
        </div>
      )}

      {deleting && (
        <Modal
          title="Supprimer la ligne"
          subtitle={deleting.label}
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
  const title = periods.map((ms, i) => `${i + 1} : ${monthsRangeLabel(ms)}`).join(" · ");
  return (
    <div className="group grid items-center gap-4 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("w-9 flex-shrink-0 font-mono text-xs font-semibold", line.poste ? "text-ink" : "text-ink/30")}>
          {line.poste ? POSTE_LABELS[line.poste] : "—"}
        </span>
        <span className="truncate text-sm font-medium text-ink">{line.label}</span>
      </div>
      <span className="font-mono text-sm tabular-nums text-ink">
        {line.countPerYear} <span className="text-ink/50">par an</span>
      </span>
      {/* Année contractuelle, mois par mois : chaque période en bloc alterné */}
      <div className="flex gap-px" title={title}>
        {order.map((m) => {
          const pi = periodIndex.get(m);
          const isStart = pi !== undefined && periods[pi][0] === m;
          return (
            <span
              key={m}
              className={cn(
                "flex h-5 w-5 items-center justify-center font-mono text-[9px]",
                pi === undefined ? "bg-ink/[0.03] text-ink/20" : pi % 2 === 0 ? "bg-ink text-paper" : "bg-ink/[0.35] text-paper",
                isStart && "ml-0.5"
              )}
            >
              {MONTHS_TINY[m - 1]}
            </span>
          );
        })}
      </div>
      <span className="min-w-[80px] whitespace-nowrap font-mono text-xs tabular-nums text-ink/60" title={hasPct ? "Part de chaque facture" : "Parts non précisées"}>
        {hasPct ? `${line.percents.join(" · ")} %` : <span className="text-ink/25">—</span>}
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

  const setPeriod = (i: number, which: 0 | 1, month: number) => {
    const next = [...draft.periods];
    next[i * 2 + which] = month;
    setDraft({ ...draft, periods: next });
  };
  const isEqual = draft.periods.join(",") === equalPairs(yearStart, draft.count).join(",");

  const pctTotal = draft.percents.reduce((s, p) => s + (Number(p) || 0), 0);
  const pctOver = pctTotal > 100;
  const canSave = draft.label.trim() !== "" && !saving && !(draft.usePercents && pctOver);

  const matching = useMemo(() => {
    const q = draft.label.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 6);
    return suggestions.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 6);
  }, [draft.label, suggestions]);

  return (
    <div
      className="space-y-3 border-l-2 border-accent bg-accent/[0.03] px-4 py-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          if (canSave) onSave();
        }
      }}
    >
      {/* Libellé + poste + nombre */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label className="label-tech mb-1 block">Facture</label>
          <input
            ref={labelRef}
            type="text"
            value={draft.label}
            onChange={(e) => {
              const label = e.target.value;
              const guessed = guessPoste(label);
              setDraft({ ...draft, label, poste: guessed || (guessPoste(draft.label) ? "" : draft.poste) });
            }}
            placeholder="Ex : P1 chauffage acomptes, P3 GE, Intéressement…"
            className="h-9 w-full border border-ink/20 bg-white px-3 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="label-tech mb-1 block">Poste</label>
          <div className="flex">
            {POSTES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft({ ...draft, poste: draft.poste === p ? "" : p })}
                className={cn(
                  "h-9 border border-ink/20 px-2.5 font-mono text-xs transition-colors -ml-px first:ml-0",
                  draft.poste === p ? "bg-ink text-paper border-ink" : "bg-white text-ink/60 hover:text-ink"
                )}
              >
                {POSTE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label-tech mb-1 block">Par an</label>
          <div className="flex items-center">
            <button type="button" onClick={() => setCount(draft.count - 1)} disabled={draft.count <= 1} className="h-9 w-9 border border-ink/20 bg-white text-ink/60 hover:text-ink disabled:opacity-30">−</button>
            <input
              type="number"
              min={1}
              max={12}
              value={draft.count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
              className="h-9 w-14 border-y border-ink/20 bg-white text-center font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
            />
            <button type="button" onClick={() => setCount(draft.count + 1)} disabled={draft.count >= 12} className="h-9 w-9 border border-ink/20 bg-white text-ink/60 hover:text-ink disabled:opacity-30">+</button>
          </div>
        </div>
      </div>

      {/* Suggestions sous le libellé (vocabulaire des autres marchés) */}
      {isNew && matching.length > 0 && onPick && (
        <div className="flex flex-wrap items-center gap-1.5">
          {matching.map((s) => (
            <button key={s.label} type="button" onClick={() => onPick(s)} className="border border-ink/15 px-2 py-0.5 text-xs text-ink/60 hover:border-accent hover:text-accent">
              {s.label} <span className="font-mono text-ink/40">· {s.countPerYear}/an</span>
            </button>
          ))}
        </div>
      )}

      {/* Périodes couvertes : saisies ligne par ligne, découpage égal proposé */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <span className="label-tech">Périodes couvertes</span>
          {!isEqual && (
            <button type="button" onClick={() => setDraft({ ...draft, periods: equalPairs(yearStart, draft.count) })} className="text-xs text-ink/50 hover:text-accent">
              répartir également
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: draft.count }, (_, i) => (
            <span key={i} className="flex items-center border border-ink/20 bg-white">
              <span className="w-7 text-center font-mono text-[11px] text-ink/40">{i + 1}</span>
              <MonthSelect value={draft.periods[i * 2]} onChange={(m) => setPeriod(i, 0, m)} order={yearMonths(yearStart)} />
              <span className="px-1 text-xs text-ink/40">→</span>
              <MonthSelect value={draft.periods[i * 2 + 1]} onChange={(m) => setPeriod(i, 1, m)} order={yearMonths(yearStart)} />
            </span>
          ))}
        </div>
      </div>

      {/* Parts en % */}
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink/70">
          <input type="checkbox" checked={draft.usePercents} onChange={(e) => setDraft({ ...draft, usePercents: e.target.checked })} className="h-3.5 w-3.5 accent-ink" />
          Préciser la part de chaque facture en %
          <span className="text-ink/40">(ex. 30 · 30 · 30, le reste au décompte)</span>
        </label>
        {draft.usePercents && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {draft.percents.map((p, i) => (
              <span key={i} className="flex items-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p}
                  onChange={(e) => {
                    const next = [...draft.percents];
                    next[i] = e.target.value;
                    setDraft({ ...draft, percents: next });
                  }}
                  placeholder="—"
                  className="h-9 w-14 border border-ink/20 bg-white text-center font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                />
                <span className="ml-0.5 text-xs text-ink/40">%</span>
              </span>
            ))}
            <span className={cn("ml-2 font-mono text-sm tabular-nums", pctOver ? "text-red-700" : "text-ink/60")}>
              = {pctTotal} %{pctTotal < 100 && !pctOver && <span className="text-ink/40"> · reste {100 - pctTotal} %</span>}
            </span>
            {draft.count > 1 && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, percents: Array(draft.count).fill(String(Math.floor(100 / draft.count))) })}
                className="border border-ink/15 px-2 py-1 text-xs text-ink/60 hover:border-accent hover:text-accent"
              >
                parts égales
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={onSave} disabled={!canSave} className="flex h-9 items-center gap-2 bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isNew ? "Ajouter" : "Enregistrer"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-3 text-sm text-ink/60 hover:text-ink">Annuler</button>
      </div>
    </div>
  );
}

function MonthSelect({ value, onChange, order }: { value: number; onChange: (m: number) => void; order: number[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 cursor-pointer appearance-none bg-transparent px-2 font-mono text-xs text-ink focus:outline-none"
    >
      {order.map((m) => (
        <option key={m} value={m}>
          {MONTHS_SHORT[m - 1].replace(".", "")}
        </option>
      ))}
    </select>
  );
}
