"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2, Check, AlertCircle, Plus, Trash2, RotateCcw } from "lucide-react";

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

const FREQUENCY_LABEL: Record<Frequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const PREFIX_LABEL: Record<Prefix, string> = {
  P1: "P1 — Énergie",
  P2: "P2 — Petit entretien",
  P3: "P3 — Gros entretien (GER)",
};

const MONTHS_FR = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function defaultsFor(prefix: Prefix, contractStartMonth: number): Omit<Schedule, "id"> {
  const freq: Frequency = prefix === "P1" ? "MENSUEL" : "TRIMESTRIEL";
  const count = FREQUENCY_COUNT[freq];
  const eq = +(100 / count).toFixed(2);
  const installments: Installment[] = Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    percentage: i === count - 1 ? +(100 - eq * (count - 1)).toFixed(2) : eq, // ajuste le dernier pour que ça somme exactement à 100
  }));
  return {
    prefix,
    frequency: freq,
    startMonth: contractStartMonth,
    enabled: true,
    installments,
  };
}

function equalize(count: number): Installment[] {
  const eq = +(100 / count).toFixed(2);
  return Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    percentage: i === count - 1 ? +(100 - eq * (count - 1)).toFixed(2) : eq,
  }));
}

// Mois de l'échéance n°i (1-based) en partant de startMonth, avec un pas dépendant de la fréquence
function installmentMonth(i: number, frequency: Frequency, startMonth: number): number {
  const stepByFreq: Record<Frequency, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
  const step = stepByFreq[frequency];
  return ((startMonth - 1 + (i - 1) * step) % 12) + 1;
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

export default function ContractBillingTab({ contractId }: { contractId: string }) {
  const [activePrefix, setActivePrefix] = useState<Prefix>("P3");
  const [draft, setDraft] = useState<Record<Prefix, Omit<Schedule, "id"> | null>>({
    P1: null,
    P2: null,
    P3: null,
  });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<Prefix | null>(null);

  const { data: contract } = useSWR<ContractMeta>(`/api/contracts/${contractId}`, fetcher);
  const { data: schedules, isLoading, mutate } = useSWR<Schedule[]>(
    `/api/contracts/${contractId}/billing-schedules`,
    fetcher
  );

  const contractStartMonth = contract?.yearStartMonth ?? 7;

  // Hydrate le draft à partir des schedules existants (ou defaults si rien en base)
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
    setDraft(byPrefix);
  }, [schedules, contractStartMonth]);

  const annualBudgetByP = useMemo(() => {
    const sites = contract?.contractSites ?? [];
    const sum = (key: "amountP1" | "amountP2" | "amountP3") =>
      sites.reduce((acc, s) => acc + (s[key] ?? 0), 0);
    return { P1: sum("amountP1"), P2: sum("amountP2"), P3: sum("amountP3") } as Record<Prefix, number>;
  }, [contract]);

  if (isLoading && !schedules) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const current = draft[activePrefix];
  if (!current) return null;

  const totalPct = current.installments.reduce((s, it) => s + Number(it.percentage || 0), 0);
  const totalOk = Math.abs(totalPct - 100) < 0.01;
  const annualBudget = annualBudgetByP[activePrefix];

  const updateCurrent = (patch: Partial<Omit<Schedule, "id">>) => {
    setDraft((d) => ({ ...d, [activePrefix]: { ...d[activePrefix]!, ...patch } }));
  };

  const setFrequency = (freq: Frequency) => {
    const count = FREQUENCY_COUNT[freq];
    updateCurrent({ frequency: freq, installments: equalize(count) });
  };

  const setInstallmentPct = (idx: number, value: number) => {
    const next = current.installments.map((it, i) => (i === idx ? { ...it, percentage: value } : it));
    updateCurrent({ installments: next });
  };

  const addInstallment = () => {
    const next = [...current.installments, { order: current.installments.length + 1, percentage: 0 }];
    updateCurrent({ installments: next });
  };

  const removeInstallment = (idx: number) => {
    if (current.installments.length <= 1) return;
    const next = current.installments
      .filter((_, i) => i !== idx)
      .map((it, i) => ({ ...it, order: i + 1 }));
    updateCurrent({ installments: next });
  };

  const equalizeAll = () => {
    updateCurrent({ installments: equalize(current.installments.length) });
  };

  const resetToDefault = () => {
    updateCurrent(defaultsFor(activePrefix, contractStartMonth));
  };

  const save = async () => {
    if (current.enabled && !totalOk) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/billing-schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      if (res.ok) {
        await mutate();
        setSavedFlash(activePrefix);
        setTimeout(() => setSavedFlash(null), 1800);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Erreur lors de l'enregistrement");
      }
    } finally {
      setSaving(false);
    }
  };

  const monthsTickPositions = current.installments.map((_, i) =>
    ((installmentMonth(i + 1, current.frequency, current.startMonth) - 1) / 12) * 100
  );

  // Statut d'activation par P pour les pastilles dans le sélecteur
  const enabledByPrefix: Record<Prefix, boolean> = {
    P1: !!draft.P1?.enabled,
    P2: !!draft.P2?.enabled,
    P3: !!draft.P3?.enabled,
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur P + statut */}
      <div className="flex items-center justify-between">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          {(["P1", "P2", "P3"] as Prefix[]).map((p) => (
            <button
              key={p}
              onClick={() => setActivePrefix(p)}
              className={`relative px-4 py-1.5 text-sm rounded-md transition-colors ${
                activePrefix === p
                  ? "bg-white shadow text-primary-dark font-medium"
                  : "text-text-secondary hover:text-primary-dark"
              }`}
            >
              {p}
              <span
                className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${
                  enabledByPrefix[p] ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            </button>
          ))}
        </div>

        <p className="text-xs text-text-secondary">
          La période de répartition suit l&apos;année contractuelle (mois de début : {MONTHS_FR[contractStartMonth - 1]}).
        </p>
      </div>

      {/* Carte principale */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Header card */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-dark">{PREFIX_LABEL[activePrefix]}</h3>
            <p className="text-sm text-text-secondary mt-0.5">
              Budget annuel total :{" "}
              <span className="font-medium text-primary-dark">
                {annualBudget > 0 ? formatEuro(annualBudget) : "non renseigné"}
              </span>
            </p>
          </div>

          {/* Toggle activation */}
          <button
            type="button"
            onClick={() => updateCurrent({ enabled: !current.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              current.enabled ? "bg-accent" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={current.enabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                current.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Disabled state */}
        {!current.enabled && (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-6 text-center text-sm text-text-secondary">
            Calendrier désactivé pour ce P. Les factures pourront être saisies sans rattachement à une échéance.
          </div>
        )}

        {current.enabled && (
          <>
            {/* Fréquence — segmented control */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Fréquence
              </label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f, idx) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`px-4 py-2 text-sm transition-colors ${idx > 0 ? "border-l border-gray-200" : ""} ${
                      current.frequency === f ? "bg-accent text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {FREQUENCY_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Mois de début */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Mois de la première échéance
              </label>
              <select
                value={current.startMonth}
                onChange={(e) => updateCurrent({ startMonth: Number(e.target.value) })}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm bg-white w-44"
              >
                {MONTHS_FR.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Échéances */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Échéances ({current.installments.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={equalizeAll}
                    className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    Égaliser
                  </button>
                  <button
                    type="button"
                    onClick={addInstallment}
                    className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Mois</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {current.installments.map((it, i) => {
                      const month = installmentMonth(i + 1, current.frequency, current.startMonth);
                      const amount = annualBudget > 0 ? (annualBudget * it.percentage) / 100 : 0;
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-text-secondary">{i + 1}</td>
                          <td className="px-3 py-2 text-primary-dark">{MONTHS_FR[month - 1]}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={it.percentage}
                                onChange={(e) => setInstallmentPct(i, Number(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-right text-sm border border-gray-200 rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
                              />
                              <span className="text-text-secondary text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-primary-dark">
                            {amount > 0 ? formatEuro(amount) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeInstallment(i)}
                              disabled={current.installments.length <= 1}
                              className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 font-medium text-gray-700">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-medium ${
                            totalOk ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {totalOk ? <Check size={14} /> : <AlertCircle size={14} />}
                          {totalPct.toFixed(2)} %
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {annualBudget > 0 ? formatEuro(annualBudget) : "—"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Timeline visuelle */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Calendrier annuel
              </label>
              <div className="relative h-12 rounded-lg bg-gradient-to-r from-gray-50 to-gray-50 border border-gray-200 px-3">
                {/* axe central */}
                <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-gray-300" />
                {/* markers échéances */}
                {monthsTickPositions.map((leftPct, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                    style={{ left: `calc(${leftPct}% + 0.75rem - ${(leftPct / 100) * 1.5}rem)` }}
                  >
                    <div className="w-3 h-3 rounded-full bg-accent border-2 border-white shadow-sm" />
                  </div>
                ))}
                {/* labels mois */}
                <div className="absolute inset-x-3 bottom-0.5 flex justify-between text-[9px] text-gray-400 pointer-events-none">
                  {MONTHS_FR.map((m, i) => (
                    <span key={i} className="w-0 -translate-x-1/2">
                      {m[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs text-text-secondary hover:text-primary-dark inline-flex items-center gap-1"
          >
            <RotateCcw size={12} />
            Réinitialiser aux valeurs par défaut
          </button>
          <div className="flex items-center gap-3">
            {savedFlash === activePrefix && (
              <span className="text-xs text-green-600 inline-flex items-center gap-1">
                <Check size={14} />
                Enregistré
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || (current.enabled && !totalOk)}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
