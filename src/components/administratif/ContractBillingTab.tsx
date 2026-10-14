"use client";

/**
 * Contrat › Facturation : les modalités de facturation du contrat, valables
 * pour toute sa durée. Une ligne par flux (« P1 Énergie — 4 acomptes par an —
 * 30 · 30 · 20 · 20 % »). Le suivi de saison vit dans Finances.
 */

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";

type Poste = "P1" | "P2" | "P3" | "INTERESSEMENT" | "AUTRE";
type Nature = "ACOMPTE_FORFAIT" | "REEL" | "DECOMPTE";
type Rhythm = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
type Count = 1 | 2 | 4 | 12;

interface Line {
  id: string;
  poste: Poste;
  nature: Nature;
  rhythm: Rhythm;
  expectedMonth: number | null;
  label?: string | null;
  splitPercents?: number[] | null;
}
type LineData = Omit<Line, "id">;
interface Suggestion extends Omit<LineData, "splitPercents"> {
  reason: string;
}

const COUNT_OF: Record<Rhythm, Count> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };
const RHYTHM_OF: Record<Count, Rhythm> = { 12: "MENSUEL", 4: "TRIMESTRIEL", 2: "SEMESTRIEL", 1: "ANNUEL" };
const COUNTS: Count[] = [1, 2, 4, 12];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const POSTE_ORDER: Poste[] = ["P1", "P2", "P3", "INTERESSEMENT", "AUTRE"];
const NATURE_ORDER: Nature[] = ["ACOMPTE_FORFAIT", "REEL", "DECOMPTE"];

const WHAT: { value: Poste; label: string }[] = [
  { value: "P1", label: "P1 Énergie" },
  { value: "P2", label: "P2 Conduite / maintenance" },
  { value: "P3", label: "P3 Garantie totale" },
  { value: "INTERESSEMENT", label: "Intéressement" },
  { value: "AUTRE", label: "Autre" },
];
const P1_MODES: { value: Nature; label: string }[] = [
  { value: "ACOMPTE_FORFAIT", label: "Acomptes forfaitaires" },
  { value: "REEL", label: "Au réel (consommation)" },
  { value: "DECOMPTE", label: "Décompte de fin d'année" },
];

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/45 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";
const chip = (on: boolean) =>
  cn(
    "border px-3 text-sm transition-colors",
    on ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white text-ink/70 hover:border-accent hover:text-accent"
  );
const SEGMENT_TONES = ["bg-ink/80", "bg-ink/55", "bg-ink/35", "bg-ink/20"];

// ─── Lecture ────────────────────────────────────────────────────────────────

function whatLabel(l: Pick<Line, "poste" | "nature" | "label">): { code: string; text: string } {
  if (l.poste === "P1") return { code: "P1", text: l.nature === "DECOMPTE" ? "Décompte de fin d'année" : "Énergie" };
  if (l.poste === "P2") return { code: "P2", text: "Conduite / maintenance" };
  if (l.poste === "P3") return { code: "P3", text: "Garantie totale" };
  if (l.poste === "INTERESSEMENT") return { code: "", text: "Intéressement" };
  return { code: "", text: l.label?.trim() || "Autre" };
}

function cadence(l: Pick<Line, "nature" | "rhythm" | "expectedMonth">): string {
  const n = COUNT_OF[l.rhythm] ?? 1;
  if (n === 1) {
    const m = l.expectedMonth && l.expectedMonth >= 1 && l.expectedMonth <= 12 ? MONTHS[l.expectedMonth - 1] : null;
    return m ? `1 facture, en ${m}` : "1 facture par an";
  }
  if (l.nature === "REEL") return `${n} factures par an, au réel`;
  if (l.nature === "ACOMPTE_FORFAIT") return `${n} acomptes par an`;
  return `${n} factures par an`;
}

function split(l: Pick<Line, "rhythm" | "splitPercents">): string | null {
  const n = COUNT_OF[l.rhythm] ?? 1;
  if (n === 1 || n === 12) return null;
  const s = Array.isArray(l.splitPercents) ? l.splitPercents : [];
  return s.length === n ? `${s.join(" · ")} %` : "";
}

function sortLines<T extends Pick<Line, "poste" | "nature">>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) =>
      POSTE_ORDER.indexOf(a.poste) - POSTE_ORDER.indexOf(b.poste) ||
      NATURE_ORDER.indexOf(a.nature) - NATURE_ORDER.indexOf(b.nature)
  );
}

