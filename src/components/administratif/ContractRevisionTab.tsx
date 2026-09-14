"use client";

/**
 * Contrat › Révision — lecture et paramétrage de la révision indicielle.
 *
 * Principe : il n'existe AUCUNE règle générale de révision. Chaque P a une
 * fiche de paramètres, vide tant que personne ne l'a renseignée à partir du
 * CCAP. L'écran n'affiche donc ni périodicité par défaut ni échéance déduite
 * tant que la première échéance n'est pas saisie.
 *
 * Le moteur de calcul reste côté serveur (`apply-revision`) ; cet écran lit la
 * chronologie (`revision-timeline`) et ouvre l'aperçu avant application.
 */

import { useCallback, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { api, getErrorMessage } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ReadOnlyGate } from "@/components/permissions";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

type PType = "P2" | "P3";
type Periodicity = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
type EntryStatus =
  | "applied"
  | "ready"
  | "provisional"
  | "missing_index"
  | "upcoming";

interface IndexValue {
  id: string;
  date: string;
  value: number;
  isProvisional: boolean;
}

interface RevisionIndex {
  id: string;
  name: string;
  identifier: string | null;
  values: IndexValue[];
}

interface TimelineComponent {
  indexId: string;
  indexName: string;
  coefficient: number;
  baseValue: number;
  reconnectionCoef: number;
  value: number | null;
  valueMonth: string | null;
  isProvisional: boolean;
}

interface TimelineEntry {
  dueDate: string;
  status: EntryStatus;
  isOverdue: boolean;
  appliedAt: string | null;
  appliedBy: string | null;
  K: number | null;
  hasProvisionalIndex: boolean;
  missingIndexNames: string[];
  components: TimelineComponent[];
}

interface TimelineFormula {
  id: string;
  pType: PType | "P1";
  periodicity: Periodicity;
  firstRevisionDate: string | null;
  indexLagMonths: number | null;
  constantPart: number;
  roundingDecimals: number;
  configured: boolean;
  components: {
    indexId: string;
    indexName: string;
    coefficient: number;
    baseValue: number;
    reconnectionCoef: number;
  }[];
  entries: TimelineEntry[];
}

interface PreviewSite {
  contractSiteId: string;
  siteName: string;
  base: number;
  before: number;
  after: number;
  delta: number;
}

interface PreviewResult {
  pType: string;
  periodStart: string;
  K: number;
  Kraw: number;
  roundingDecimals: number;
  constantPart: number;
  components: {
    indexName: string;
    coefficient: number;
    baseValue: number;
    currentValue: number;
    reconnectionCoef: number;
    isProvisional: boolean;
    valueMonth: string;
  }[];
  sites: PreviewSite[];
  hasProvisionalIndex: boolean;
}

interface SyncResult {
  indices: {
    indexId: string;
    name: string;
    identifier: string;
    titleFr: string | null;
    added: number;
    updated: number;
    confirmed: number;
    latestPeriod: string | null;
  }[];
  skipped: string[];
  errors: { name: string; identifier: string; message: string }[];
}

const P_TYPES: PType[] = ["P2", "P3"];

const PERIOD_LABEL: Record<Periodicity, string> = {
  MONTHLY: "mensuelle",
  QUARTERLY: "trimestrielle",
  SEMI_ANNUAL: "semestrielle",
  ANNUAL: "annuelle",
};

// ============================================================
// Formatage
// ============================================================

const MONTHS_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function formatDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

/** « 2025-06 » → « juin 25 ». */
function formatMonth(monthKey: string | null): string {
  if (!monthKey) return "—";
  const [y, m] = monthKey.split("-");
  const idx = parseInt(m, 10) - 1;
  if (isNaN(idx) || !MONTHS_SHORT[idx]) return monthKey;
  return `${MONTHS_SHORT[idx]} ${y.slice(2)}`;
}

function formatNumber(n: number, maxDecimals = 4): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: maxDecimals });
}

