"use client";

/**
 * Contrat › Facturation : l'échéancier de facturation du contrat (lignes
 * poste × nature × rythme) et la planche de saison qui en découle — quelles
 * factures attendre, lesquelles sont arrivées, lesquelles sont en retard.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  BoardLegend,
  SeasonBoard,
  Track,
  mergeExpected,
  provisionalExpected,
} from "@/components/billing/SeasonBoard";
import {
  MONTHS_LONG,
  NATURES,
  NATURE_LABELS,
  NATURE_SHORT,
  POSTES,
  POSTE_LABELS,
  POSTE_SHORT,
  RHYTHMS,
  RHYTHM_LABELS,
  STATUS_ORDER,
  formatDate,
  formatEuro,
  swrErrorMessage,
  type BillingLine,
  type BillingNature,
  type BillingPoste,
  type BillingRhythm,
  type BillingScheduleResponse,
  type ExpectedInvoice,
  type ExpectedStatus,
  type SeasonInfo,
  type SuggestedLine,
} from "@/components/billing/shared";

const LABEL_W = 260;
const COLS = `${LABEL_W}px minmax(0,1fr) 64px`;

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";
const iconBtnBordered =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30";

type LineDraft = Omit<BillingLine, "id" | "sortOrder">;

const EMPTY_DRAFT: LineDraft = {
  poste: "P2",
  nature: "ACOMPTE_FORFAIT",
  rhythm: "TRIMESTRIEL",
  expectedMonth: null,
  toleranceDays: 30,
  label: null,
};

const sameKind = (a: Pick<BillingLine, "poste" | "nature" | "rhythm">, b: Pick<BillingLine, "poste" | "nature" | "rhythm">) =>
  a.poste === b.poste && a.nature === b.nature && a.rhythm === b.rhythm;

// ─── Petits composants ──────────────────────────────────────────────────────

/** Compteur qui « roule » jusqu'à sa nouvelle valeur. */
function useCountUp(target: number, ms = 450): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === target) return;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(origin + (target - origin) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return value;
}

function Counter({ value, label, tone }: { value: number; label: string; tone?: string }) {
  const v = useCountUp(value);
  return (
    <div className="px-5 first:pl-0">
      <div className={cn("font-mono text-2xl font-medium leading-none tabular-nums", tone ?? "text-ink")}>{v}</div>
      <div className="label-tech mt-1.5">{label}</div>
    </div>
  );
}

const BAR_TONE: Record<ExpectedStatus, string> = {
  RECUE: "bg-ink",
  ATTENDUE: "bg-ink/30",
  EN_RETARD: "bg-red-700",
  A_VENIR: "bg-ink/[0.08]",
};

