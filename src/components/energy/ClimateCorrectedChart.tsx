"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { cn } from "@/lib/utils";

// ECharts is canvas-based — load client-side only.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/**
 * ClimateCorrectedChart — Monthly comparison of real consumption (NC) vs the
 * climate-corrected target (N'B = NB × DJR/DJC) for a single building.
 *
 * Reuses the existing /api/consumptions/analytics endpoint which already
 * computes N'B server-side. The chart filters analytics months to the
 * date range chosen on the parent (TelereleveChartsSection) — typically
 * the same range as the raw GRDF chart above it.
 *
 * Empty states:
 * - Site has no NB or no DJU contractuel → "Données contractuelles manquantes"
 *   with a link to edit the building's engagement page
 * - Selected range covers less than one full month → "Sélectionnez au moins
 *   un mois complet"
 * - Site has all the data but DJR is missing on consumptions → debug message
 *   pointing to the Climat & DJU sync (which now runs nightly via cron)
 */

interface MonthlyPoint {
  month: string;       // "YYYY-MM"
  label?: string;      // "Jan", "Fév", etc. — may be absent on older API responses
  nc: number;          // kWh
  nbPrime: number;     // kWh
  djr: number;         // degree-days réels
}

const MONTH_LABELS_FR = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];

/** Convert "YYYY-MM" → "Janv. 26" — locally, no Date timezone hazards */
function monthKeyToLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split("-");
  const m = parseInt(mStr, 10) - 1;
  const yShort = yStr.slice(2);
  if (Number.isNaN(m) || m < 0 || m > 11) return monthKey;
  return `${MONTH_LABELS_FR[m]} ${yShort}`;
}

interface SitePerformance {
  siteId: string;
  siteName: string;
  nb: number | null;
  nbUnit: "PCS" | "UTILE" | null;
  /** Resolved DJU contractuel — explicit value if set, else trentenaire of stationMeteo / postalCode */
  djuContractuel: number | null;
  /** Raw djuContractuel from DB before resolver fallback (null = auto-filled from trentenaire) */
  djuContractuelExplicit: number | null;
  stationMeteo: string | null;
  nc: number;
  nbPrime: number;
  monthlyData: MonthlyPoint[];
}

interface AnalyticsResponse {
  year: number;
  sites: SitePerformance[];
}

interface Props {
  siteId: string;
  siteName: string;
  /** Start of the date range to display (YYYY-MM-DD) */
  dateFrom: string;
  /** End of the date range to display (YYYY-MM-DD) */
  dateTo: string;
}

function formatKwh(value: number): string {
  if (value >= 5000) {
    return `${(value / 1000).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} MWh`;
  }
  return `${Math.round(value).toLocaleString("fr-FR")} kWh`;
}

/**
 * Compute the list of "heating season years" (the year that ends June 30th)
 * needed to cover a date range. The heating season analytics endpoint
 * is keyed on this year — for example year=2026 returns July 2025 → June 2026.
 */
function heatingSeasonYears(from: string, to: string): number[] {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  // A given calendar date belongs to heating season Y where:
  //   if month >= 7 (July+) → Y = year + 1
  //   else                  → Y = year
  const yearOf = (d: Date) =>
    d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();

  const startYear = yearOf(start);
  const endYear = yearOf(end);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  return years;
}