function formatEuro(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

/** Résumé mono des paramètres : « trimestrielle · 1re échéance 01/09/2025 · … ». */
function settingsSummary(formula: TimelineFormula): string {
  const parts = [
    PERIOD_LABEL[formula.periodicity],
    `1re échéance ${formatDay(formula.firstRevisionDate)}`,
    formula.indexLagMonths == null
      ? "dernier indice connu"
      : `indice m−${formula.indexLagMonths}`,
    `arrondi ${formula.roundingDecimals}`,
  ];
  return parts.join(" · ");
}

/** Formule rendue : « K = 0,15 + 0,45 × ICHT-IME / 133,2 ». */
function renderFormula(
  constantPart: number,
  components: {
    indexName: string;
    coefficient: number;
    baseValue: number;
    reconnectionCoef: number;
  }[]
): string {
  const terms: string[] = [];
  if (constantPart !== 0 || components.length === 0) {
    terms.push(formatNumber(constantPart));
  }
  for (const c of components) {
    const recon =
      c.reconnectionCoef && c.reconnectionCoef !== 1
        ? ` × ${formatNumber(c.reconnectionCoef, 6)}`
        : "";
    terms.push(
      `${formatNumber(c.coefficient)} × ${c.indexName}${recon} / ${formatNumber(c.baseValue, 6)}`
    );
  }
  return `K = ${terms.join(" + ")}`;
}

// ============================================================
// Écran
// ============================================================

export default function ContractRevisionTab({ contractId }: { contractId: string }) {
  const {
    data: indicesData,
    isLoading: loadingIndices,
    error: indicesError,
  } = useSWR<RevisionIndex[]>(`/api/contracts/${contractId}/revision-indices`, fetcher);
  const {
    data: timelineData,
    isLoading: loadingTimeline,
    error: timelineError,
  } = useSWR<TimelineFormula[]>(`/api/contracts/${contractId}/revision-timeline`, fetcher);

  // mutate LIÉ au provider de cache de l'app : on invalide par préfixe pour
  // rafraîchir indices, formules et chronologie d'un coup.
  const { mutate: swrMutate } = useSWRConfig();
  const refresh = useCallback(
    () =>
      swrMutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/contracts/${contractId}/revision`)
      ),
    [swrMutate, contractId]
  );

  const indices = useMemo(() => indicesData ?? [], [indicesData]);
  const timeline = useMemo(() => timelineData ?? [], [timelineData]);
  const error = indicesError || timelineError;

  // Spinner uniquement au tout premier chargement.
  const firstLoad =
    (loadingIndices || loadingTimeline) && !indicesData && !timelineData;

  if (error) {
    return (
      <div className="border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-700">
        Impossible de charger les données de révision. Rechargez la page.
      </div>
    );
  }

  if (firstLoad) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {P_TYPES.map((pType) => (
        <PBlock
          key={pType}
          contractId={contractId}
          pType={pType}
          formula={timeline.find((f) => f.pType === pType) ?? null}
          indices={indices}
          onChanged={refresh}
        />
      ))}

      <IndicesTable
        contractId={contractId}
        indices={indices}
        timeline={timeline}
        onChanged={refresh}
      />
    </div>
  );
}

// ============================================================
// Bloc par P
// ============================================================

function PBlock({
  contractId,
  pType,
  formula,
  indices,
  onChanged,
}: {
  contractId: string;
  pType: PType;
  formula: TimelineFormula | null;
  indices: RevisionIndex[];
  onChanged: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [applyDue, setApplyDue] = useState<string | null>(null);

  const configured = !!formula?.configured;
  const componentsForHeader = formula?.components ?? [];

  return (
    <section className="panel">
      <div className="panel-header flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="label-tech">Révision {pType}</span>
          {configured && formula ? (
            <span className="font-mono text-xs text-ink/50">
              {settingsSummary(formula)}
            </span>
          ) : (
            <span className="font-mono text-xs text-amber-700">
              {formula ? "échéancier non paramétré" : "non paramétrée"}
            </span>
          )}
        </div>
        <ReadOnlyGate>
          <button
            onClick={() => setSettingsOpen(true)}
            title={`Paramètres de révision ${pType}`}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
          >
            <Pencil size={16} />
          </button>
        </ReadOnlyGate>
      </div>

      {formula && componentsForHeader.length > 0 && (
        <div className="border-b border-ink/[0.06] px-4 py-2 font-mono text-xs tabular-nums text-ink/80">
          {renderFormula(formula.constantPart, componentsForHeader)}
        </div>
      )}

      {configured && formula ? (
        <Timeline
          formula={formula}
          onApply={(dueDate) => setApplyDue(dueDate)}
        />
      ) : (
        <p className="px-4 py-3 text-sm text-ink/50">
          Aucun paramètre de révision {pType} enregistré pour ce contrat.
        </p>
      )}

      {settingsOpen && (
        <SettingsModal
          contractId={contractId}
          pType={pType}
          formula={formula}
          indices={indices}
          onClose={() => setSettingsOpen(false)}
          onSaved={onChanged}
        />
      )}

      {applyDue && formula && (
        <ApplyModal
          contractId={contractId}
          pType={pType}
          dueDate={applyDue}
          onClose={() => setApplyDue(null)}
          onApplied={onChanged}
        />
      )}
    </section>
  );
}

// ============================================================
// Chronologie
// ============================================================

function Timeline({
  formula,
  onApply,
}: {
  formula: TimelineFormula;
  onApply: (dueDate: string) => void;
}) {
  const indexNames = formula.components.map((c) => c.indexName);

  if (formula.entries.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-ink/50">
        Aucune échéance à cette date.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/[0.06]">
            <th className="label-tech px-4 py-2 text-left">Échéance</th>
            {indexNames.map((name) => (
              <th key={name} className="label-tech px-4 py-2 text-right">
                {name}
              </th>
            ))}
            <th className="label-tech px-4 py-2 text-right">K</th>
            <th className="label-tech px-4 py-2 text-left">Appliquée</th>
          </tr>
        </thead>
        <tbody>
          {formula.entries.map((entry) => (
            <tr key={entry.dueDate} className="border-t border-ink/[0.06]">
              <td className="px-4 py-2 whitespace-nowrap">
                <span
                  className={`font-mono tabular-nums ${
                    entry.status === "upcoming" ? "text-ink/40" : "text-ink"
                  }`}
                >
                  {formatDay(entry.dueDate)}
                </span>
                {entry.isOverdue && (
                  <span className="ml-2 border border-red-600/20 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    en retard
                  </span>
                )}
              </td>

              {formula.components.map((component) => {
                const cell = entry.components.find(
                  (c) => c.indexId === component.indexId
                );
                if (!cell || cell.value === null) {
                  return (
                    <td
                      key={component.indexId}
                      className="px-4 py-2 text-right font-mono text-xs text-amber-700"
                    >
                      — manquant
                    </td>
                  );
                }
                return (
                  <td
                    key={component.indexId}
                    className="px-4 py-2 text-right font-mono tabular-nums whitespace-nowrap"
                  >
                    <span className={entry.status === "upcoming" ? "text-ink/40" : "text-ink"}>
                      {formatNumber(cell.value, 4)}
                    </span>
                    {cell.isProvisional && (
                      <span className="ml-1 text-amber-700" title="Valeur provisoire">
                        p
                      </span>
                    )}
                    <span className="ml-2 text-xs text-ink/40">
                      ({formatMonth(cell.valueMonth)})
                    </span>
                  </td>
                );
              })}

              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {entry.K === null ? (
                  <span className="text-ink/30">—</span>
                ) : (
                  <span
                    className={
                      entry.status === "upcoming" ? "text-ink/40" : "font-semibold text-ink"
                    }
                  >
                    {entry.K.toFixed(formula.roundingDecimals)}
                  </span>
                )}
              </td>

              <td className="px-4 py-2">
                <EntryAction entry={entry} onApply={onApply} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryAction({
  entry,
  onApply,
}: {
  entry: TimelineEntry;
  onApply: (dueDate: string) => void;
}) {
  if (entry.status === "applied") {
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-ink/60">
        <Check size={13} className="text-green-700" />
        {formatDay(entry.appliedAt)}
        {entry.appliedBy && <span>· {entry.appliedBy}</span>}
      </span>
    );
  }

  if (entry.status === "missing_index") {
    return (
      <span
        className="flex items-center gap-1 text-xs text-amber-700"
        title={`Indice manquant : ${entry.missingIndexNames.join(", ")}`}
      >
        <AlertTriangle size={13} />
        en attente d&apos;indice
      </span>
    );
  }

  if (entry.status === "upcoming") {
    return <span className="text-xs text-ink/35">à venir</span>;
  }

  // ready | provisional → applicable
  return (
    <ReadOnlyGate>
      <button
        onClick={() => onApply(entry.dueDate)}
        title={
          entry.status === "provisional"
            ? "Appliquer (au moins un indice est provisoire)"
            : "Appliquer cette révision"
        }
        className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
      >
        <Check size={16} />
      </button>
    </ReadOnlyGate>
  );
}

// ============================================================
// Modale « Paramètres de révision P<N> »
// ============================================================

interface DraftComponent {
  indexName: string;
  coefficient: string;
  baseValue: string;
  reconnectionCoef: string;
}

function SettingsModal({
  contractId,
  pType,
  formula,
  indices,
  onClose,
  onSaved,
}: {
  contractId: string;
  pType: PType;
  formula: TimelineFormula | null;
  indices: RevisionIndex[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [firstRevisionDate, setFirstRevisionDate] = useState(
    formula?.firstRevisionDate ? formula.firstRevisionDate.slice(0, 10) : ""
  );
  const [periodicity, setPeriodicity] = useState<Periodicity>(
    formula?.periodicity ?? "ANNUAL"
  );
  const [lagMode, setLagMode] = useState<"latest" | "offset">(
    formula?.indexLagMonths == null ? "latest" : "offset"
  );
  const [lagMonths, setLagMonths] = useState(
    formula?.indexLagMonths == null ? "3" : String(formula.indexLagMonths)
  );
  const [roundingDecimals, setRoundingDecimals] = useState(
    String(formula?.roundingDecimals ?? 4)
  );
  const [constantPart, setConstantPart] = useState(
    String(formula?.constantPart ?? 0)
  );
  const [components, setComponents] = useState<DraftComponent[]>(
    (formula?.components ?? []).map((c) => ({
      indexName: c.indexName,
      coefficient: String(c.coefficient),
      baseValue: String(c.baseValue),
      reconnectionCoef: String(c.reconnectionCoef ?? 1),
    }))
  );

  const patchComponent = (i: number, patch: Partial<DraftComponent>) =>
    setComponents((prev) =>
      prev.map((c, j) => (j === i ? { ...c, ...patch } : c))
    );

  const preview = useMemo(
    () =>
      renderFormula(
        parseFloat(constantPart) || 0,
        components.map((c) => ({
          indexName: c.indexName.trim() || "?",
          coefficient: parseFloat(c.coefficient) || 0,
          baseValue: parseFloat(c.baseValue) || 0,
          reconnectionCoef: parseFloat(c.reconnectionCoef) || 1,
        }))
      ),
    [constantPart, components]
  );

  const coefSum = useMemo(
    () =>
      (parseFloat(constantPart) || 0) +
      components.reduce((s, c) => s + (parseFloat(c.coefficient) || 0), 0),
    [constantPart, components]
  );

  const save = async () => {
    for (const c of components) {
      if (!c.indexName.trim()) {
        toast.error("Chaque terme doit désigner un indice");
        return;
      }
      if (!Number.isFinite(parseFloat(c.baseValue)) || parseFloat(c.baseValue) === 0) {
        toast.error(`Valeur de base I₀ manquante pour ${c.indexName.trim()}`);
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/api/contracts/${contractId}/revision-formulas`, {
        pType,
        periodicity,
        firstRevisionDate: firstRevisionDate || null,
        indexLagMonths:
          lagMode === "latest" ? null : parseInt(lagMonths, 10) || 0,
        constantPart: parseFloat(constantPart) || 0,
        roundingDecimals: parseInt(roundingDecimals, 10) || 4,
        components: components.map((c) => ({
          indexName: c.indexName.trim(),
          coefficient: parseFloat(c.coefficient) || 0,
          baseValue: parseFloat(c.baseValue) || 0,
          reconnectionCoef: parseFloat(c.reconnectionCoef) || 1,
        })),
      });
      toast.success(`Paramètres de révision ${pType} enregistrés`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.put(`/api/contracts/${contractId}/revision-formulas`, {
        pType,
        enabled: false,
      });
      toast.success(`Révision ${pType} supprimée`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Paramètres de révision ${pType}`}
      subtitle="Renseignés d'après le CCAP. Aucune valeur n'est supposée par défaut."
      onClose={onClose}
      size="lg"
      footer={
        <>
          {formula && (
            <button
              onClick={remove}
              disabled={saving}
              title={`Supprimer les paramètres de révision ${pType}`}
              className="mr-auto flex h-9 w-9 items-center justify-center text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </>
      }
    >
      <datalist id={`revision-indices-${pType}`}>
        {indices.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <div className="space-y-5">
        {/* Échéancier */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-tech mb-1 block">Première échéance</span>
            <input
              type="date"
              value={firstRevisionDate}
              onChange={(e) => setFirstRevisionDate(e.target.value)}
              className="w-full border border-ink/20 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Périodicité</span>
            <select
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as Periodicity)}
              className="w-full border border-ink/20 px-2 py-1.5 text-sm"
            >
              {(Object.keys(PERIOD_LABEL) as Periodicity[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Mois d'indice */}
        <fieldset>
          <legend className="label-tech mb-1">Mois d&apos;indice retenu</legend>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`lag-${pType}`}
                checked={lagMode === "latest"}
                onChange={() => setLagMode("latest")}
              />
              Dernier indice connu à l&apos;échéance
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`lag-${pType}`}
                checked={lagMode === "offset"}
                onChange={() => setLagMode("offset")}
              />
              Indice du mois m−
              <input
                type="number"
                min="0"
                max="36"
                step="1"
                value={lagMonths}
                onChange={(e) => {
                  setLagMonths(e.target.value);
                  setLagMode("offset");
                }}
                className="w-16 border border-ink/20 px-2 py-1 text-sm tabular-nums"
              />
            </label>
          </div>
        </fieldset>

        {/* Arrondi / partie fixe */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-tech mb-1 block">Arrondi de K (décimales)</span>
            <input
              type="number"
              min="0"
              max="10"
              step="1"
              value={roundingDecimals}
              onChange={(e) => setRoundingDecimals(e.target.value)}
              className="w-full border border-ink/20 px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Partie fixe</span>
            <input
              type="number"
              step="0.0001"
              value={constantPart}
              onChange={(e) => setConstantPart(e.target.value)}
              className="w-full border border-ink/20 px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>

        {/* Termes */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label-tech">Termes indiciels</span>
            <button
              onClick={() =>
                setComponents((prev) => [
                  ...prev,
                  { indexName: "", coefficient: "", baseValue: "", reconnectionCoef: "1" },
                ])
              }
              title="Ajouter un terme"
              className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
            >
              <Plus size={16} />
            </button>
          </div>

          {components.length === 0 ? (
            <p className="border-t border-ink/[0.06] py-3 text-sm text-ink/50">
              Aucun terme. La révision se réduirait à la partie fixe.
            </p>
          ) : (
            <div>
              {components.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 border-t border-ink/[0.06] py-2"
                >
                  <input
                    type="number"
                    step="0.0001"
                    value={c.coefficient}
                    onChange={(e) => patchComponent(i, { coefficient: e.target.value })}
                    placeholder="coef"
                    title="Coefficient"
                    className="w-20 border border-ink/20 px-2 py-1 text-sm tabular-nums"
                  />
                  <span className="text-ink/40">×</span>
                  <input
                    list={`revision-indices-${pType}`}
                    value={c.indexName}
                    onChange={(e) => patchComponent(i, { indexName: e.target.value })}
                    placeholder="Indice (ex : ICHT-IME)"
                    title="Nom de l'indice — créé s'il n'existe pas encore"
                    className="min-w-0 flex-1 border border-ink/20 px-2 py-1 text-sm"
                  />
                  <span className="text-ink/40">/</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={c.baseValue}
                    onChange={(e) => patchComponent(i, { baseValue: e.target.value })}
                    placeholder="I₀"
                    title="Valeur de base I₀"
                    className="w-24 border border-ink/20 px-2 py-1 text-sm tabular-nums"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={c.reconnectionCoef}
                    onChange={(e) =>
                      patchComponent(i, { reconnectionCoef: e.target.value })
                    }
                    placeholder="raccord."
                    title="Coefficient de raccordement (changement de base INSEE) — 1 par défaut"
                    className="w-24 border border-ink/20 px-2 py-1 text-sm tabular-nums"
                  />
                  <button
                    onClick={() =>
                      setComponents((prev) => prev.filter((_, j) => j !== i))
                    }
                    title="Supprimer ce terme"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div className="border-t border-ink/[0.06] pt-3">
          <div className="font-mono text-xs tabular-nums break-words text-ink/80">
            {preview}
          </div>
          <div
            className={`mt-1 font-mono text-xs tabular-nums ${
              Math.abs(coefSum - 1) < 0.001 ? "text-ink/40" : "text-amber-700"
            }`}
          >
            Somme partie fixe + coefficients : {formatNumber(coefSum, 4)}
            {Math.abs(coefSum - 1) < 0.001 ? "" : " (généralement 1)"}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Modale d'application (aperçu par site)
// ============================================================

function ApplyModal({
  contractId,
  pType,
  dueDate,
  onClose,
  onApplied,
}: {
  contractId: string;
  pType: PType;
  dueDate: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const toast = useToast();
  const [applying, setApplying] = useState(false);

  const { data, error, isLoading } = useSWR<PreviewResult>(
    [`/api/contracts/${contractId}/apply-revision?preview=1`, pType, dueDate],
    async ([url]: [string]) =>
      api.post<PreviewResult>(url, { pType, periodStart: dueDate })
  );

  const confirm = async () => {
    setApplying(true);
    try {
      await api.post(`/api/contracts/${contractId}/apply-revision`, {
        pType,
        periodStart: dueDate,
      });
      toast.success(`Révision ${pType} du ${formatDay(dueDate)} appliquée`);
      onApplied();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  const total = data
    ? data.sites.reduce((s, site) => s + site.delta, 0)
    : 0;

  return (
    <Modal
      title={`Appliquer la révision ${pType}`}
      subtitle={`Échéance du ${formatDay(dueDate)}`}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={applying}>
            Annuler
          </Button>
          <Button size="sm" onClick={confirm} disabled={applying || !data}>
            {applying && <Loader2 size={14} className="mr-2 animate-spin" />}
            Confirmer
          </Button>
        </>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      )}

      {error && (
        <div className="border border-red-600/30 bg-red-50 px-3 py-2 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.hasProvisionalIndex && (
            <div className="flex items-start gap-2 border border-amber-600/20 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Au moins un indice utilisé est <strong>provisoire</strong> : une
                régularisation sera nécessaire à sa confirmation.
              </span>
            </div>
          )}

          <div className="font-mono text-xs tabular-nums break-words text-ink/70">
            K = {formatNumber(data.constantPart)}
            {data.components.map((c, i) => (
              <span key={i}>
                {" + "}
                {formatNumber(c.coefficient)} × {c.indexName}{" "}
                {formatNumber(c.currentValue, 4)} ({formatMonth(c.valueMonth)})
                {c.reconnectionCoef !== 1 ? ` × ${formatNumber(c.reconnectionCoef, 6)}` : ""}
                {c.isProvisional ? " p" : ""} / {formatNumber(c.baseValue, 6)}
              </span>
            ))}
            {" = "}
            <span className="font-semibold text-ink">
              {data.K.toFixed(data.roundingDecimals)}
            </span>
            <span className="text-ink/40">
              {" "}
              (brut {data.Kraw.toFixed(8)})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/[0.06]">
                  <th className="label-tech px-3 py-2 text-left">Site</th>
                  <th className="label-tech px-3 py-2 text-right">Base P₀</th>
                  <th className="label-tech px-3 py-2 text-right">Avant</th>
                  <th className="label-tech px-3 py-2 text-right">Après</th>
                  <th className="label-tech px-3 py-2 text-right">Delta</th>
                </tr>
              </thead>
              <tbody>
                {data.sites.map((s) => (
                  <tr key={s.contractSiteId} className="border-t border-ink/[0.06]">
                    <td className="px-3 py-1.5">{s.siteName}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink/60">
                      {formatEuro(s.base)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-ink/60">
                      {formatEuro(s.before)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-ink">
                      {formatEuro(s.after)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                        s.delta >= 0 ? "text-ink/80" : "text-red-700"
                      }`}
                    >
                      {s.delta >= 0 ? "+" : ""}
                      {formatEuro(s.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/15">
                  <td className="label-tech px-3 py-2" colSpan={4}>
                    Delta total annuel
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-ink">
                    {total >= 0 ? "+" : ""}
                    {formatEuro(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// Table des indices
// ============================================================

function IndicesTable({
  contractId,
  indices,
  timeline,
  onChanged,
}: {
  contractId: string;
  indices: RevisionIndex[];
  timeline: TimelineFormula[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingIdentifier, setEditingIdentifier] = useState<string | null>(null);
  const [identifierDraft, setIdentifierDraft] = useState("");
  const [addValueFor, setAddValueFor] = useState<RevisionIndex | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RevisionIndex | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Indices employés par une formule : suppression interdite.
  const usedIndexIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of timeline) {
      for (const c of f.components) set.add(c.indexId);
    }
    return set;
  }, [timeline]);

  const lastValue = (index: RevisionIndex): IndexValue | null =>
    index.values.length > 0 ? index.values[index.values.length - 1] : null;

  const saveIdentifier = async (index: RevisionIndex) => {
    const next = identifierDraft.trim();
    if (next === (index.identifier ?? "")) {
      setEditingIdentifier(null);
      return;
    }
    try {
      await api.put(`/api/contracts/${contractId}/revision-indices/${index.id}`, {
        name: index.name,
        identifier: next || null,
      });
      setEditingIdentifier(null);
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const toggleProvisional = async (index: RevisionIndex, value: IndexValue) => {
    try {
      await api.put(
        `/api/contracts/${contractId}/revision-indices/${index.id}/values/${value.id}`,
        { isProvisional: !value.isProvisional }
      );
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const deleteValue = async (index: RevisionIndex, valueId: string) => {
    try {
      await api.del(
        `/api/contracts/${contractId}/revision-indices/${index.id}/values/${valueId}`
      );
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  /**
   * Mise à jour des valeurs depuis l'API publique Insee BDM.
   * Le toast dit ce qui a changé indice par indice : sans ce détail, un clic
   * qui ne bouge rien serait indiscernable d'un clic qui corrige une valeur.
   */
  const syncFromInsee = async () => {
    setSyncing(true);
    try {
      const result = await api.post<SyncResult>(
        `/api/contracts/${contractId}/revision-indices/sync`
      );

      const parts: string[] = [];

      for (const i of result.indices) {
        const changes: string[] = [];
        if (i.added > 0) {
          changes.push(`${i.added} valeur${i.added > 1 ? "s" : ""} ajoutée${i.added > 1 ? "s" : ""}`);
        }
        if (i.confirmed > 0) {
          changes.push(`${i.confirmed} passée${i.confirmed > 1 ? "s" : ""} en définitif`);
        }
        const corrected = i.updated - i.confirmed;
        if (corrected > 0) {
          changes.push(`${corrected} corrigée${corrected > 1 ? "s" : ""}`);
        }
        parts.push(`${i.name} : ${changes.length > 0 ? changes.join(", ") : "à jour"}`);
      }

      for (const name of result.skipped) {
        parts.push(`${name} : ignoré (pas d'identifiant Insee)`);
      }

      if (parts.length > 0) {
        toast.success(parts.join(" · "));
      } else {
        toast.info("Aucun indice à mettre à jour");
      }

      for (const e of result.errors) {
        toast.error(`${e.name} : ${e.message}`);
      }

      if (result.indices.length > 0) onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const deleteIndex = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/contracts/${contractId}/revision-indices/${deleteTarget.id}`);
      toast.success(`Indice ${deleteTarget.name} supprimé`);
      setDeleteTarget(null);
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <section className="panel">
      <div className="panel-header flex items-center justify-between gap-3">
        <span className="label-tech">Indices</span>
        <ReadOnlyGate>
          <div className="flex items-center gap-1">
            <button
              onClick={syncFromInsee}
              disabled={syncing || indices.length === 0}
              title="Mettre à jour les valeurs depuis l'Insee"
              className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:cursor-not-allowed disabled:text-ink/20 disabled:hover:bg-transparent"
            >
              {syncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              title="Ajouter un indice"
              className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
            >
              <Plus size={16} />
            </button>
          </div>
        </ReadOnlyGate>
      </div>

      {indices.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink/50">
          Aucun indice enregistré sur ce contrat.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/[0.06]">
                <th className="label-tech px-4 py-2 text-left">Indice</th>
                <th className="label-tech px-4 py-2 text-left">Identifiant INSEE</th>
                <th className="label-tech px-4 py-2 text-right">Dernière valeur</th>
                <th className="label-tech px-4 py-2 text-left">Mois</th>
                <th className="label-tech px-4 py-2 text-left">Provisoire</th>
                <th className="label-tech px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {indices.map((index) => {
                const last = lastValue(index);
                const isExpanded = expanded === index.id;
                const used = usedIndexIds.has(index.id);
                return (
                  <IndexRows
                    key={index.id}
                    index={index}
                    last={last}
                    used={used}
                    isExpanded={isExpanded}
                    onToggleExpand={() =>
                      setExpanded(isExpanded ? null : index.id)
                    }
                    editingIdentifier={editingIdentifier === index.id}
                    identifierDraft={identifierDraft}
                    onStartEditIdentifier={() => {
                      setEditingIdentifier(index.id);
                      setIdentifierDraft(index.identifier ?? "");
                    }}
                    onChangeIdentifier={setIdentifierDraft}
                    onSaveIdentifier={() => saveIdentifier(index)}
                    onCancelIdentifier={() => setEditingIdentifier(null)}
                    onToggleProvisional={(value) => toggleProvisional(index, value)}
                    onDeleteValue={(valueId) => deleteValue(index, valueId)}
                    onAddValue={() => setAddValueFor(index)}
                    onDelete={() => setDeleteTarget(index)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-ink/[0.06] px-4 py-2 text-xs text-ink/50">
        Identifiant Insee = idBank de la série (ex. 001710973 pour le BT40).
        Les valeurs se mettent à jour d&apos;un clic, provisoires puis
        définitives.
      </p>

      {createOpen && (
        <CreateIndexModal
          contractId={contractId}
          onClose={() => setCreateOpen(false)}
          onCreated={onChanged}
        />
      )}

      {addValueFor && (
        <AddValueModal
          contractId={contractId}
          index={addValueFor}
          onClose={() => setAddValueFor(null)}
          onCreated={onChanged}
        />
      )}

      {deleteTarget && (
        <Modal
          title="Supprimer l'indice"
          onClose={() => setDeleteTarget(null)}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Annuler
              </Button>
              <Button size="sm" onClick={deleteIndex}>
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">
            Supprimer <strong>{deleteTarget.name}</strong> et ses{" "}
            {deleteTarget.values.length} valeur
            {deleteTarget.values.length > 1 ? "s" : ""} ? Cette action est
            définitive.
          </p>
        </Modal>
      )}
    </section>
  );
}

function IndexRows({
  index,
  last,
  used,
  isExpanded,
  onToggleExpand,
  editingIdentifier,
  identifierDraft,
  onStartEditIdentifier,
  onChangeIdentifier,
  onSaveIdentifier,
  onCancelIdentifier,
  onToggleProvisional,
  onDeleteValue,
  onAddValue,
  onDelete,
}: {
  index: RevisionIndex;
  last: IndexValue | null;
  used: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  editingIdentifier: boolean;
  identifierDraft: string;
  onStartEditIdentifier: () => void;
  onChangeIdentifier: (v: string) => void;
  onSaveIdentifier: () => void;
  onCancelIdentifier: () => void;
  onToggleProvisional: (value: IndexValue) => void;
  onDeleteValue: (valueId: string) => void;
  onAddValue: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-t border-ink/[0.06]">
        <td className="px-4 py-2">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-left text-ink transition-colors hover:text-accent"
            title={isExpanded ? "Masquer les valeurs" : "Voir toutes les valeurs"}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="font-medium">{index.name}</span>
            <span className="font-mono text-xs text-ink/40">
              ({index.values.length})
            </span>
          </button>
        </td>

        <td className="px-4 py-2">
          {editingIdentifier ? (
            <input
              autoFocus
              value={identifierDraft}
              onChange={(e) => onChangeIdentifier(e.target.value)}
              onBlur={onSaveIdentifier}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveIdentifier();
                if (e.key === "Escape") onCancelIdentifier();
              }}
              placeholder="001710973"
              className="w-40 border border-ink/20 px-2 py-1 font-mono text-xs tabular-nums"
            />
          ) : (
            <ReadOnlyGate
              fallback={
                <span className="font-mono text-xs text-ink/60">
                  {index.identifier ?? "—"}
                </span>
              }
            >
              <button
                onClick={onStartEditIdentifier}
                title="Modifier l'identifiant INSEE"
                className="font-mono text-xs text-ink/60 transition-colors hover:text-accent"
              >
                {index.identifier ?? "—"}
              </button>
            </ReadOnlyGate>
          )}
        </td>

        <td className="px-4 py-2 text-right font-mono tabular-nums">
          {last ? formatNumber(last.value, 4) : <span className="text-ink/30">—</span>}
        </td>

        <td className="px-4 py-2 font-mono text-xs text-ink/60">
          {last ? formatDay(last.date) : "—"}
        </td>

        <td className="px-4 py-2">
          {last ? (
            <ReadOnlyGate
              fallback={
                <span className="text-xs text-ink/60">
                  {last.isProvisional ? "oui" : "non"}
                </span>
              }
            >
              <label className="flex items-center gap-1.5 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={last.isProvisional}
                  onChange={() => onToggleProvisional(last)}
                />
                {last.isProvisional ? "provisoire" : "définitive"}
              </label>
            </ReadOnlyGate>
          ) : (
            <span className="text-ink/30">—</span>
          )}
        </td>

        <td className="px-4 py-2">
          <ReadOnlyGate>
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={onAddValue}
                title="Ajouter une valeur"
                className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={used ? undefined : onDelete}
                disabled={used}
                title={
                  used
                    ? "Indice utilisé par une formule de révision — retirez d'abord le terme correspondant"
                    : "Supprimer cet indice"
                }
                className="flex h-9 w-9 items-center justify-center text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-ink/20 disabled:hover:bg-transparent"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </ReadOnlyGate>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-t border-ink/[0.06] bg-ink/[0.015]">
          <td colSpan={6} className="px-4 py-2">
            {index.values.length === 0 ? (
              <p className="text-sm text-ink/50">Aucune valeur enregistrée.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {[...index.values]
                      .reverse()
                      .map((v) => (
                        <tr key={v.id} className="border-t border-ink/[0.06] first:border-t-0">
                          <td className="py-1.5 pr-4 font-mono text-xs tabular-nums text-ink/60">
                            {formatDay(v.date)}
                          </td>
                          <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-ink">
                            {formatNumber(v.value, 4)}
                          </td>
                          <td className="py-1.5 pr-4">
                            <ReadOnlyGate
                              fallback={
                                v.isProvisional ? (
                                  <span className="text-xs text-amber-700">provisoire</span>
                                ) : null
                              }
                            >
                              <label className="flex items-center gap-1.5 text-xs text-ink/60">
                                <input
                                  type="checkbox"
                                  checked={v.isProvisional}
                                  onChange={() => onToggleProvisional(v)}
                                />
                                provisoire
                              </label>
                            </ReadOnlyGate>
                          </td>
                          <td className="py-1.5 text-right">
                            <ReadOnlyGate>
                              <button
                                onClick={() => onDeleteValue(v.id)}
                                title="Supprimer cette valeur"
                                className="flex h-9 w-9 items-center justify-center text-red-600 transition-colors hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </ReadOnlyGate>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CreateIndexModal({
  contractId,
  onClose,
  onCreated,
}: {
  contractId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/contracts/${contractId}/revision-indices`, {
        name: name.trim(),
        identifier: identifier.trim() || null,
      });
      toast.success("Indice ajouté");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Ajouter un indice"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Ajouter
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label-tech mb-1 block">Nom</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ICHT-IME"
            className="w-full border border-ink/20 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-tech mb-1 block">Identifiant INSEE (optionnel)</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="001710973"
            className="w-full border border-ink/20 px-2 py-1.5 font-mono text-sm tabular-nums"
          />
        </label>
      </div>
    </Modal>
  );
}

function AddValueModal({
  contractId,
  index,
  onClose,
  onCreated,
}: {
  contractId: string;
  index: RevisionIndex;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [month, setMonth] = useState("");
  const [value, setValue] = useState("");
  const [isProvisional, setIsProvisional] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!month || !value) return;
    setSaving(true);
    try {
      // Un indice est mensuel : on enregistre la valeur au 1er du mois.
      await api.post(
        `/api/contracts/${contractId}/revision-indices/${index.id}/values`,
        { date: `${month}-01`, value: parseFloat(value), isProvisional }
      );
      toast.success(`Valeur ajoutée pour ${index.name}`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Ajouter une valeur — ${index.name}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !month || !value}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Ajouter
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label-tech mb-1 block">Mois</span>
          <input
            autoFocus
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full border border-ink/20 px-2 py-1.5 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="label-tech mb-1 block">Valeur</span>
          <input
            type="number"
            step="0.0001"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="w-full border border-ink/20 px-2 py-1.5 text-sm tabular-nums"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={isProvisional}
            onChange={(e) => setIsProvisional(e.target.checked)}
          />
          Valeur provisoire (à confirmer)
        </label>
      </div>
    </Modal>
  );
}
