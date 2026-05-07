"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2, Check, Plus, Trash2, RotateCcw, AlertCircle } from "lucide-react";

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

const FREQUENCY_COUNT: Record<Frequency, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };
const FREQUENCY_LABEL: Record<Frequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};
const PREFIX_LABEL: Record<Prefix, string> = {
  P1: "Énergie",
  P2: "Petit entretien",
  P3: "Gros entretien (GER)",
};
const PREFIX_COLOR: Record<Prefix, { bg: string; ring: string; text: string }> = {
  P1: { bg: "bg-orange-500", ring: "ring-orange-200", text: "text-orange-600" },
  P2: { bg: "bg-blue-500", ring: "ring-blue-200", text: "text-blue-600" },
  P3: { bg: "bg-purple-500", ring: "ring-purple-200", text: "text-purple-600" },
};

const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_SHORT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

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
  // Répartit 100 en N entiers en distribuant le reste (1 par installment)
  // Ex: 100/3 = 33,33,34. 100/12 = 8.33 → on garde 2 décimales mais on met le reste sur le dernier.
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
  if (!isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function isAllUniform(installments: Installment[]): boolean {
  if (installments.length <= 1) return true;
  const first = installments[0].percentage;
  return installments.every((it) => Math.abs(it.percentage - first) < 0.5);
}

/* ─────────────── Single schedule card ─────────────── */

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
  const totalPct = draft.installments.reduce((s, it) => s + Number(it.percentage || 0), 0);
  const totalOk = Math.abs(totalPct - 100) < 0.01;
  const uniform = isAllUniform(draft.installments);
  const colors = PREFIX_COLOR[prefix];

  // Grid columns adaptive selon nombre d'échéances
  const cols = useMemo(() => {
    const n = draft.installments.length;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n <= 4) return 4;
    if (n === 12) return 6; // 2 lignes de 6 sur grand écran
    return Math.min(n, 6);
  }, [draft.installments.length]);

  const setFrequency = (f: Frequency) =>
    onChange({ ...draft, frequency: f, installments: equalize(FREQUENCY_COUNT[f]) });

  const setStartMonth = (m: number) => onChange({ ...draft, startMonth: m });

  const setInstallmentPct = (i: number, value: number) => {
    const v = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
    const next = draft.installments.map((it, j) => (j === i ? { ...it, percentage: v } : it));
    onChange({ ...draft, installments: next });
  };

  const addInstallment = () => {
    const next = [...draft.installments, { order: draft.installments.length + 1, percentage: 0 }];
    onChange({ ...draft, installments: next });
  };

  const removeInstallment = (i: number) => {
    if (draft.installments.length <= 1) return;
    const next = draft.installments.filter((_, j) => j !== i).map((it, j) => ({ ...it, order: j + 1 }));
    onChange({ ...draft, installments: next });
  };

  const equalizeNow = () => onChange({ ...draft, installments: equalize(draft.installments.length) });

  return (
    <div
      className={`rounded-xl border bg-white transition-shadow ${
        draft.enabled ? "border-gray-200 hover:shadow-soft" : "border-gray-200 opacity-70"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm ${
              draft.enabled ? colors.bg : "bg-gray-300"
            }`}
          >
            {prefix}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-primary-dark leading-tight">{PREFIX_LABEL[prefix]}</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {budget > 0 ? (
                <>
                  Budget annuel <span className="font-medium text-primary-dark">{formatEuro(budget)}</span>
                </>
              ) : (
                "Budget annuel non renseigné"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {saving && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          {saved && !saving && (
            <span className="text-xs text-green-600 inline-flex items-center gap-0.5 animate-fade-in">
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
            aria-label="Activer/désactiver le calendrier"
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
        <div className="px-5 pb-5">
          <p className="text-sm text-text-secondary border-t border-gray-100 pt-4">
            Calendrier désactivé. Les factures de ce P seront saisies sans rattachement à une échéance.
          </p>
        </div>
      ) : (
        <>
          {/* Sélecteurs : fréquence + mois de démarrage */}
          <div className="px-5 flex items-center gap-3 flex-wrap pb-3">
            <label className="inline-flex items-center gap-2">
              <span className="text-xs text-text-secondary">Fréquence</span>
              <select
                value={draft.frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="h-8 pl-3 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2">
              <span className="text-xs text-text-secondary">Démarrage</span>
              <select
                value={draft.startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="h-8 pl-3 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {MONTHS_LONG.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex-1" />

            {!uniform && (
              <button
                type="button"
                onClick={equalizeNow}
                className="text-xs text-accent hover:underline inline-flex items-center gap-1 transition-opacity"
              >
                <RotateCcw size={12} />
                Répartir uniformément
              </button>
            )}
          </div>

          {/* Micro-barre de progression */}
          <div className="mx-5 h-0.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                totalOk ? "bg-green-500" : totalPct > 100 ? "bg-red-500" : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(100, totalPct)}%` }}
            />
          </div>

          {/* Grille d'échéances */}
          <div className="p-5 pt-3">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {draft.installments.map((it, i) => {
                const month = installmentMonth(i + 1, draft.frequency, draft.startMonth);
                const amount = budget > 0 ? (budget * it.percentage) / 100 : 0;
                return (
                  <div
                    key={i}
                    className="group relative rounded-lg border border-gray-200 hover:border-gray-300 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all bg-white"
                  >
                    {/* Mois en label */}
                    <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                      {MONTHS_SHORT[month - 1]}
                    </div>
                    {/* Input % */}
                    <div className="px-2.5 pb-1 flex items-baseline gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        inputMode="decimal"
                        value={it.percentage}
                        onChange={(e) => setInstallmentPct(i, Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full text-lg font-semibold text-primary-dark bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-text-secondary">%</span>
                    </div>
                    {/* Montant € */}
                    <div className="px-2.5 pb-2 text-[11px] text-text-secondary tabular-nums">
                      {formatEuro(amount)}
                    </div>

                    {/* Bouton supprimer (visible au hover) */}
                    {draft.installments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstallment(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Supprimer l'échéance"
                        aria-label="Supprimer l'échéance"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer: ajouter + total */}
            <div className="flex items-center justify-between mt-3">
              <button
                type="button"
                onClick={addInstallment}
                className="text-xs text-accent hover:underline inline-flex items-center gap-1"
              >
                <Plus size={12} />
                Ajouter une échéance
              </button>
              <span
                className={`text-xs inline-flex items-center gap-1 font-medium tabular-nums ${
                  totalOk ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalOk ? <Check size={12} /> : <AlertCircle size={12} />}
                Total {totalPct.toFixed(2)} %
                {!totalOk && (
                  <span className="text-text-secondary font-normal">
                    {totalPct > 100
                      ? `(excédent ${(totalPct - 100).toFixed(2)}%)`
                      : `(manque ${(100 - totalPct).toFixed(2)}%)`}
                  </span>
                )}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────── Main tab ─────────────── */

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

  // Auto-save debouncé par P; ne déclenche le PUT que si total = 100%
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
    const totalOk =
      Math.abs(next.installments.reduce((s, it) => s + Number(it.percentage || 0), 0) - 100) < 0.01;
    if (next.enabled && !totalOk) return; // attend que la répartition soit valide
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
      <p className="text-xs text-text-secondary">
        Configurez le calendrier de facturation pour chaque P. Les modifications sont enregistrées dès que la répartition atteint 100 %.
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
