"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2, Check, AlertCircle, Sparkles } from "lucide-react";

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

const PREFIX_LABEL: Record<Prefix, string> = {
  P1: "Énergie",
  P2: "Petit entretien",
  P3: "Gros entretien (GER)",
};

// HEX directs pour pouvoir moduler l'opacité dynamiquement (effet heatmap)
const PREFIX_HEX: Record<Prefix, string> = {
  P1: "#f97316", // orange-500
  P2: "#3b82f6", // blue-500
  P3: "#8b5cf6", // violet-500
};

const MONTHS_LETTER = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_SHORT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

/* ─────── Conversion UI ↔ API ─────── */

const FREQ_STEP: Record<Frequency, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };

function installmentMonth(i: number, frequency: Frequency, startMonth: number): number {
  return ((startMonth - 1 + (i - 1) * FREQ_STEP[frequency]) % 12) + 1;
}

/** Convertit la représentation API (frequency + startMonth + installments) en Map<month, pct> */
function scheduleToMap(s: Pick<Schedule, "frequency" | "startMonth" | "installments">): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 0; i < s.installments.length; i++) {
    const month = installmentMonth(i + 1, s.frequency, s.startMonth);
    m.set(month, s.installments[i].percentage);
  }
  return m;
}

/** Convertit Map<month, pct> en payload API. Déduit la frequency en best-effort. */
function mapToSchedulePayload(
  prefix: Prefix,
  enabled: boolean,
  monthsMap: Map<number, number>
): Omit<Schedule, "id"> {
  const sortedMonths = Array.from(monthsMap.keys()).sort((a, b) => a - b);
  const installments: Installment[] = sortedMonths.map((m, i) => ({
    order: i + 1,
    percentage: monthsMap.get(m) ?? 0,
  }));
  // Déduit la frequency selon le nombre de mois actifs
  let frequency: Frequency = "MENSUEL";
  if (installments.length === 1) frequency = "ANNUEL";
  else if (installments.length === 2) frequency = "SEMESTRIEL";
  else if (installments.length === 4) frequency = "TRIMESTRIEL";
  else if (installments.length === 12) frequency = "MENSUEL";
  // Sinon: garde MENSUEL par défaut (la valeur sert juste de hint, le contenu réel est dans installments)
  return {
    prefix,
    frequency,
    startMonth: sortedMonths[0] ?? 1,
    enabled,
    installments,
  };
}

/** Distribue 100 équitablement sur N mois en arrondissant à 0.01 % */
function uniformDistribution(months: number[]): Map<number, number> {
  const m = new Map<number, number>();
  if (months.length === 0) return m;
  const eq = +(100 / months.length).toFixed(2);
  const sorted = [...months].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    m.set(sorted[i], i === sorted.length - 1 ? +(100 - eq * (sorted.length - 1)).toFixed(2) : eq);
  }
  return m;
}

/* ─────── Composant principal ─────── */

