"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Wifi,
} from "lucide-react";

import { ChartCard } from "@/components/dashboard/chart-card";
import {
  TelereleveBuildingChart,
  type Frequency,
  type SiteSummary,
} from "@/components/energy/TelereleveBuildingChart";
import { DivergenceChart } from "@/components/energy/DivergenceChart";

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
  /** Determines how NB values are aligned to months.
   *  CIVIL: NB for year YYYY covers Jan 1 – Dec 31 YYYY.
   *  HEATING_SEASON (default): NB for season YYYY-YYYY+1 covers Jul 1 – Jun 30. */
  yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
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

export function TelereleveChartsSection({ contractId, yearType = "HEATING_SEASON" }: Props) {
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


  // Export function reported by TelereleveBuildingChart — rendered as a
  // button in the shared toolbar so the user has one consistent action bar.
  const exportFnRef = useRef<(() => void) | null>(null);
  const [canExport, setCanExport] = useState(false);
  const handleExportFnChange = useCallback((fn: (() => void) | null) => {
    exportFnRef.current = fn;
    setCanExport(fn !== null);
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
  const [djuMonthly, setDjuMonthly] = useState<Map<string, number>>(new Map());

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
    // CIVIL: chaque mois appartient à son année calendaire (Jan-Dec).
    // HEATING_SEASON: la saison démarre en juillet, donc jul–déc YYYY
    // appartient à la saison YYYY+1 (ex. jul 2023 → saison 2024).
    const yearOf = (d: Date) =>
      yearType === "CIVIL"
        ? d.getFullYear()
        : d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    const startYear = yearOf(start);
    const endYear = yearOf(end);
    // Always fetch one extra year BEFORE the visible range so the
    // KPIs can compute "vs N-1" by looking at the same months one year ago.
    const years: number[] = [];
    for (let y = startYear - 1; y <= endYear; y++) years.push(y);

    // Fetch analytics AND DJU in parallel for each year
    const analyticsPromises = years.map((y) =>
      fetch(`/api/consumptions/analytics?siteId=${selectedSiteId}&year=${y}&yearType=${yearType}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );
    const djuPromises = years.map((y) =>
      fetch(`/api/dju?siteId=${selectedSiteId}&year=${y}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );

    Promise.all([Promise.all(analyticsPromises), Promise.all(djuPromises)])
      .then(([analyticsResponses, djuResponses]) => {
        if (cancelled) return;

        // Build DJU lookup: month → dju value (from API, not from consumption records)
        const djuByMonth = new Map<string, number>();
        for (const djuResp of djuResponses) {
          if (!djuResp?.sites) continue;
          const siteDju = djuResp.sites.find(
            (s: { siteId: string }) => s.siteId === selectedSiteId
          );
          if (!siteDju?.monthlyData) continue;
          for (const m of siteDju.monthlyData) {
            if (m.dju > 0) djuByMonth.set(m.month, m.dju);
          }
        }

        // Merge analytics responses
        let merged: typeof siteContext = null;
        for (const resp of analyticsResponses) {
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

        // Inject fresh DJU values from the DJU API into monthly data
        if (merged) {
          for (const m of merged.months) {
            const freshDjr = djuByMonth.get(m.month);
            if (freshDjr !== undefined) {
              m.djr = freshDjr;
            }
          }
          merged.months.sort((a, b) => a.month.localeCompare(b.month));
        }
        setSiteContext(merged);
        setDjuMonthly(djuByMonth);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSiteId, dateFrom, dateTo, yearType]);

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
      <ChartCard
        title={sharedKpis ? `Consommation GRDF — ${formatKwh(sharedKpis.totalNc)}` : "Consommation GRDF"}
        subtitle={
          sharedKpis?.ncDeltaPct != null
            ? `${sharedKpis.ncDeltaPct > 0 ? "+" : ""}${sharedKpis.ncDeltaPct.toFixed(1)}% vs N-1`
            : undefined
        }
        action={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={selectedSiteId || ""}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="h-7 px-2 rounded border border-gray-200 text-xs bg-white"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="h-7 px-2 rounded border border-gray-200 text-xs bg-white"
            >
              {FREQUENCY_ORDER.map((f) => {
                const disabled = FREQUENCY_ORDER.indexOf(f) < FREQUENCY_ORDER.indexOf(naturalGranularity);
                return <option key={f} value={f} disabled={disabled}>{FREQUENCY_LABELS[f]}</option>;
              })}
            </select>
            <select
              value={activePresetId || "custom"}
              onChange={(e) => {
                const preset = datePresets.find((p) => p.id === e.target.value);
                if (preset) { setDateFrom(preset.from); setDateTo(today); }
              }}
              className="h-7 px-2 rounded border border-gray-200 text-xs bg-white"
            >
              {datePresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              {!activePresetId && <option value="custom">Personnalisé</option>}
            </select>
            <button
              onClick={() => exportFnRef.current?.()}
              disabled={!canExport}
              className="h-7 px-2 rounded border border-gray-200 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1"
            >
              <Download size={11} />CSV
            </button>
          </div>
        }
      >
        <TelereleveBuildingChart
          sites={sites}
          selectedSiteId={selectedSiteId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          frequency={frequency}
          onNaturalGranularityChange={handleNaturalGranularity}

          onExportFnChange={handleExportFnChange}
          monthlyData={monthlyData}
          djuByMonth={djuMonthly}
          noCard
          hideKpis
        />
      </ChartCard>

      {/* Divergence: exploitant vs télérelève */}
      {selectedSiteId && (
        <ChartCard title="Écart exploitant vs télérelève" subtitle="Comparaison des relevés manuels exploitant avec les données GRDF">
          <DivergenceChart
            siteId={selectedSiteId}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </ChartCard>
      )}
    </div>
  );
}