function SeasonCounters({ expected }: { expected: ExpectedInvoice[] }) {
  const counts = useMemo(() => {
    const c: Record<ExpectedStatus, number> = { RECUE: 0, ATTENDUE: 0, EN_RETARD: 0, A_VENIR: 0 };
    for (const e of expected) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [expected]);
  const total = expected.length;
  const received = expected.reduce((s, e) => s + (e.status === "RECUE" ? e.amount || 0 : 0), 0);

  return (
    <div className="border-b border-ink/10 px-4 py-4">
      <div className="flex flex-wrap items-end gap-y-3">
        <div className="flex items-end divide-x divide-ink/10">
          <Counter value={counts.RECUE} label="Reçues" />
          <Counter value={counts.ATTENDUE} label="Attendues" />
          <Counter value={counts.EN_RETARD} label="En retard" tone={counts.EN_RETARD > 0 ? "text-red-700" : "text-ink/40"} />
          <Counter value={counts.A_VENIR} label="À venir" tone="text-ink/50" />
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-2xl font-medium leading-none tabular-nums text-ink">{formatEuro(received)}</div>
          <div className="label-tech mt-1.5">Reçu sur la saison</div>
        </div>
      </div>
      {/* Avancement de la saison, segmenté par statut */}
      {total > 0 && (
        <div className="mt-4 flex h-1.5 gap-px" title={`${counts.RECUE} reçues sur ${total} attendues`}>
          {STATUS_ORDER.map((s) =>
            counts[s] > 0 ? (
              <div
                key={s}
                className={cn("h-full transition-[flex-grow] duration-700 ease-out", BAR_TONE[s])}
                style={{ flexGrow: counts[s], flexBasis: 0 }}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function SeasonNav({
  season,
  seasons,
  onChange,
  loading,
}: {
  season: SeasonInfo;
  seasons: SeasonInfo[];
  onChange: (key: string) => void;
  loading?: boolean;
}) {
  const idx = seasons.findIndex((s) => s.key === season.key);
  const current = seasons.find((s) => s.isCurrent);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={iconBtn}
        title="Saison précédente"
        disabled={idx <= 0}
        onClick={() => idx > 0 && onChange(seasons[idx - 1].key)}
      >
        <ChevronLeft size={16} />
      </button>
      <div className="min-w-[168px] text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink">
          {season.label}
          {loading && <Loader2 size={12} className="animate-spin text-ink/40" />}
        </div>
        <div className="font-mono text-[10px] tabular-nums text-ink/45">
          {formatDate(season.start)} → {formatDate(season.end)}
        </div>
      </div>
      <button
        type="button"
        className={iconBtn}
        title="Saison suivante"
        disabled={idx < 0 || idx >= seasons.length - 1}
        onClick={() => idx < seasons.length - 1 && onChange(seasons[idx + 1].key)}
      >
        <ChevronRight size={16} />
      </button>
      {/* Rail des saisons du contrat */}
      {seasons.length > 1 && seasons.length <= 16 && (
        <div className="ml-2 hidden items-center gap-0.5 sm:flex">
          {seasons.map((s) => (
            <button
              key={s.key}
              type="button"
              title={s.label + (s.isCurrent ? " (en cours)" : "")}
              onClick={() => onChange(s.key)}
              className="group flex h-6 w-3.5 items-center justify-center"
            >
              <span
                className={cn(
                  "block h-2.5 w-2.5 transition-all",
                  s.key === season.key ? "scale-110 bg-ink" : s.isCurrent ? "border border-accent" : "bg-ink/15 group-hover:bg-ink/40"
                )}
              />
            </button>
          ))}
        </div>
      )}
      {current && current.key !== season.key && (
        <button type="button" className={iconBtn} title="Revenir à la saison en cours" onClick={() => onChange(current.key)}>
          <Crosshair size={15} />
        </button>
      )}
    </div>
  );
}

/** Contrôle segmenté carré. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <div className="label-tech mb-1">{label}</div>
      <div className="inline-flex border border-ink/20" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 border-l border-ink/10 px-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors first:border-l-0",
              value === o.value ? "bg-ink text-paper" : "text-ink/55 hover:bg-ink/[0.03] hover:text-accent"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const fieldCls = "h-8 border border-ink/20 bg-white px-2 text-sm text-ink focus:border-accent focus:outline-none";

/** Formulaire d'ajout / d'édition d'une ligne, avec aperçu en direct sur la saison. */
function LineForm({
  initial,
  season,
  mode,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: LineDraft;
  season: SeasonInfo | null;
  mode: "add" | "edit";
  busy: boolean;
  onSubmit: (draft: LineDraft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<LineDraft>(initial);
  const firstRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstRef.current?.querySelector<HTMLButtonElement>("button[aria-checked='true']")?.focus();
  }, []);

  const set = <K extends keyof LineDraft>(k: K, v: LineDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  // Raccourcis de saisie : un intéressement ou un décompte est presque toujours annuel
  const setPoste = (poste: BillingPoste) =>
    setD((p) => (poste === "INTERESSEMENT" && mode === "add" ? { ...p, poste, nature: "DECOMPTE", rhythm: "ANNUEL" } : { ...p, poste }));
  const setNature = (nature: BillingNature) =>
    setD((p) => (nature === "DECOMPTE" && mode === "add" ? { ...p, nature, rhythm: "ANNUEL" } : { ...p, nature }));

  const preview = useMemo(
    () => (season ? provisionalExpected({ ...d, id: "preview" }, season) : []),
    [d, season]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void onSubmit({ ...d, label: d.label?.trim() || null, expectedMonth: d.rhythm === "ANNUEL" ? d.expectedMonth : null });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="border-y border-accent/40 bg-accent/[0.025] animate-fade-in"
    >
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div ref={firstRef}>
          <Segmented<BillingPoste>
            label="Poste"
            value={d.poste}
            onChange={setPoste}
            options={POSTES.map((p) => ({ value: p, label: POSTE_SHORT[p], title: POSTE_LABELS[p] }))}
          />
        </div>
        <Segmented<BillingNature>
          label="Nature"
          value={d.nature}
          onChange={setNature}
          options={NATURES.map((n) => ({ value: n, label: NATURE_SHORT[n], title: NATURE_LABELS[n] }))}
        />
        <Segmented<BillingRhythm>
          label="Rythme"
          value={d.rhythm}
          onChange={(v) => set("rhythm", v)}
          options={RHYTHMS.map((r) => ({ value: r, label: RHYTHM_LABELS[r] }))}
        />
        {d.rhythm === "ANNUEL" && (
          <label className="animate-fade-in">
            <div className="label-tech mb-1">Mois attendu</div>
            <select
              value={d.expectedMonth ?? ""}
              onChange={(e) => set("expectedMonth", e.target.value ? Number(e.target.value) : null)}
              className={cn(fieldCls, "w-32")}
            >
              <option value="">Fin de saison</option>
              {MONTHS_LONG.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        <label title="Délai accordé après la fin de période avant de considérer la facture en retard">
          <div className="label-tech mb-1">Tolérance</div>
          <div className="flex items-center">
            <input
              type="number"
              min={0}
              max={365}
              value={d.toleranceDays}
              onChange={(e) => set("toleranceDays", Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              className={cn(fieldCls, "w-16 text-right font-mono tabular-nums")}
            />
            <span className="ml-1.5 font-mono text-xs text-ink/50">j</span>
          </div>
        </label>
        <label className="min-w-[160px] flex-1">
          <div className="label-tech mb-1">Libellé (facultatif)</div>
          <input
            type="text"
            value={d.label ?? ""}
            onChange={(e) => set("label", e.target.value)}
            placeholder={`${POSTE_LABELS[d.poste]} — ${NATURE_LABELS[d.nature]}`}
            maxLength={120}
            className={cn(fieldCls, "w-full")}
          />
        </label>
        <div className="flex items-center gap-1">
          <button
            type="submit"
            disabled={busy}
            title={mode === "add" ? "Ajouter la ligne (Entrée)" : "Enregistrer (Entrée)"}
            className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "add" ? <Plus size={16} /> : <Check size={16} />}
          </button>
          <button type="button" onClick={onCancel} title="Fermer (Échap)" className={iconBtnBordered}>
            <X size={16} />
          </button>
        </div>
      </div>
      {season && (
        <div className="grid border-t border-accent/20" style={{ gridTemplateColumns: COLS }}>
          <div className="flex items-center px-4">
            <span className="label-tech">Aperçu · {preview.length} facture{preview.length > 1 ? "s" : ""}</span>
          </div>
          <Track
            key={`${d.rhythm}:${d.expectedMonth ?? ""}`}
            season={season}
            expected={preview}
            line={{ ...d, id: "preview" }}
            preview
            height="h-9"
          />
          <div />
        </div>
      )}
    </form>
  );
}

/** Petit glyphe du rythme : n segments sur l'année. */
function RhythmGlyph({ rhythm }: { rhythm: BillingRhythm }) {
  const n = rhythm === "MENSUEL" ? 12 : rhythm === "TRIMESTRIEL" ? 4 : rhythm === "SEMESTRIEL" ? 2 : 1;
  return (
    <span className="inline-flex h-2 w-24 gap-px" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="flex-1 bg-ink/70" />
      ))}
    </span>
  );
}

function SuggestionPicker({
  suggestions,
  existing,
  busy,
  submitLabel,
  onSubmit,
}: {
  suggestions: SuggestedLine[];
  existing: BillingLine[];
  busy: boolean;
  submitLabel: (n: number) => string;
  onSubmit: (lines: SuggestedLine[]) => void;
}) {
  const isDup = useCallback((s: SuggestedLine) => existing.some((l) => sameKind(l, s)), [existing]);
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(suggestions.map((s, i) => (isDup(s) ? -1 : i)).filter((i) => i >= 0))
  );
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const selected = suggestions.filter((_, i) => checked.has(i));

  return (
    <div>
      <ul className="divide-y divide-ink/[0.07] border-y border-ink/10">
        {suggestions.map((s, i) => {
          const on = checked.has(i);
          const dup = isDup(s);
          return (
            <li key={`${s.poste}-${s.nature}-${s.rhythm}-${i}`}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-ink/[0.02] animate-slide-in-right",
                  !on && "opacity-50"
                )}
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                aria-pressed={on}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 flex-shrink-0 items-center justify-center border transition-colors",
                    on ? "border-ink bg-ink text-paper" : "border-ink/30 bg-white"
                  )}
                >
                  {on && <Check size={11} strokeWidth={3} className="animate-pop-in" />}
                </span>
                <span className="w-10 flex-shrink-0 font-mono text-sm font-semibold text-ink">{POSTE_SHORT[s.poste]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">
                    {NATURE_LABELS[s.nature]} · {RHYTHM_LABELS[s.rhythm].toLowerCase()}
                    {s.rhythm === "ANNUEL" && s.expectedMonth ? ` · ${MONTHS_LONG[s.expectedMonth - 1]}` : ""}
                  </span>
                  <span className="block truncate text-xs text-ink/50">
                    {s.reason}
                    {dup && <span className="text-ink/40"> — déjà dans l&apos;échéancier</span>}
                  </span>
                </span>
                <RhythmGlyph rhythm={s.rhythm} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end px-4 pt-3">
        <Button onClick={() => onSubmit(selected)} disabled={busy || selected.length === 0}>
          {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
          {submitLabel(selected.length)}
        </Button>
      </div>
    </div>
  );
}

// ─── Onglet ─────────────────────────────────────────────────────────────────

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const toast = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { mutate: globalMutate } = useSWRConfig();

  const linesUrl = `/api/contracts/${contractId}/billing-lines`;
  const scheduleBase = `/api/contracts/${contractId}/billing-schedule`;

  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const scheduleUrl = seasonKey ? `${scheduleBase}?season=${encodeURIComponent(seasonKey)}` : scheduleBase;

  const { data: linesData, isLoading: loadingLines, mutate: mutateLines } = useSWR<BillingLine[]>(linesUrl, fetcher);
  const {
    data: sched,
    error: schedError,
    isValidating: validatingSched,
  } = useSWR<BillingScheduleResponse>(scheduleUrl, fetcher, { keepPreviousData: true });

  const lines = useMemo(() => (Array.isArray(linesData) ? linesData : []), [linesData]);
  const season = sched?.season ?? null;
  const seasons = Array.isArray(sched?.seasons) ? sched.seasons : [];
  const expectedByLine = useMemo(
    () => mergeExpected(lines, Array.isArray(sched?.expected) ? sched.expected : [], season),
    [lines, sched?.expected, season]
  );
  const allExpected = useMemo(() => lines.flatMap((l) => expectedByLine.get(l.id) ?? []), [lines, expectedByLine]);
  const unmatched = Array.isArray(sched?.unmatched) ? sched.unmatched : [];
  const scheduleError = schedError && !sched ? swrErrorMessage(schedError) : null;

  // Suggestions : chargées pour l'état vide ou à la demande
  const [showSuggest, setShowSuggest] = useState(false);
  const wantSuggest = showSuggest || (!loadingLines && Array.isArray(linesData) && linesData.length === 0);
  const { data: suggestData, isLoading: loadingSuggest } = useSWR<{ suggestions: SuggestedLine[]; siteCount: number }>(
    wantSuggest ? `${linesUrl}/suggest` : null,
    fetcher
  );
  const suggestions = Array.isArray(suggestData?.suggestions) ? suggestData.suggestions : [];
  const siteCount = suggestData?.siteCount ?? 0;

  const [adding, setAdding] = useState(false);
  const [draftSeed, setDraftSeed] = useState<LineDraft>(EMPTY_DRAFT);
  // Remonte le formulaire d'ajout (brouillon neuf) après chaque ajout réussi
  const [formKey, setFormKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BillingLine | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [showUnmatched, setShowUnmatched] = useState(false);

  const refreshSchedules = useCallback(
    () => globalMutate((k) => typeof k === "string" && k.startsWith(scheduleBase)),
    [globalMutate, scheduleBase]
  );

  const flash = (ids: string[]) => {
    setFreshIds(new Set(ids));
    window.setTimeout(() => setFreshIds(new Set()), 1800);
  };

  // ── Mutations ─────────────────────────────────────────────
  const addLines = async (drafts: LineDraft[]): Promise<boolean> => {
    if (drafts.length === 0) return false;
    setBusy(true);
    const stamp = Date.now();
    const temps: BillingLine[] = drafts.map((d, i) => ({ ...d, id: `tmp-${stamp}-${i}` }));
    let created: BillingLine[] = [];
    try {
      await mutateLines(
        async (cur) => {
          created = await api.post<BillingLine[]>(linesUrl, { lines: drafts });
          return [...(cur ?? []), ...(Array.isArray(created) ? created : [])];
        },
        { optimisticData: (cur) => [...(cur ?? []), ...temps], rollbackOnError: true, revalidate: false }
      );
      flash(created.map((c) => c.id));
      toast.success(drafts.length > 1 ? `${drafts.length} lignes ajoutées` : "Ligne ajoutée");
      void refreshSchedules();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addOne = async (d: LineDraft) => {
    const ok = await addLines([d]);
    // On garde le formulaire ouvert pour enchaîner ; seul le libellé repart à vide
    if (ok) {
      setDraftSeed({ ...d, label: null });
      setFormKey((k) => k + 1);
    }
  };

  const updateLine = async (id: string, d: LineDraft) => {
    setBusy(true);
    try {
      await mutateLines(
        async (cur) => {
          const updated = await api.put<BillingLine>(`${linesUrl}/${id}`, d);
          return (cur ?? []).map((l) => (l.id === id ? updated : l));
        },
        {
          optimisticData: (cur) => (cur ?? []).map((l) => (l.id === id ? { ...l, ...d } : l)),
          rollbackOnError: true,
          revalidate: false,
        }
      );
      setEditingId(null);
      flash([id]);
      toast.success("Ligne modifiée");
      void refreshSchedules();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteLine = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setBusy(true);
    try {
      await mutateLines(
        async (cur) => {
          await api.del(`${linesUrl}/${id}`);
          return (cur ?? []).filter((l) => l.id !== id);
        },
        { optimisticData: (cur) => (cur ?? []).filter((l) => l.id !== id), rollbackOnError: true, revalidate: false }
      );
      setDeleting(null);
      toast.success("Ligne supprimée");
      void refreshSchedules();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createFromSuggestions = async (picked: SuggestedLine[]) => {
    const ok = await addLines(
      picked.map((s) => ({
        poste: s.poste,
        nature: s.nature,
        rhythm: s.rhythm,
        expectedMonth: s.expectedMonth,
        toleranceDays: 30,
        label: null,
      }))
    );
    if (ok) setShowSuggest(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setDraftSeed(EMPTY_DRAFT);
    setAdding(true);
  };

  // ── Rendu ─────────────────────────────────────────────────
  if (loadingLines && !linesData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const isEmpty = lines.length === 0;

  const addForm = adding && canCreate && (
    <LineForm
      key={formKey}
      initial={draftSeed}
      season={season}
      mode="add"
      busy={busy}
      onSubmit={addOne}
      onCancel={() => setAdding(false)}
    />
  );

  const rowActions = (line: BillingLine) => (
    <>
      {canEdit && (
        <button
          type="button"
          className={iconBtn}
          title="Modifier la ligne"
          onClick={() => {
            setAdding(false);
            setEditingId(line.id);
          }}
        >
          <Pencil size={14} />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className={cn(iconBtn, "hover:text-red-700")}
          title="Supprimer la ligne"
          onClick={() => setDeleting(line)}
        >
          <Trash2 size={14} />
        </button>
      )}
    </>
  );

  const editor = (line: BillingLine) => (
    <LineForm
      initial={{
        poste: line.poste,
        nature: line.nature,
        rhythm: line.rhythm,
        expectedMonth: line.expectedMonth,
        toleranceDays: line.toleranceDays ?? 30,
        label: line.label,
      }}
      season={season}
      mode="edit"
      busy={busy}
      onSubmit={(d) => updateLine(line.id, d)}
      onCancel={() => setEditingId(null)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="panel">
        {/* En-tête : saison + actions */}
        <div className="panel-header flex-wrap">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="label-tech">Échéancier de facturation</span>
            {season && (
              <SeasonNav
                season={season}
                seasons={seasons}
                onChange={setSeasonKey}
                loading={validatingSched && seasonKey !== null && season.key !== seasonKey}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isEmpty && canCreate && (
              <button type="button" className={iconBtnBordered} title="Proposer des lignes d'après les sites" onClick={() => setShowSuggest(true)}>
                <Wand2 size={15} />
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                className={cn(iconBtnBordered, adding && "border-accent text-accent")}
                title="Ajouter une ligne"
                onClick={() => (adding ? setAdding(false) : openAdd())}
              >
                <Plus size={16} className={cn("transition-transform duration-200", adding && "rotate-45")} />
              </button>
            )}
          </div>
        </div>

        {scheduleError && (
          <div className="border-b border-ink/10 px-4 py-3 text-sm text-ink/60">{scheduleError}</div>
        )}

        {isEmpty ? (
          <>
            {addForm}
            <EmptyState
              loading={loadingSuggest}
              suggestions={suggestions}
              siteCount={siteCount}
              busy={busy}
              canCreate={canCreate}
              onCreate={createFromSuggestions}
            />
          </>
        ) : (
          <>
            {season && <SeasonCounters expected={allExpected} />}
            {season ? (
              <SeasonBoard
                season={season}
                lines={lines}
                expectedByLine={expectedByLine}
                renderActions={canEdit || canDelete ? rowActions : undefined}
                editingId={editingId}
                renderEditor={editor}
                freshIds={freshIds}
                labelWidth={LABEL_W}
                footer={addForm}
              />
            ) : (
              // Sans dates de contrat : la liste des lignes reste éditable
              <div className="divide-y divide-ink/[0.07]">
                {lines.map((l) =>
                  editingId === l.id ? (
                    <div key={l.id}>{editor(l)}</div>
                  ) : (
                    <div key={l.id} className="group flex items-center justify-between px-4 py-2">
                      <PlainLineLabel line={l} />
                      <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">{rowActions(l)}</div>
                    </div>
                  )
                )}
                {addForm}
              </div>
            )}
            {season && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-2">
                <BoardLegend />
                <span className="font-mono text-[10px] text-ink/40">Survol : détail · clic sur une facture reçue : Finances</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Factures de la saison hors échéancier */}
      {!isEmpty && unmatched.length > 0 && (
        <div className="panel">
          <button
            type="button"
            onClick={() => setShowUnmatched((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-ink/[0.02]"
            aria-expanded={showUnmatched}
          >
            <span className="text-sm text-ink">
              <span className="font-mono tabular-nums">{unmatched.length}</span> facture{unmatched.length > 1 ? "s" : ""} hors
              échéancier
              <span className="ml-2 text-xs text-ink/45">reçues sur la saison sans ligne correspondante</span>
            </span>
            <ChevronDown size={16} className={cn("text-ink/40 transition-transform", showUnmatched && "rotate-180")} />
          </button>
          {showUnmatched && (
            <ul className="divide-y divide-ink/[0.07] border-t border-ink/10 animate-fade-in">
              {unmatched.map((u) => (
                <li key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-4 px-4 py-1.5 text-sm">
                  <a href="/financier?tab=facturation" className="truncate font-mono text-ink hover:text-accent">
                    {u.reference || "sans réf."}
                  </a>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
                    {u.type}
                    {u.nature ? ` · ${u.nature.toLowerCase()}` : ""}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink/50">{formatDate(u.issueDate)}</span>
                  <span className="w-28 text-right font-mono tabular-nums text-ink">{formatEuro(u.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Proposer d'après les sites (lignes existantes) */}
      {showSuggest && !isEmpty && (
        <Modal title="Proposer d'après les sites" subtitle="Lignes déduites des types de marché des sites" onClose={() => setShowSuggest(false)} size="lg">
          {loadingSuggest && !suggestData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="py-4 text-sm text-ink/60">
              {siteCount === 0
                ? "Aucun site rattaché au contrat : rien à proposer."
                : "Aucune ligne déduite des sites (postes P1, P2, P3 non renseignés)."}
            </p>
          ) : (
            <div className="-mx-5">
              <SuggestionPicker
                suggestions={suggestions}
                existing={lines}
                busy={busy}
                submitLabel={(n) => (n > 1 ? `Ajouter ${n} lignes` : n === 1 ? "Ajouter 1 ligne" : "Aucune ligne cochée")}
                onSubmit={createFromSuggestions}
              />
            </div>
          )}
        </Modal>
      )}

      {/* Suppression */}
      {deleting && (
        <Modal
          title="Supprimer la ligne"
          subtitle={`${POSTE_SHORT[deleting.poste]} · ${NATURE_LABELS[deleting.nature]} · ${RHYTHM_LABELS[deleting.rhythm].toLowerCase()}`}
          onClose={() => setDeleting(null)}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={deleteLine} disabled={busy} className="bg-red-700 hover:bg-red-800">
                {busy && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">La ligne sera supprimée de l&apos;échéancier.</p>
        </Modal>
      )}
    </div>
  );
}

function PlainLineLabel({ line }: { line: BillingLine }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 font-mono text-sm font-semibold text-ink">{POSTE_SHORT[line.poste]}</span>
      <span className="text-sm text-ink">{line.label || NATURE_LABELS[line.nature]}</span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink/45">
        {RHYTHM_LABELS[line.rhythm]}
        {line.rhythm === "ANNUEL" && line.expectedMonth ? ` · ${MONTHS_LONG[line.expectedMonth - 1]}` : ""} · tol. {line.toleranceDays ?? 30} j
      </span>
    </div>
  );
}

function EmptyState({
  loading,
  suggestions,
  siteCount,
  busy,
  canCreate,
  onCreate,
}: {
  loading: boolean;
  suggestions: SuggestedLine[];
  siteCount: number;
  busy: boolean;
  canCreate: boolean;
  onCreate: (lines: SuggestedLine[]) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (siteCount === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-ink">Aucune ligne de facturation.</p>
        <p className="mt-1 text-sm text-ink/50">
          Ajoutez des sites au contrat : l&apos;échéancier sera proposé d&apos;après leurs types de marché.
          {canCreate && " Vous pouvez aussi saisir les lignes à la main (+)."}
        </p>
      </div>
    );
  }
  if (suggestions.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-ink">Aucune ligne de facturation.</p>
        <p className="mt-1 text-sm text-ink/50">
          Rien à déduire des {siteCount} site{siteCount > 1 ? "s" : ""} (postes P1, P2, P3 non renseignés).
          {canCreate && " Saisissez les lignes à la main (+)."}
        </p>
      </div>
    );
  }
  return (
    <div className="pb-4">
      <div className="px-4 pb-3 pt-4">
        <p className="text-sm text-ink">
          D&apos;après {siteCount === 1 ? "le site" : `les ${siteCount} sites`} du contrat, voici les factures à attendre de
          l&apos;exploitant.
        </p>
        <p className="mt-0.5 text-xs text-ink/50">Décochez ce qui ne s&apos;applique pas ; tout reste modifiable ensuite.</p>
      </div>
      {canCreate ? (
        <SuggestionPicker
          suggestions={suggestions}
          existing={[]}
          busy={busy}
          submitLabel={(n) => `Créer l'échéancier (${n} ligne${n > 1 ? "s" : ""})`}
          onSubmit={onCreate}
        />
      ) : (
        <ul className="divide-y divide-ink/[0.07] border-y border-ink/10">
          {suggestions.map((s, i) => (
            <li key={i} className="px-4 py-2 text-sm text-ink/70">
              {POSTE_SHORT[s.poste]} · {NATURE_LABELS[s.nature]} · {RHYTHM_LABELS[s.rhythm].toLowerCase()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