function LineText({ line }: { line: Pick<Line, "poste" | "nature" | "rhythm" | "expectedMonth" | "label" | "splitPercents"> }) {
  const w = whatLabel(line);
  const s = split(line);
  return (
    <div className="grid min-w-0 flex-1 grid-cols-[2.25rem_1fr] items-baseline gap-x-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_13rem_11rem]">
      <span className="font-mono text-xs font-medium text-ink/60">{w.code}</span>
      <span className="truncate text-sm text-ink">{w.text}</span>
      <span className="col-start-2 text-sm text-ink/70 sm:col-start-auto">{cadence(line)}</span>
      <span className={cn("col-start-2 font-mono text-xs tabular-nums sm:col-start-auto", s ? "text-ink/70" : "text-ink/35")}>
        {s === "" ? "parts égales" : s}
      </span>
    </div>
  );
}

// ─── Éditeur ────────────────────────────────────────────────────────────────

interface Draft {
  poste: Poste;
  p1: Nature;
  count: Count;
  month: number;
  pct: string[];
}

const equalParts = (n: number): number[] => {
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
};

function toDraft(l?: Line): Draft {
  if (!l) return { poste: "P1", p1: "ACOMPTE_FORFAIT", count: 4, month: 9, pct: equalParts(4).map(String) };
  const count = COUNT_OF[l.rhythm] ?? 4;
  const s = Array.isArray(l.splitPercents) && l.splitPercents.length === count ? l.splitPercents : equalParts(count);
  return { poste: l.poste, p1: l.nature, count, month: l.expectedMonth ?? 9, pct: s.map(String) };
}

function fromDraft(d: Draft) {
  const nature: Nature =
    d.poste === "P1" ? d.p1 : d.poste === "INTERESSEMENT" ? "DECOMPTE" : "ACOMPTE_FORFAIT";
  const count: Count = nature === "REEL" ? 12 : d.poste === "INTERESSEMENT" ? 1 : d.count;
  const nums = d.pct.map((v) => Number(v));
  const showSplit = count === 2 || count === 4;
  const equal = nums.every((v) => v === nums[0]);
  return {
    poste: d.poste,
    nature,
    rhythm: RHYTHM_OF[count],
    expectedMonth: count === 1 ? d.month : null,
    splitPercents: showSplit && !equal ? nums : [],
  };
}