export function ClimateCorrectedChart({
  siteId,
  siteName,
  dateFrom,
  dateTo,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<SitePerformance | null>(null);

  // ─── Fetch analytics for every heating season covering the range ────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const years = heatingSeasonYears(dateFrom, dateTo);
    if (years.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      years.map((y) =>
        fetch(`/api/consumptions/analytics?siteId=${siteId}&year=${y}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((responses) => {
        if (cancelled) return;
        // Merge: take the first non-null response as the canonical site (for
        // nb / djuContractuel / nbUnit / stationMeteo) and concatenate every
        // month from every season.
        let merged: SitePerformance | null = null;
        for (const resp of responses as (AnalyticsResponse | null)[]) {
          if (!resp || !resp.sites || resp.sites.length === 0) continue;
          const sitePerf = resp.sites.find((s) => s.siteId === siteId);
          if (!sitePerf) continue;
          if (!merged) {
            merged = { ...sitePerf, monthlyData: [...sitePerf.monthlyData] };
          } else {
            // Concatenate months, dedupe by month key (last write wins,
            // which is fine because the same month always has the same value)
            const seen = new Set(merged.monthlyData.map((m) => m.month));
            for (const m of sitePerf.monthlyData) {
              if (!seen.has(m.month)) {
                merged.monthlyData.push(m);
                seen.add(m.month);
              }
            }
          }
        }
        if (merged) {
          merged.monthlyData.sort((a, b) => a.month.localeCompare(b.month));
        }
        setSite(merged);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les données analytiques");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId, dateFrom, dateTo]);

  // ─── Filter months to the [dateFrom, dateTo] range ──────────────────
  // Compare via YYYY-MM strings to stay timezone-safe (mixing
  // `new Date("2025-01-01")` which parses as UTC midnight with
  // `new Date(2025, 0, 1)` which is local midnight produces a 1-2h offset
  // in Paris winter and silently excludes the matching month).
  const filteredMonths = useMemo(() => {
    if (!site) return [];
    const fromYm = dateFrom.substring(0, 7); // "YYYY-MM"
    const toYm = dateTo.substring(0, 7);
    return site.monthlyData.filter(
      (m) => m.month >= fromYm && m.month <= toYm
    );
  }, [site, dateFrom, dateTo]);

  // ─── KPIs ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalNc = filteredMonths.reduce((s, m) => s + m.nc, 0);
    const totalNbPrime = filteredMonths.reduce((s, m) => s + m.nbPrime, 0);
    const delta = totalNc - totalNbPrime;
    const deltaPercent =
      totalNbPrime > 0 ? Math.round((delta / totalNbPrime) * 1000) / 10 : null;
    return { totalNc, totalNbPrime, delta, deltaPercent };
  }, [filteredMonths]);

  // ─── ECharts option ─────────────────────────────────────────────────
  const chartOption = useMemo(() => {
    if (filteredMonths.length === 0) return null;

    const maxKwh = filteredMonths.reduce(
      (m, x) => Math.max(m, x.nc, x.nbPrime),
      0
    );
    const yUnit: "kWh" | "MWh" = maxKwh >= 5000 ? "MWh" : "kWh";
    const toDisplay = (kwh: number) =>
      yUnit === "MWh" ? Number((kwh / 1000).toFixed(2)) : Math.round(kwh);

    const months = filteredMonths.map((m) => m.label || monthKeyToLabel(m.month));
    const ncValues = filteredMonths.map((m) => toDisplay(m.nc));
    const nbPrimeValues = filteredMonths.map((m) => toDisplay(m.nbPrime));

    return {
      grid: { left: 64, right: 24, top: 32, bottom: 56 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const point = filteredMonths[idx];
          if (!point) return "";
          const delta = point.nc - point.nbPrime;
          const deltaPct =
            point.nbPrime > 0 ? (delta / point.nbPrime) * 100 : null;
          const deltaColor =
            deltaPct === null
              ? "#9ca3af"
              : deltaPct > 5
              ? "#ef4444"
              : deltaPct < -5
              ? "#22c55e"
              : "#fbbf24";
          const deltaSign = delta >= 0 ? "+" : "";
          const labelStr = point.label || monthKeyToLabel(point.month);
          return `
            <div style="font-weight:600;margin-bottom:6px">${labelStr}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b"></span>
              Conso réelle :&nbsp;<strong>${formatKwh(point.nc)}</strong>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#9ca3af"></span>
              Cible (N'B) :&nbsp;<strong>${formatKwh(point.nbPrime)}</strong>
            </div>
            <div style="color:${deltaColor};font-size:11px">
              Écart : ${deltaSign}${formatKwh(Math.abs(delta))}${deltaPct !== null ? ` (${deltaSign}${deltaPct.toFixed(1)}%)` : ""}
            </div>
          `;
        },
      },
      legend: {
        data: ["Conso réelle", "Cible climatique"],
        bottom: 8,
        left: "center",
        textStyle: { color: "#374151", fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: months,
        boundaryGap: true,
        axisLine: { lineStyle: { color: "#d1d5db" } },
        axisLabel: { color: "#6b7280", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: yUnit,
        nameTextStyle: { color: "#6b7280", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
        axisLabel: {
          color: "#6b7280",
          fontSize: 11,
          formatter: (v: number) =>
            yUnit === "MWh"
              ? v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
              : v.toLocaleString("fr-FR"),
        },
      },
      series: [
        {
          name: "Conso réelle",
          type: "bar",
          data: ncValues,
          itemStyle: { color: "#f59e0b", borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 28,
          // Grouped (side-by-side) with the target bar — ECharts groups
          // bars sharing the same xAxis category by default. The small
          // negative gap pulls the two series tighter together visually.
          barGap: "10%",
        },
        {
          name: "Cible climatique",
          type: "bar",
          data: nbPrimeValues,
          itemStyle: { color: "#9ca3af", borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 28,
        },
      ],
    };
  }, [filteredMonths]);

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ChartCard
        title="Performance vs cible climatique"
        subtitle="Conso réelle vs cible climatique"
        className="w-full h-full"
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard
        title="Performance vs cible climatique"
        subtitle="Conso réelle vs cible climatique"
        className="w-full h-full"
      >
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <AlertCircle size={28} className="text-red-300 mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </ChartCard>
    );
  }

  // Empty state: site has no NB. We don't ask for djuContractuel anymore —
  // the analytics endpoint auto-fills it from the COSTIC trentenaire of the
  // site's station/postalCode. The only blocker now is a missing NB.
  const missingNb = !site || site.nb === null;
  const missingDjuc = !site || site.djuContractuel === null;
  if (missingNb || missingDjuc) {
    return (
      <ChartCard
        title="Performance vs cible climatique"
        subtitle="Conso réelle vs cible climatique"
        className="w-full h-full"
      >
        <div className="flex flex-col items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-900">
              {missingNb
                ? "Niveau de Base manquant"
                : "Station météo introuvable"}
            </p>
          </div>
          <p className="text-xs text-amber-800">
            {missingNb ? (
              <>
                Pour comparer la consommation à la cible climatique de{" "}
                <strong>{siteName}</strong>, vous devez renseigner le{" "}
                <strong>NB (Niveau de Base annuel en MWh)</strong> sur la
                fiche du bâtiment.
              </>
            ) : (
              <>
                Aucune station météo ni code postal n&apos;est associé à{" "}
                <strong>{siteName}</strong>. Renseignez le code postal du
                bâtiment pour activer le calcul automatique du DJU contractuel.
              </>
            )}
          </p>
          <Link
            href={`/buildings/${siteId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 hover:text-amber-700 underline mt-1"
          >
            <Settings size={14} />
            Ouvrir la fiche bâtiment →
          </Link>
        </div>
      </ChartCard>
    );
  }

  // Empty state: range too short to contain a full month
  if (filteredMonths.length === 0) {
    return (
      <ChartCard
        title="Performance vs cible climatique"
        subtitle="Conso réelle vs cible climatique"
        className="w-full h-full"
      >
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <AlertCircle size={28} className="text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">
            Aucun mois complet sur la période sélectionnée
          </p>
          <p className="text-xs text-gray-500 mt-1 text-center max-w-md">
            La cible climatique est calculée par mois entier. Élargissez la
            plage de dates au-dessus pour voir la comparaison NC vs N&apos;B.
          </p>
        </div>
      </ChartCard>
    );
  }

  // Empty state: months are present but DJR is missing on all of them →
  // the analytics endpoint returned nbPrime = 0 because DJR/DJC fallback
  // kicks in only when both are present.
  const allNbPrimeZero = filteredMonths.every((m) => m.nbPrime === 0);
  if (allNbPrimeZero) {
    return (
      <ChartCard
        title="Performance vs cible climatique"
        subtitle="Conso réelle vs cible climatique"
        className="w-full h-full"
      >
        <div className="flex flex-col items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-blue-600" />
            <p className="text-sm font-semibold text-blue-900">
              Cible climatique en cours de calcul
            </p>
          </div>
          <p className="text-xs text-blue-800">
            Les DJU réels ne sont pas encore disponibles pour cette période.
            Ils sont synchronisés automatiquement chaque nuit. Si la situation
            persiste, lancez une synchronisation manuelle depuis l&apos;onglet
            <strong> Climat &amp; DJU</strong>.
          </p>
        </div>
      </ChartCard>
    );
  }

  // Normal render — chart + KPIs
  const deltaTone =
    kpis.deltaPercent === null
      ? "neutral"
      : kpis.deltaPercent > 5
      ? "danger"
      : kpis.deltaPercent < -5
      ? "success"
      : "neutral";
  const DeltaIcon =
    kpis.deltaPercent === null
      ? null
      : kpis.deltaPercent > 0
      ? TrendingUp
      : TrendingDown;

  return (
    <ChartCard
      title="Performance vs cible climatique"
      subtitle="Conso réelle vs cible climatique"
      className="w-full h-full"
    >
      {/* KPIs — formula and source live in tooltips, not in the labels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Kpi label="Conso réelle" value={formatKwh(kpis.totalNc)} />
        <Kpi
          label="Cible climatique"
          value={formatKwh(kpis.totalNbPrime)}
          tooltip={
            site && site.djuContractuelExplicit === null && site.djuContractuel != null
              ? `Cible = NB × (DJR / DJC). DJC = ${site.djuContractuel} DJU/an, trentenaire ${site.stationMeteo ? `de la station ${site.stationMeteo}` : "inféré du code postal"}. Vous pouvez personnaliser le DJU contractuel sur la fiche bâtiment.`
              : "Conso théorique ajustée à la météo réelle de la période. Formule : NB × (DJR / DJC) où DJR = DJU réels, DJC = DJU contractuels."
          }
        />
        <Kpi
          label="Écart"
          value={
            kpis.deltaPercent === null
              ? "—"
              : `${kpis.deltaPercent > 0 ? "+" : ""}${kpis.deltaPercent}%`
          }
          subtle={
            kpis.deltaPercent === null
              ? undefined
              : `${kpis.delta >= 0 ? "+" : "−"}${formatKwh(Math.abs(kpis.delta))}`
          }
          tone={deltaTone}
          icon={DeltaIcon}
          tooltip="Écart entre la consommation réelle et la cible climatique. Positif (rouge) = dépassement, négatif (vert) = économie. Seuil de tolérance ±5%."
        />
      </div>

      {/* Chart */}
      {chartOption && (
        <ReactECharts
          option={chartOption}
          style={{ height: 360, width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}

    </ChartCard>
  );
}

// ────────────────────────────────────────────────────────────────────────
// KPI sub-component (same shape as in TelereleveBuildingChart)
// ────────────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  subtle?: string;
  tone?: "neutral" | "success" | "danger";
  icon?: LucideIcon | null;
  /** When provided, shows a small (i) icon next to the label that reveals
      this text on hover via the native HTML title attribute. */
  tooltip?: string;
}

function Kpi({
  label,
  value,
  subtle,
  tone = "neutral",
  icon: Icon,
  tooltip,
}: KpiProps) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
      ? "text-green-600"
      : "text-primary-dark";
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
      <div className="flex items-center gap-1.5 mt-1">
        {Icon && <Icon size={16} className={valueClass} />}
        <p className={cn("text-xl font-semibold", valueClass)}>{value}</p>
      </div>
      {subtle && (
        <p className="text-[10px] text-text-secondary mt-0.5">{subtle}</p>
      )}
    </div>
  );
}
