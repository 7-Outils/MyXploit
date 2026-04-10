"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { AlertCircle } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { cn } from "@/lib/utils";
import type { Frequency } from "@/components/energy/TelereleveBuildingChart";

// ECharts is canvas-based — load client-side only.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/**
 * ClimateCorrectedChart — Now repurposed as the ENERGY SIGNATURE chart.
 *
 * Plots the monthly ratio kWh / DJU (consumption per degree-day) for the
 * selected building. A stable ratio month after month means the building
 * is reacting normally to outside temperature; a drift upward signals a
 * problem (boiler losing efficiency, thermostat misconfigured, leak…).
 *
 * Data is provided by the parent (TelereleveChartsSection) — both this
 * chart and the GRDF chart on the left consume the same monthlyData
 * fetched once at the section level.
 */

export interface MonthlyAnalyticsPoint {
  month: string; // "YYYY-MM"
  nc: number; // kWh
  nbPrime: number; // kWh
  djr: number; // degree-days réels
}

interface Props {
  siteId: string;
  siteName: string;
  /** Months overlapping the date range, fetched by the parent */
  monthlyData: MonthlyAnalyticsPoint[];
  /** Daily {date, nc, djr} reported by the sibling chart — used when
      frequency === "day" to plot kWh/DJU at day granularity. */
  dailyData?: { date: string; nc: number; djr: number }[];
  /** Current frequency — drives whether to use dailyData or monthlyData. */
  frequency?: Frequency;
  /** When false, shows an empty state asking to configure a weather station. */
  hasDjuContractuel: boolean;
  /** When true, omit the surrounding ChartCard. */
  noCard?: boolean;
  /** When true, hide the local KPI grid. */
  hideKpis?: boolean;
}