function Editor({
  initial,
  mode,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Line;
  mode: "add" | "edit";
  busy: boolean;
  onSubmit: (data: ReturnType<typeof fromDraft>) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const forced: Count | null = d.poste === "INTERESSEMENT" ? 1 : d.poste === "P1" && d.p1 === "REEL" ? 12 : null;
  const count = forced ?? d.count;
  const showSplit = count === 2 || count === 4;
  const nums = d.pct.map((v) => (v.trim() === "" ? NaN : Number(v)));
  const valid = nums.every((v) => Number.isInteger(v) && v >= 0 && v <= 100);
  const total = nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const ok = !showSplit || (valid && total === 100);

  const setCount = (c: Count) => setD((p) => ({ ...p, count: c, pct: equalParts(c === 2 || c === 4 ? c : 1).map(String) }));
  const preset = (vals: number[]) => setD((p) => ({ ...p, pct: vals.map(String) }));
  const isPreset = (vals: number[]) => d.pct.length === vals.length && vals.every((v, i) => Number(d.pct[i]) === v);
  const presets: { label: string; vals: number[] }[] =
    count === 4
      ? [
          { label: "Parts égales", vals: equalParts(4) },
          { label: "Saison de chauffe 30·30·20·20", vals: [30, 30, 20, 20] },
          { label: "35·35·15·15", vals: [35, 35, 15, 15] },
        ]
      : [{ label: "Parts égales", vals: equalParts(2) }];
  const submit = () => {
    if (ok && !busy) onSubmit(fromDraft({ ...d, count }));
  };

  const step = (n: number, title: string) => (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="font-mono text-[11px] tabular-nums text-accent">{n}</span>
      <span className="text-sm font-medium text-ink">{title}</span>
    </div>
  );

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      className="space-y-5 border-y border-accent/40 bg-accent/[0.025] px-4 py-4 animate-fade-in"
    >
      <div>
        {step(1, "Quoi ?")}
        <div className="flex flex-wrap gap-1.5">
          {WHAT.map((w) => (
            <button key={w.value} type="button" className={cn(chip(d.poste === w.value), "h-10")} onClick={() => setD((p) => ({ ...p, poste: w.value }))}>
              {w.label}
            </button>
          ))}
        </div>
        {d.poste === "P1" && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 animate-fade-in">
            {P1_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className={cn(chip(d.p1 === m.value), "h-9 text-[13px]")}
                onClick={() => setD((p) => ({ ...p, p1: m.value, ...(m.value === "DECOMPTE" && p.p1 !== "DECOMPTE" ? { count: 1 as Count } : {}) }))}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {forced !== 12 && (
        <div>
          {step(2, "Combien de factures par an ?")}
          {forced === null && (
            <div className="flex gap-1.5">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(chip(count === c), "h-12 w-12 px-0 font-mono text-lg tabular-nums")}
                  onClick={() => setCount(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {count === 1 && (
            <div className={cn("flex flex-wrap items-center gap-1", forced === null && "mt-2")}>
              <span className="mr-1 text-sm text-ink/55">{forced === 1 ? "1 facture par an, en" : "en"}</span>
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  title={MONTHS[i]}
                  className={cn(chip(d.month === i + 1), "h-8 px-2 text-xs")}
                  onClick={() => setD((p) => ({ ...p, month: i + 1 }))}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showSplit && (
        <div>
          {step(3, "Répartition")}
          <div className="flex flex-wrap items-center gap-1.5">
            {d.pct.map((v, i) => (
              <label key={i} className="flex h-10 items-center border border-ink/20 bg-white focus-within:border-accent">
                <input
                  inputMode="numeric"
                  aria-label={`Part ${i + 1}`}
                  value={v}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setD((p) => ({ ...p, pct: p.pct.map((x, j) => (j === i ? val : x)) }));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="h-full w-10 bg-transparent text-right font-mono text-sm tabular-nums text-ink focus:outline-none"
                />
                <span className="pl-0.5 pr-2 font-mono text-xs text-ink/40">%</span>
              </label>
            ))}
            <span className={cn("ml-2 font-mono text-sm tabular-nums", total === 100 && valid ? "text-ink/50" : "text-red-700")}>
              = {total} %
            </span>
          </div>
          <div className="mt-2 flex h-1.5 w-full max-w-sm bg-ink/[0.05]">
            {nums.map((v, i) => (
              <div
                key={i}
                className={cn("h-full transition-[width] duration-300 ease-out", SEGMENT_TONES[i % SEGMENT_TONES.length])}
                style={{ width: `${((Number.isFinite(v) ? v : 0) / Math.max(total, 100)) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p.label} type="button" className={cn(chip(isPreset(p.vals)), "h-8 text-xs")} onClick={() => preset(p.vals)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={busy || !ok}>
          {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
          {mode === "add" ? "Ajouter" : "Enregistrer"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} title="Annuler (Échap)">
          Annuler
        </Button>
        {!ok && <span className="text-xs text-ink/50">Le total doit faire 100 %</span>}
      </div>
    </div>
  );
}

// ─── Onglet ─────────────────────────────────────────────────────────────────

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const toast = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { mutate: globalMutate } = useSWRConfig();
  const url = `/api/contracts/${contractId}/billing-lines`;
  const { data, isLoading, mutate } = useSWR<Line[]>(url, fetcher);
  const lines = useMemo(() => sortLines(Array.isArray(data) ? data : []), [data]);
  const empty = Array.isArray(data) && data.length === 0;

  const { data: sugg, isLoading: loadingSugg } = useSWR<{ suggestions: Suggestion[]; siteCount: number }>(
    empty ? `${url}/suggest` : null,
    fetcher
  );
  const suggestions = useMemo(() => sortLines(Array.isArray(sugg?.suggestions) ? sugg.suggestions : []), [sugg]);
  const siteCount = typeof sugg?.siteCount === "number" ? sugg.siteCount : 0;
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const picked = suggestions.filter((_, i) => !unticked.has(i));

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Line | null>(null);
  const [busy, setBusy] = useState(false);

  // Le suivi de saison (Finances) dépend de ces lignes
  const refreshFollowUp = () =>
    globalMutate((k) => typeof k === "string" && k.startsWith(`/api/contracts/${contractId}/billing-schedule`));

  const run = async (fn: () => Promise<unknown>, okMsg: string, after: () => void) => {
    setBusy(true);
    try {
      await fn();
      await mutate();
      refreshFollowUp();
      after();
      toast.success(okMsg);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = (d: ReturnType<typeof fromDraft>) => run(() => api.post(url, d), "Ligne ajoutée", () => setAdding(false));
  // Le serveur fusionne avec la ligne existante : libellé et tolérance sont conservés
  const update = (line: Line, d: ReturnType<typeof fromDraft>) =>
    run(() => api.put(`${url}/${line.id}`, d), "Ligne modifiée", () => setEditingId(null));
  const remove = () => {
    if (!deleting) return;
    const id = deleting.id;
    run(() => api.del(`${url}/${id}`), "Ligne supprimée", () => setDeleting(null));
  };
  const createSuggested = () =>
    run(
      () => api.post(url, { lines: picked.map(({ poste, nature, rhythm, expectedMonth }) => ({ poste, nature, rhythm, expectedMonth })) }),
      picked.length > 1 ? `${picked.length} lignes créées` : "Ligne créée",
      () => setUnticked(new Set())
    );

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const editor = adding && (
    <Editor mode="add" busy={busy} onSubmit={create} onCancel={() => setAdding(false)} />
  );

  return (
    <div className="max-w-4xl space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-ink">Modalités de facturation</h2>
        <p className="text-sm text-ink/55">Valables pour toute la durée du contrat. Le suivi saison par saison est dans Finances.</p>
      </div>

      <section className="panel">
        <div className="panel-header">
          <span className="label-tech !text-ink/70">Ce que l&apos;exploitant facture</span>
          {canCreate && !empty && (
            <button
              type="button"
              className={cn(
                "-my-1.5 flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent",
                adding && "border-accent text-accent"
              )}
              title={adding ? "Fermer" : "Ajouter une ligne"}
              onClick={() => {
                setEditingId(null);
                setAdding((a) => !a);
              }}
            >
              <Plus size={16} className={cn("transition-transform duration-200", adding && "rotate-45")} />
            </button>
          )}
        </div>

        {empty ? (
          <div className="px-4 py-5">
            <p className="text-sm font-medium text-ink">Aucune modalité définie</p>
            {loadingSugg && !sugg ? (
              <Loader2 size={16} className="mt-3 animate-spin text-accent" />
            ) : siteCount === 0 || suggestions.length === 0 ? (
              <p className="mt-1 text-sm text-ink/55">
                {siteCount === 0
                  ? "Ajoutez des sites au contrat : l'application proposera alors les modalités d'après leur type de marché."
                  : "Aucune proposition d'après les sites du contrat."}
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink/55">D&apos;après les sites du contrat, voici ce qui est probablement facturé :</p>
                <ul className="mt-3 divide-y divide-ink/[0.07] border-y border-ink/10">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <label className={cn("flex items-start gap-3 py-2.5", canCreate && "cursor-pointer")}>
                        {canCreate && (
                          <input
                            type="checkbox"
                            checked={!unticked.has(i)}
                            onChange={() =>
                              setUnticked((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              })
                            }
                            className="mt-1 h-4 w-4 accent-ink"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <LineText line={{ ...s, splitPercents: [] }} />
                          <div className="mt-0.5 pl-[2.75rem] text-xs text-ink/40">{s.reason}</div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
                {canCreate && (
                  <Button className="mt-3" size="sm" onClick={createSuggested} disabled={busy || picked.length === 0}>
                    {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                    Créer {picked.length > 1 ? `ces ${picked.length} lignes` : picked.length === 1 ? "cette ligne" : "les lignes"}
                  </Button>
                )}
              </>
            )}
            {canCreate && !adding && (
              <button type="button" onClick={() => setAdding(true)} className="mt-3 block text-xs text-ink/50 underline-offset-4 hover:text-accent hover:underline">
                ou ajouter une ligne à la main
              </button>
            )}
          </div>
        ) : null}

        {editor}

        {lines.length > 0 && (
          <ul className="divide-y divide-ink/[0.07]">
            {lines.map((l) =>
              editingId === l.id ? (
                <li key={l.id}>
                  <Editor initial={l} mode="edit" busy={busy} onSubmit={(d) => update(l, d)} onCancel={() => setEditingId(null)} />
                </li>
              ) : (
                <li key={l.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink/[0.015]">
                  <LineText line={l} />
                  {(canEdit || canDelete) && (
                    <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {canEdit && (
                        <button
                          type="button"
                          className={iconBtn}
                          title="Modifier"
                          onClick={() => {
                            setAdding(false);
                            setEditingId(l.id);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className={cn(iconBtn, "hover:text-red-700")} title="Supprimer" onClick={() => setDeleting(l)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {deleting && (
        <Modal
          title="Supprimer la ligne"
          subtitle={`${whatLabel(deleting).code} ${whatLabel(deleting).text}`.trim()}
          onClose={() => setDeleting(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={remove} disabled={busy} className="bg-red-700 hover:bg-red-800">
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
