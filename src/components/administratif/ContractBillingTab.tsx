"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2, Check, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Prefix = "P1" | "P2" | "P3";
type Frequency = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";

interface Installment {
  order: number;
  percentage: number;
}

interface Schedule {
  id: string;
  prefix: Prefix;
  frequency: Frequency;
  startMonth: number;
  enabled: boolean;
  installments: Installment[];
}

interface ContractMeta {
  yearStartMonth?: number;
  contractSites?: Array<{ amountP1?: number | null; amountP2?: number | null; amountP3?: number | null }>;
}

const FREQUENCY_COUNT: Record<Frequency, number> = {
  MENSUEL: 12,
  TRIMESTRIEL: 4,
  SEMESTRIEL: 2,
  ANNUEL: 1,
};

const FREQUENCY_SHORT: Record<Frequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trim.",
  SEMESTRIEL: "Sem.",
  ANNUEL: "Annuel",
};

const PREFIX_LABEL: Record<Prefix, string> = {
  P1: "Énergie",
  P2: "Petit entretien",
  P3: "Gros entretien (GER)",
};

const PREFIX_COLOR: Record<Prefix, string> = {
  P1: "#f59e0b",
  P2: "#3b82f6",
  P3: "#8b5cf6",
};

const MONTHS_FR = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function defaultsFor(prefix: Prefix, contractStartMonth: number): Omit<Schedule, "id"> {
  const freq: Frequency = prefix === "P1" ? "MENSUEL" : "TRIMESTRIEL";
  return {
    prefix,
    frequency: freq,
    startMonth: contractStartMonth,
    enabled: true,
    installments: equalize(FREQUENCY_COUNT[freq]),
  };
}

function equalize(count: number): Installment[] {
  const eq = +(100 / count).toFixed(2);
  return Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    percentage: i === count - 1 ? +(100 - eq * (count - 1)).toFixed(2) : eq,
  }));
}