interface PrefixState {
  enabled: boolean;
  monthsMap: Map<number, number>;
}

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const [state, setState] = useState<Record<Prefix, PrefixState | null>>({
    P1: null,
    P2: null,
    P3: null,
  });
  const [savingPrefix, setSavingPrefix] = useState<Prefix | null>(null);
  const [savedFlash, setSavedFlash] = useState<Prefix | null>(null);

  const { data: schedules, isLoading, mutate } = useSWR<Schedule[]>(
    `/api/contracts/${contractId}/billing-schedules`,
    fetcher
  );

  // Hydrate l'état depuis l'API
  useEffect(() => {
    if (!schedules) return;
    const next: Record<Prefix, PrefixState | null> = { P1: null, P2: null, P3: null };
    for (const p of ["P1", "P2", "P3"] as Prefix[]) {
      const existing = schedules.find((s) => s.prefix === p);
      if (existing) {
        next[p] = { enabled: existing.enabled, monthsMap: scheduleToMap(existing) };
      } else {
        // Default: P1 mensuel, P2/P3 trimestriel (Janv/Avr/Juil/Oct)
        const defaultMonths = p === "P1" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 4, 7, 10];
        next[p] = { enabled: true, monthsMap: uniformDistribution(defaultMonths) };
      }
    }
    setState(next);
  }, [schedules]);

  // Auto-save debouncé par P
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

  const scheduleSave = (p: Prefix, st: PrefixState) => {
    if (debounceRef.current[p]) clearTimeout(debounceRef.current[p]!);
    // Persist seulement si désactivé OU si total = 100% et au moins 1 mois actif
    const total = Array.from(st.monthsMap.values()).reduce((a, b) => a + b, 0);
    const totalOk = Math.abs(total - 100) < 0.01;
    if (st.enabled && (st.monthsMap.size === 0 || !totalOk)) return;
    debounceRef.current[p] = setTimeout(
      () => persist(p, mapToSchedulePayload(p, st.enabled, st.monthsMap)),
      500
    );
  };

  const updateState = (p: Prefix, next: PrefixState) => {
    setState((s) => ({ ...s, [p]: next }));
    scheduleSave(p, next);
  };

  const toggleMonth = (p: Prefix, month: number) => {
    const st = state[p];
    if (!st || !st.enabled) return;
    const newMonths = new Set(st.monthsMap.keys());
    if (newMonths.has(month)) newMonths.delete(month);
    else newMonths.add(month);
    updateState(p, { ...st, monthsMap: uniformDistribution(Array.from(newMonths)) });
  };

  const toggleEnabled = (p: Prefix) => {
    const st = state[p];
    if (!st) return;
    updateState(p, { ...st, enabled: !st.enabled });
  };

  const applyPreset = (p: Prefix, months: number[]) => {
    const st = state[p];
    if (!st || !st.enabled) return;
    updateState(p, { ...st, monthsMap: uniformDistribution(months) });
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
      {/* Légende compacte */}
      <p className="text-xs text-text-secondary">
        Cliquez sur les mois pour activer/désactiver les échéances. La répartition est égalisée automatiquement.
      </p>

      {/* Matrice 3×12 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header mois */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="w-[230px] text-xs font-medium text-text-secondary uppercase tracking-wider">Prestation</div>
          <div className="flex-1 grid grid-cols-12 gap-1.5">
            {MONTHS_LETTER.map((m, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-medium text-text-secondary uppercase tracking-wider"
                title={MONTHS_SHORT[i]}
              >
                {m}
              </div>
            ))}
          </div>
          <div className="w-[80px]" />
        </div>

        {/* Lignes P1, P2, P3 */}
        {(["P1", "P2", "P3"] as Prefix[]).map((prefix, rowIdx) => {
          const st = state[prefix];
          if (!st) return null;
          const totalPct = Array.from(st.monthsMap.values()).reduce((a, b) => a + b, 0);
          const totalOk = Math.abs(totalPct - 100) < 0.01;
          const isLast = rowIdx === 2;
          return (
            <div
              key={prefix}
              className={`flex items-center gap-3 px-5 py-3.5 ${!isLast ? "border-b border-gray-100" : ""}`}
            >
              {/* Label P + toggle */}
              <div className="w-[230px] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleEnabled(prefix)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs transition-all ${
                    st.enabled ? "shadow-sm" : "bg-gray-300"
                  }`}
                  style={st.enabled ? { backgroundColor: PREFIX_HEX[prefix] } : undefined}
                  title={st.enabled ? "Désactiver" : "Activer"}
                >
                  {prefix}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium leading-tight ${st.enabled ? "text-primary-dark" : "text-gray-400"}`}>
                    {PREFIX_LABEL[prefix]}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5 truncate">
                    {!st.enabled ? (
                      "Non facturé"
                    ) : st.monthsMap.size === 0 ? (
                      <span className="text-amber-600">Aucune échéance</span>
                    ) : (
                      <>
                        {st.monthsMap.size} échéance{st.monthsMap.size > 1 ? "s" : ""}
                        {st.monthsMap.size > 1 && ` · ${(100 / st.monthsMap.size).toFixed(st.monthsMap.size === 12 ? 2 : 0)} %`}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Cellules 12 mois */}
              <div className="flex-1 grid grid-cols-12 gap-1.5">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const month = idx + 1;
                  const pct = st.monthsMap.get(month);
                  const isOn = pct !== undefined;
                  const disabled = !st.enabled;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleMonth(prefix, month)}
                      disabled={disabled}
                      title={`${MONTHS_SHORT[month - 1]}${isOn ? ` · ${pct.toFixed(0)}%` : ""}`}
                      className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold transition-all
                        ${disabled
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : isOn
                          ? "text-white ring-1 ring-inset ring-black/5 hover:brightness-110 active:scale-[0.95] cursor-pointer"
                          : "bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500 border border-gray-100 cursor-pointer"
                        }`}
                      style={isOn && !disabled ? { backgroundColor: PREFIX_HEX[prefix] } : undefined}
                      aria-pressed={isOn}
                      aria-label={`${MONTHS_SHORT[month - 1]}${isOn ? " activé" : ""}`}
                    >
                      {isOn ? Math.round(pct) : ""}
                    </button>
                  );
                })}
              </div>

              {/* Statut sauvegarde + total */}
              <div className="w-[80px] flex items-center justify-end gap-1.5">
                {savingPrefix === prefix ? (
                  <Loader2 size={14} className="animate-spin text-text-secondary" />
                ) : savedFlash === prefix ? (
                  <Check size={14} className="text-green-600" />
                ) : st.enabled && st.monthsMap.size > 0 && !totalOk ? (
                  <span className="text-xs text-red-600 inline-flex items-center gap-1">
                    <AlertCircle size={12} />
                    {totalPct.toFixed(0)}%
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Footer presets rapides */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40 flex items-center gap-2 text-xs">
          <span className="text-text-secondary inline-flex items-center gap-1">
            <Sparkles size={12} />
            Presets rapides :
          </span>
          {(["P1", "P2", "P3"] as Prefix[]).map((p) => {
            const st = state[p];
            if (!st || !st.enabled) return null;
            return (
              <div key={p} className="inline-flex items-center gap-1">
                <span className="text-text-secondary">{p} →</span>
                {[
                  { label: "Mens.", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                  { label: "Trim.", months: [1, 4, 7, 10] },
                  { label: "Sem.", months: [1, 7] },
                  { label: "An.", months: [1] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(p, preset.months)}
                    className="px-2 py-0.5 rounded text-[11px] text-text-secondary hover:text-primary-dark hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
                {p !== "P3" && <span className="text-gray-300 mx-1">|</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