function monthLabel(month: string): string {
  // "2026-03" → "Mars 26"
  const [y, mo] = month.split("-").map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function dailyLabel(date: string): string {
  // "2026-04-09" → "09 avr."
  const [y, mo, dd] = date.split("-").map(Number);
  const d = new Date(y, mo - 1, dd);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function ClimateCorrectedChart({
  siteId,
  siteName,
  monthlyData,
  dailyData,
  frequency,
  hasDjuContractuel,
  noCard = false,
  hideKpis = false,
}: Props) {
  // Helper: wrap content in a ChartCard unless the parent already provides
  // its own (noCard mode).
  const wrap = (children: React.ReactNode) =>
    noCard ? (
      <>{children}</>
    ) : (
      <ChartCard
        title="Signature énergétique"
        subtitle="Conso par degré-jour (kWh/DJU)"
        className="w-full h-full"
      >
        {children}
      </ChartCard>
    );
  // Compute the ratio kWh / DJU. When frequency is "day" and dailyData is
  // available, plot one point per day; otherwise aggregate by month.
  const ratioPoints = useMemo(() => {
    const useDaily = frequency === "day" && dailyData && dailyData.length > 0;
    if (useDaily) {
      return dailyData!
        .filter((d) => d.djr > 0)
        .map((d) => ({
          key: d.date,
          label: dailyLabel(d.date),
          ratio: d.nc / d.djr,
          nc: d.nc,
          djr: d.djr,
        }));
    }
    return monthlyData
      .filter((m) => m.djr > 0)
      .map((m) => ({
        key: m.month,
        label: monthLabel(m.month),
        ratio: m.nc / m.djr,
        nc: m.nc,
        djr: m.djr,
      }));
  }, [monthlyData, dailyData, frequency]);

  // KPIs
  const stats = useMemo(() => {
    if (ratioPoints.length === 0) return null;
    const ratios = ratioPoints.map((p) => p.ratio);
    const sum = ratios.reduce((s, r) => s + r, 0);
    const avg = sum / ratios.length;
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    // Simple drift indicator: linear regression slope (positive = drift up)
    let slope = 0;
    if (ratios.length >= 2) {
      const n = ratios.length;
      const xs = ratios.map((_, i) => i);
      const meanX = xs.reduce((s, x) => s + x, 0) / n;
      const meanY = avg;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ratios[i] - meanY);
        den += (xs[i] - meanX) ** 2;
      }
      slope = den === 0 ? 0 : num / den;
    }
    // Drift relative to the average, expressed as % per month
    const driftPct = avg > 0 ? Math.round((slope / avg) * 1000) / 10 : 0;
    return { avg, min, max, driftPct };
  }, [ratioPoints]);

  // ─── Empty states ───────────────────────────────────────────────────

  if (!hasDjuContractuel) {
    return wrap(
      <div className="flex flex-col items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">
            Station météo introuvable
          </p>
        </div>
        <p className="text-xs text-amber-800">
          Aucune station météo ni code postal valide n&apos;est associé à{" "}
          <strong>{siteName}</strong>. Renseignez le code postal pour activer
          le calcul de la signature énergétique.
        </p>
      </div>
    );
  }

  if (ratioPoints.length === 0) {
    return wrap(
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <AlertCircle size={28} className="text-gray-300 mb-2" />
        <p className="text-sm font-medium text-gray-700">
          Aucun mois exploitable sur la période
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center max-w-md">
          Aucune donnée avec à la fois de la consommation chauffage et des DJU
          sur cette période. Élargissez la plage ou attendez la prochaine
          synchronisation des données.
        </p>
      </div>
    );
  }

  // ─── Chart ─────────────────────────────────────────────────────────

  const chartOption = {
    grid: { left: 60, right: 24, top: 32, bottom: 64 },
    legend: {
      data: ["kWh/DJU"],
      bottom: 8,
      left: "center",
      icon: "circle",
      textStyle: { color: "#374151", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(17, 24, 39, 0.95)",
      borderWidth: 0,
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: { dataIndex: number }[]) => {
        if (!params || params.length === 0) return "";
        const p = ratioPoints[params[0].dataIndex];
        if (!p) return "";
        return `
          <div style="font-weight:600;margin-bottom:4px">${p.label}</div>
          <div style="font-size:11px;line-height:1.5">
            Conso : <strong>${Math.round(p.nc).toLocaleString("fr-FR")} kWh</strong><br/>
            DJU : <strong>${Math.round(p.djr).toLocaleString("fr-FR")}</strong><br/>
            <span style="color:#fbbf24">Ratio : <strong>${p.ratio.toFixed(1)} kWh/DJU</strong></span>
          </div>
        `;
      },
    },
    xAxis: {
      type: "category",
      data: ratioPoints.map((p) => p.label),
      boundaryGap: true,
      axisLine: { lineStyle: { color: "#d1d5db" } },
      axisLabel: { color: "#6b7280", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      name: "kWh/DJU",
      min: 0,
      nameTextStyle: { color: "#6b7280", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
      axisLabel: {
        color: "#6b7280",
        fontSize: 11,
        formatter: (v: number) => v.toFixed(0),
      },
    },
    series: [
      {
        name: "kWh/DJU",
        type: "line",
        data: ratioPoints.map((p) => Math.round(p.ratio * 10) / 10),
        lineStyle: { color: "#fbbf24", width: 2.5 },
        itemStyle: { color: "#fbbf24" },
        symbol: "circle",
        symbolSize: 7,
        smooth: true,
        areaStyle: { color: "rgba(251, 191, 36, 0.12)" },
      },
    ],
  };

  // Drift tone: red if drifting up, green if drifting down, neutral otherwise
  const driftTone =
    !stats || Math.abs(stats.driftPct) < 1
      ? "neutral"
      : stats.driftPct > 0
      ? "danger"
      : "success";
  const driftClass =
    driftTone === "danger"
      ? "text-red-600"
      : driftTone === "success"
      ? "text-green-600"
      : "text-primary-dark";

  return wrap(
    <>
      {!hideKpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
                Ratio moyen
              </p>
              <span
                title="Consommation moyenne par degré-jour sur les mois affichés. Plus c'est stable d'un mois à l'autre, plus le bâtiment est sain."
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold text-text-secondary bg-gray-100 hover:bg-gray-200 cursor-help"
              >
                i
              </span>
            </div>
            <p className="text-xl font-semibold text-primary-dark mt-1">
              {stats ? `${stats.avg.toFixed(1)} kWh/DJU` : "—"}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
              Min / Max
            </p>
            <p className="text-xl font-semibold text-primary-dark mt-1">
              {stats
                ? `${stats.min.toFixed(0)} – ${stats.max.toFixed(0)}`
                : "—"}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
                Dérive
              </p>
              <span
                title="Tendance du ratio mois après mois. Positif (rouge) = dérive à la hausse, signe d'un équipement qui se dégrade ou d'un comportement à corriger. Négatif (vert) = amélioration."
                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold text-text-secondary bg-gray-100 hover:bg-gray-200 cursor-help"
              >
                i
              </span>
            </div>
            <p className={cn("text-xl font-semibold mt-1", driftClass)}>
              {stats === null
                ? "—"
                : `${stats.driftPct > 0 ? "+" : ""}${stats.driftPct}%/mois`}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <ReactECharts
        option={chartOption}
        style={{ height: 420, width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </>
  );
}