function installmentMonth(i: number, frequency: Frequency, startMonth: number): number {
  const stepByFreq: Record<Frequency, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
  return ((startMonth - 1 + (i - 1) * stepByFreq[frequency]) % 12) + 1;
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

/* ─────────────────────── Single schedule card ─────────────────────── */

function ScheduleCard({
  prefix,
  draft,
  budget,
  onChange,
  saving,
  saved,
}: {
  prefix: Prefix;
  draft: Omit<Schedule, "id">;
  budget: number;
  onChange: (next: Omit<Schedule, "id">) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const totalPct = draft.installments.reduce((s, it) => s + Number(it.percentage || 0), 0);
  const totalOk = Math.abs(totalPct - 100) < 0.01;
  const installmentAmount = budget > 0 ? budget / draft.installments.length : 0;
  const isUniform = draft.installments.every((it) => Math.abs(it.percentage - draft.installments[0].percentage) < 0.5);

  const setFrequency = (f: Frequency) => {
    onChange({ ...draft, frequency: f, installments: equalize(FREQUENCY_COUNT[f]) });
  };

  const tickPositions = useMemo(
    () =>
      draft.installments.map((_, i) =>
        ((installmentMonth(i + 1, draft.frequency, draft.startMonth) - 1) / 12) * 100
      ),
    [draft.installments, draft.frequency, draft.startMonth]
  );

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        draft.enabled
          ? "bg-white border-gray-200"
          : "bg-gray-50 border-gray-200 border-dashed"
      }`}
    >
      {/* Header: prefix + label + budget + toggle */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: draft.enabled ? PREFIX_COLOR[prefix] : "#cbd5e1" }}
          >
            {prefix}
          </div>
          <div>
            <h3 className={`text-base font-semibold ${draft.enabled ? "text-primary-dark" : "text-gray-400"}`}>
              {PREFIX_LABEL[prefix]}
            </h3>
            <p className="text-xs text-text-secondary">
              {budget > 0 ? `${formatEuro(budget)} / an` : "Budget annuel non renseigné"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saving && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          {saved && !saving && (
            <span className="text-xs text-green-600 inline-flex items-center gap-0.5">
              <Check size={14} />
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...draft, enabled: !draft.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.enabled ? "bg-accent" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={draft.enabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                draft.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {!draft.enabled ? (
        <p className="text-sm text-text-secondary">
          Pas de calendrier — les factures pour ce P seront saisies librement.
        </p>
      ) : (
        <>
          {/* Choix UNIQUE = fréquence */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm w-full">
            {(Object.keys(FREQUENCY_SHORT) as Frequency[]).map((f, idx) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`flex-1 px-3 py-2 transition-colors ${idx > 0 ? "border-l border-gray-200" : ""} ${
                  draft.frequency === f
                    ? "bg-accent text-white font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {FREQUENCY_SHORT[f]}
              </button>
            ))}
          </div>

          {/* Résumé en plain text */}
          <p className="text-sm text-primary-dark mt-3">
            <span className="font-medium">{draft.installments.length}</span> acompte{draft.installments.length > 1 ? "s" : ""} de{" "}
            <span className="font-medium">
              {isUniform ? `${(100 / draft.installments.length).toFixed(draft.installments.length === 12 ? 2 : 0)} %` : "% variables"}
            </span>
            {budget > 0 && isUniform && (
              <span className="text-text-secondary"> · {formatEuro(installmentAmount)} chacun</span>
            )}
          </p>

          {/* Timeline visuelle */}
          <div className="relative h-10 mt-3">
            {/* axe */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-200" />
            {/* labels mois (12 cases) */}
            <div className="absolute inset-0 flex pointer-events-none">
              {MONTHS_FR.map((m, i) => (
                <div key={i} className="flex-1 flex items-end justify-center">
                  <span className="text-[9px] text-gray-400">{m[0]}</span>
                </div>
              ))}
            </div>
            {/* dots */}
            {tickPositions.map((leftPct, i) => (
              <div
                key={i}
                className="absolute top-[18%] -translate-x-1/2"
                style={{
                  left: `calc(${leftPct}% + ${(50 / 12)}%)`, // centre dans la case du mois
                }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: PREFIX_COLOR[prefix] }}
                />
              </div>
            ))}
          </div>

          {/* Personnaliser */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="mt-4 text-xs text-text-secondary hover:text-primary-dark inline-flex items-center gap-1"
          >
            {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Personnaliser
          </button>

          {advancedOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {/* Mois de début */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-text-secondary w-32">Premier acompte</label>
                <select
                  value={draft.startMonth}
                  onChange={(e) => onChange({ ...draft, startMonth: Number(e.target.value) })}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm bg-white"
                >
                  {MONTHS_FR.map((m, i) => (
                    <option key={i} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Échéances éditables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-secondary">Répartition par acompte</span>
                  {!totalOk && (
                    <span className="text-xs text-red-600 inline-flex items-center gap-1">
                      <AlertCircle size={12} />
                      Total {totalPct.toFixed(2)} % (doit être 100)
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {draft.installments.map((it, i) => {
                    const month = installmentMonth(i + 1, draft.frequency, draft.startMonth);
                    const amount = budget > 0 ? (budget * it.percentage) / 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-text-secondary w-8">#{i + 1}</span>
                        <span className="text-primary-dark w-14">{MONTHS_FR[month - 1]}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={it.percentage}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            const next = draft.installments.map((x, j) =>
                              j === i ? { ...x, percentage: v } : x
                            );
                            onChange({ ...draft, installments: next });
                          }}
                          className="w-20 px-2 py-1 text-right text-sm border border-gray-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                        <span className="text-xs text-text-secondary w-3">%</span>
                        <span className="flex-1 text-right text-text-secondary text-xs">
                          {amount > 0 ? formatEuro(amount) : ""}
                        </span>
                        {draft.installments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = draft.installments
                                .filter((_, j) => j !== i)
                                .map((x, j) => ({ ...x, order: j + 1 }));
                              onChange({ ...draft, installments: next });
                            }}
                            className="p-1 text-gray-300 hover:text-red-500"
                            title="Supprimer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        installments: [
                          ...draft.installments,
                          { order: draft.installments.length + 1, percentage: 0 },
                        ],
                      })
                    }
                    className="text-xs text-accent hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Plus size={12} />
                    Ajouter un acompte
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────── Main tab ─────────────────────── */

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const [drafts, setDrafts] = useState<Record<Prefix, Omit<Schedule, "id"> | null>>({
    P1: null,
    P2: null,
    P3: null,
  });
  const [savingPrefix, setSavingPrefix] = useState<Prefix | null>(null);
  const [savedFlash, setSavedFlash] = useState<Prefix | null>(null);

  const { data: contract } = useSWR<ContractMeta>(`/api/contracts/${contractId}`, fetcher);
  const { data: schedules, isLoading, mutate } = useSWR<Schedule[]>(
    `/api/contracts/${contractId}/billing-schedules`,
    fetcher
  );

  const contractStartMonth = contract?.yearStartMonth ?? 7;

  // Hydrate
  useEffect(() => {
    if (!schedules) return;
    const byPrefix: Record<Prefix, Omit<Schedule, "id"> | null> = { P1: null, P2: null, P3: null };
    for (const p of ["P1", "P2", "P3"] as Prefix[]) {
      const existing = schedules.find((s) => s.prefix === p);
      byPrefix[p] = existing
        ? {
            prefix: p,
            frequency: existing.frequency,
            startMonth: existing.startMonth,
            enabled: existing.enabled,
            installments: existing.installments.map((it) => ({ order: it.order, percentage: it.percentage })),
          }
        : defaultsFor(p, contractStartMonth);
    }
    setDrafts(byPrefix);
  }, [schedules, contractStartMonth]);

  const annualBudgetByP = useMemo(() => {
    const sites = contract?.contractSites ?? [];
    const sum = (key: "amountP1" | "amountP2" | "amountP3") =>
      sites.reduce((acc, s) => acc + (s[key] ?? 0), 0);
    return { P1: sum("amountP1"), P2: sum("amountP2"), P3: sum("amountP3") } as Record<Prefix, number>;
  }, [contract]);

  // Auto-save debounced par P (500ms après le dernier changement, et seulement si total = 100%)
  const debounceRef = useRef<Record<Prefix, ReturnType<typeof setTimeout> | null>>({
    P1: null,
    P2: null,
    P3: null,
  });

  const persist = async (p: Prefix, payload: Omit<Schedule, "id">) => {
    setSavingPrefix(p);
    try {
      const res = await fetch(`/api/contracts/${contractId}/billing-schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await mutate();
        setSavedFlash(p);
        setTimeout(() => setSavedFlash((cur) => (cur === p ? null : cur)), 1500);
      }
    } finally {
      setSavingPrefix((cur) => (cur === p ? null : cur));
    }
  };

  const handleChange = (p: Prefix, next: Omit<Schedule, "id">) => {
    setDrafts((d) => ({ ...d, [p]: next }));
    if (debounceRef.current[p]) clearTimeout(debounceRef.current[p]!);
    // Skip save si désactivé+vide ou si total != 100
    const totalOk = Math.abs(next.installments.reduce((s, it) => s + Number(it.percentage || 0), 0) - 100) < 0.01;
    if (next.enabled && !totalOk) return; // attend que l'utilisateur corrige
    debounceRef.current[p] = setTimeout(() => persist(p, next), 500);
  };

  if (isLoading && !schedules) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hint en haut */}
      <p className="text-xs text-text-secondary">
        Choisissez la fréquence de facturation pour chaque P. Les changements sont enregistrés automatiquement.
      </p>

      {(["P1", "P2", "P3"] as Prefix[]).map((p) => {
        const d = drafts[p];
        if (!d) return null;
        return (
          <ScheduleCard
            key={p}
            prefix={p}
            draft={d}
            budget={annualBudgetByP[p]}
            onChange={(next) => handleChange(p, next)}
            saving={savingPrefix === p}
            saved={savedFlash === p}
          />
        );
      })}
    </div>
  );
}
