"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  TrendingDown,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  TelereleveBuildingChart,
  type Frequency,
  type SiteSummary,
} from "@/components/energy/TelereleveBuildingChart";
import { ClimateCorrectedChart } from "@/components/energy/ClimateCorrectedChart";

function formatKwh(value: number): string {
  if (value >= 5000) {
    return `${(value / 1000).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} MWh`;
  }
  return `${Math.round(value).toLocaleString("fr-FR")} kWh`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FREQUENCY_ORDER: Frequency[] = ["hour", "day", "week", "month", "year"];
const FREQUENCY_LABELS: Record<Frequency, string> = {
  hour: "Horaire",
  day: "Journalière",
  week: "Hebdomadaire",
  month: "Mensuelle",
  year: "Annuelle",
};

/**
 * TelereleveChartsSection — Wrapper that owns the *shared* state between the
 * raw GRDF / Enedis chart (TelereleveBuildingChart) and the climate-corrected
 * performance chart (ClimateCorrectedChart) below it:
 *
 *   - The list of sites of the contract that have a PCE/PDL configured
 *   - The currently selected site
 *   - The date range
 *
 * The two charts are siblings, not parent/child, so when the user switches
 * building or picks a new date preset on the upper chart, the lower chart
 * follows automatically.
 */

interface Props {
  contractId: string;
}

function todayIso(): string {
  // Use local date to avoid the UTC-vs-local off-by-one in Paris winter
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfCurrentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TelereleveChartsSection({ contractId }: Props) {
  // ─── Sites of the contract that have a PCE/PDL ──────────────────────
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingSites(true);
    fetch(`/api/contracts/${contractId}/sites`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteSummary[]) => {
        if (cancelled) return;
        const withMeter = (data || []).filter(
          (s) => s.pce !== null || s.pdl !== null
        );
        setSites(withMeter);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  // ─── Shared state — selected site + date range + frequency ─────────
  // Default to "this month so far" with monthly frequency — both charts
  // share these so the user only ever picks them once.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(startOfCurrentMonthIso());
  const [dateTo, setDateTo] = useState<string>(todayIso());
  const [frequency, setFrequency] = useState<Frequency>("month");
  // Reported by the GRDF chart based on the actual data shape — used to
  // disable frequency options finer than what's available.
  const [naturalGranularity, setNaturalGranularity] =
    useState<Frequency>("day");

  const handleNaturalGranularity = useCallback((g: Frequency) => {
    setNaturalGranularity(g);
    // If the user previously picked something finer, bump it up
    setFrequency((prev) =>
      FREQUENCY_ORDER.indexOf(prev) < FREQUENCY_ORDER.indexOf(g) ? g : prev
    );
  }, []);

  // ─── Analytics monthly data — fetched once at the section level ─────
  // Both charts (GRDF on the left, signature ratio on the right) consume
  // the same monthly aggregates: nc, nbPrime, djr per month. We fetch
  // here once and pass them down so we don't double-call /api/consumptions/analytics.
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [siteContext, setSiteContext] = useState<{
    nb: number | null;
    djuContractuel: number | null;
    djuContractuelExplicit: number | null;
    stationMeteo: string | null;
    months: { month: string; nc: number; nbPrime: number; djr: number }[];
  } | null>(null);

  useEffect(() => {
    if (!selectedSiteId) {
      setSiteContext(null);
      return;
    }
    let cancelled = false;
    setAnalyticsLoading(true);

    // Compute the heating-season years that overlap [dateFrom, dateTo]
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setAnalyticsLoading(false);
      return;
    }
    const yearOf = (d: Date) =>
      d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    const startYear = yearOf(start);
    const endYear = yearOf(end);
    // Always fetch one extra heating season BEFORE the visible range so the
    // KPIs can compute "vs N-1" by looking at the same months one year ago.
    const years: number[] = [];
    for (let y = startYear - 1; y <= endYear; y++) years.push(y);

    Promise.all(
      years.map((y) =>
        fetch(`/api/consumptions/analytics?siteId=${selectedSiteId}&year=${y}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((responses) => {
        if (cancelled) return;
        let merged: typeof siteContext = null;
        for (const resp of responses) {
          if (!resp || !resp.sites || resp.sites.length === 0) continue;
          const sitePerf = resp.sites.find(
            (s: { siteId: string }) => s.siteId === selectedSiteId
          );
          if (!sitePerf) continue;
          if (!merged) {
            merged = {
              nb: sitePerf.nb,
              djuContractuel: sitePerf.djuContractuel,
              djuContractuelExplicit: sitePerf.djuContractuelExplicit,
              stationMeteo: sitePerf.stationMeteo,
              months: [...sitePerf.monthlyData],
            };
          } else {
            const seen = new Set(merged.months.map((m) => m.month));
            for (const m of sitePerf.monthlyData) {
              if (!seen.has(m.month)) {
                merged.months.push(m);
                seen.add(m.month);
              }
            }
          }
        }
        if (merged) {
          merged.months.sort((a, b) => a.month.localeCompare(b.month));
        }
        setSiteContext(merged);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSiteId, dateFrom, dateTo]);

  // Months that overlap [dateFrom, dateTo]. A month is included as soon as
  // any of its days falls within the range — this handles partial months
  // correctly since data is stored at day granularity anyway.
  const monthlyData = useMemo(() => {
    if (!siteContext) return [];
    return siteContext.months.filter((m) => {
      const [y, mo] = m.month.split("-").map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const monthStartIso = `${m.month}-01`;
      const monthEndIso = `${m.month}-${String(lastDay).padStart(2, "0")}`;
      return monthStartIso <= dateTo && monthEndIso >= dateFrom;
    });
  }, [siteContext, dateFrom, dateTo]);

  // Same months but shifted exactly 12 months back — used to compute
  // year-over-year deltas (NC vs N-1, DJU vs N-1).
  const monthlyDataN1 = useMemo(() => {
    if (!siteContext) return [];
    const wantedKeys = new Set(
      monthlyData.map((m) => {
        const [y, mo] = m.month.split("-").map(Number);
        return `${y - 1}-${String(mo).padStart(2, "0")}`;
      })
    );
    return siteContext.months.filter((m) => wantedKeys.has(m.month));
  }, [siteContext, monthlyData]);

  // Shared KPIs computed once at the section level — passed down so the
  // dashboard renders one row of KPIs (not duplicated per chart).
  const sharedKpis = useMemo(() => {
    if (monthlyData.length === 0) return null;
    const totalNc = monthlyData.reduce((s, m) => s + m.nc, 0);
    const totalNbPrime = monthlyData.reduce((s, m) => s + m.nbPrime, 0);
    const totalDjr = monthlyData.reduce((s, m) => s + m.djr, 0);

    const totalNcN1 = monthlyDataN1.reduce((s, m) => s + m.nc, 0);
    const totalDjrN1 = monthlyDataN1.reduce((s, m) => s + m.djr, 0);

    const ncDeltaPct =
      totalNcN1 > 0 ? ((totalNc - totalNcN1) / totalNcN1) * 100 : null;
    const ncDeltaAbs = totalNcN1 > 0 ? totalNc - totalNcN1 : null;

    const djrDeltaPct =
      totalDjrN1 > 0 ? ((totalDjr - totalDjrN1) / totalDjrN1) * 100 : null;
    const djrDeltaAbs = totalDjrN1 > 0 ? totalDjr - totalDjrN1 : null;

    const climateDelta = totalNbPrime > 0 ? totalNc - totalNbPrime : null;
    const climateDeltaPct =
      totalNbPrime > 0 ? (totalNc - totalNbPrime) / totalNbPrime * 100 : null;

    return {
      totalNc,
      totalNbPrime,
      totalDjr,
      ncDeltaPct,
      ncDeltaAbs,
      djrDeltaPct,
      djrDeltaAbs,
      climateDelta,
      climateDeltaPct,
    };
  }, [monthlyData, monthlyDataN1]);

  // ─── Date preset definitions (used for both buttons and active state) ─
  const datePresets = useMemo(
    () => [
      { id: "this-month", label: "Ce mois", from: startOfCurrentMonthIso() },
      { id: "30d", label: "30 j", from: daysAgoIso(30) },
      { id: "90d", label: "90 j", from: daysAgoIso(90) },
      { id: "1y", label: "1 an", from: daysAgoIso(365) },
      { id: "3y", label: "3 ans", from: daysAgoIso(365 * 3) },
    ],
    []
  );

  const today = todayIso();
  const activePresetId = useMemo(() => {
    if (dateTo !== today) return null;
    return datePresets.find((p) => p.from === dateFrom)?.id ?? null;
  }, [dateFrom, dateTo, today, datePresets]);

  // Auto-select the first site once the list is loaded
  useEffect(() => {
    if (selectedSiteId === null && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  // ─── Loading / empty states for the contract's site list ────────────
  if (loadingSites) {
    return (
      <ChartCard title="Suivi télérelevé" subtitle="Données du distributeur">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (sites.length === 0) {
    return (
      <ChartCard title="Suivi télérelevé" subtitle="Données du distributeur">
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <Wifi size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            Aucun site avec un PCE ou PDL configuré sur ce contrat
          </p>
          <p className="text-xs text-gray-500 mt-1 text-center max-w-md">
            Renseignez le PCE (gaz) ou le PDL (électricité) sur la fiche
            de chaque bâtiment pour activer la télérelève.
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shared toolbar — building + frequency + date range + presets.
          Everything that affects BOTH charts lives here, so the user
          only ever picks them once. */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[260px]">
          <label className="text-xs font-medium text-text-secondary">
            Bâtiment
          </label>
          <select
            value={selectedSiteId || ""}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.pce ? ` · PCE ${s.pce}` : ""}
                {s.pdl ? ` · PDL ${s.pdl}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">
            Fréquence
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {FREQUENCY_ORDER.map((f) => {
              const isFinerThanData =
                FREQUENCY_ORDER.indexOf(f) <
                FREQUENCY_ORDER.indexOf(naturalGranularity);
              return (
                <option key={f} value={f} disabled={isFinerThanData}>
                  {FREQUENCY_LABELS[f]}
                  {isFinerThanData ? " (non disponible)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex gap-1">
          {datePresets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setDateFrom(preset.from);
                  setDateTo(today);
                }}
                className={cn(
                  "px-2.5 py-2 rounded-lg border text-xs transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Single unified card containing the shared KPI strip and the two
          charts side by side. Sub-components render in noCard + hideKpis
          mode so they don't double-wrap or duplicate the KPIs. */}
      <ChartCard
        title="Suivi télérelevé"
        subtitle="Données brutes du distributeur (GRDF / Enedis) et performance climatique"
      >
        {/* Shared KPIs */}
        {sharedKpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SharedKpi
              label="NC totale"
              value={formatKwh(sharedKpis.totalNc)}
              deltaPct={sharedKpis.ncDeltaPct}
              deltaAbs={sharedKpis.ncDeltaAbs}
              deltaUnit="kWh"
            />
            <SharedKpi
              label="N'B"
              value={
                sharedKpis.totalNbPrime > 0
                  ? formatKwh(sharedKpis.totalNbPrime)
                  : "—"
              }
              tooltip="Cible théorique ajustée à la météo réelle. Formule : NB × (DJR / DJC) où DJR = degrés-jours réels et DJC = degrés-jours contractuels."
            />
            <SharedKpi
              label="Écart NC vs N'B"
              value={
                sharedKpis.climateDeltaPct === null
                  ? "—"
                  : `${sharedKpis.climateDeltaPct > 0 ? "+" : ""}${sharedKpis.climateDeltaPct.toFixed(1)}%`
              }
              subtle={
                sharedKpis.climateDelta === null
                  ? undefined
                  : `${sharedKpis.climateDelta >= 0 ? "+" : "−"}${formatKwh(Math.abs(sharedKpis.climateDelta))}`
              }
              tone={
                sharedKpis.climateDeltaPct === null
                  ? "neutral"
                  : sharedKpis.climateDeltaPct > 5
                  ? "danger"
                  : sharedKpis.climateDeltaPct < -5
                  ? "success"
                  : "neutral"
              }
              tooltip="Écart entre la consommation réelle et la cible climatique. Positif (rouge) = dépassement, négatif (vert) = économie. Seuil de tolérance ±5%."
            />
            <SharedKpi
              label="DJU réels"
              value={
                sharedKpis.totalDjr > 0
                  ? `${Math.round(sharedKpis.totalDjr).toLocaleString("fr-FR")} DJU`
                  : "—"
              }
              deltaPct={sharedKpis.djrDeltaPct}
              deltaAbs={sharedKpis.djrDeltaAbs}
              deltaUnit="DJU"
              tooltip="Somme des degrés-jours unifiés (base 18°C) sur la période. Le DJU mesure la rigueur du climat — plus il fait froid, plus le DJU est élevé."
            />
          </div>
        )}

        {/* 2-column chart layout on desktop, stacks on smaller screens.
            min-w-0 prevents one chart from pushing the other past 50%. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          <div className="min-w-0">
            <TelereleveBuildingChart
              sites={sites}
              selectedSiteId={selectedSiteId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              frequency={frequency}
              onNaturalGranularityChange={handleNaturalGranularity}
              monthlyData={monthlyData}
              noCard
              hideKpis
            />
          </div>

          {selectedSite && (
            <div className="min-w-0">
              <ClimateCorrectedChart
                siteId={selectedSite.id}
                siteName={selectedSite.name}
                monthlyData={monthlyData}
                hasNb={siteContext?.nb != null && siteContext.nb > 0}
                hasDjuContractuel={
                  siteContext?.djuContractuel != null &&
                  siteContext.djuContractuel > 0
                }
                noCard
                hideKpis
              />
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared KPI sub-component used in the unified dashboard card.
// ────────────────────────────────────────────────────────────────────────

interface SharedKpiProps {
  label: string;
  value: string;
  subtle?: string;
  tone?: "neutral" | "success" | "danger";
  tooltip?: string;
  /** When set, the KPI shows a "vs N-1" line below the main value with both
      the percentage and the absolute difference. The unit (kWh / DJU) is
      used to format the absolute difference. */
  deltaPct?: number | null;
  deltaAbs?: number | null;
  deltaUnit?: "kWh" | "DJU";
}

function SharedKpi({
  label,
  value,
  subtle,
  tone = "neutral",
  tooltip,
  deltaPct,
  deltaAbs,
  deltaUnit,
}: SharedKpiProps) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
      ? "text-green-600"
      : "text-primary-dark";

  // Auto-tone for the N-1 delta if no explicit tone was passed
  const deltaTone =
    deltaPct === null || deltaPct === undefined
      ? "neutral"
      : deltaPct > 5
      ? "danger"
      : deltaPct < -5
      ? "success"
      : "neutral";
  const deltaClass =
    deltaTone === "danger"
      ? "text-red-600"
      : deltaTone === "success"
      ? "text-green-600"
      : "text-text-secondary";
  const DeltaIcon =
    deltaPct === null || deltaPct === undefined
      ? null
      : deltaPct > 0
      ? TrendingUp
      : TrendingDown;

  const formatDeltaAbs = (abs: number) => {
    if (deltaUnit === "DJU") {
      return `${Math.round(Math.abs(abs)).toLocaleString("fr-FR")} DJU`;
    }
    return formatKwh(Math.abs(abs));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </p>
        {tooltip && (
          <span
            title={tooltip}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold text-text-secondary bg-gray-100 hover:bg-gray-200 cursor-help"
            aria-label={tooltip}
          >
            i
          </span>
        )}
      </div>
      <p className={cn("text-xl font-semibold mt-1", valueClass)}>{value}</p>
      {subtle && (
        <p className="text-[10px] text-text-secondary mt-0.5">{subtle}</p>
      )}
      {deltaPct !== undefined && deltaPct !== null && deltaAbs !== null && deltaAbs !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-[11px] font-medium",
            deltaClass
          )}
        >
          {DeltaIcon && <DeltaIcon size={12} />}
          <span>
            {deltaPct > 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% vs N-1
          </span>
          <span className="text-text-secondary font-normal">
            ({deltaAbs >= 0 ? "+" : "−"}
            {formatDeltaAbs(deltaAbs)})
          </span>
        </div>
      )}
      {deltaPct === null && (
        <p className="text-[11px] text-text-secondary mt-1">
          Pas de données N-1
        </p>
      )}
    </div>
  );
}
