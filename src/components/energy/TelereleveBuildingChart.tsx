"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Wifi,
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { cn } from "@/lib/utils";

// ECharts is canvas-based and would explode at SSR — load it client-side only.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

/**
 * TelereleveBuildingChart — Single-site, single-energy interactive chart of
 * raw distributor (GRDF / Enedis) consumption data, with site picker,
 * date range filter, KPIs and ECharts brush slider for zooming.
 *
 * Mounts inside the Télérelève tab of the Energy module. Reads only records
 * where meterName === null (= synced from a distributor API), never the
 * exploitant Excel imports.
 */

export interface SiteSummary {
  id: string;
  name: string;
  pce: string | null;
  pdl: string | null;
}

interface ConsumptionRecord {
  id: string;
  energyType: string;
  usage: string;
  period: string;
  quantity: number;
  cost: number | null;
  meterName: string | null;
  djuReel: number | null;
}

const ENERGY_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
};

const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#3b82f6",
  FIOUL: "#78716c",
  BOIS: "#84cc16",
  RESEAU_CHALEUR: "#ef4444",
};

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatKwh(value: number): string {
  if (value >= 5000) {
    return `${(value / 1000).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} MWh`;
  }
  return `${Math.round(value).toLocaleString("fr-FR")} kWh`;
}

// Display granularity for the chart bars. Hour requires Enedis CDC,
// day/week/month/year work for both GRDF informatives and Enedis.
export type Frequency = "hour" | "day" | "week" | "month" | "year";

/** One row from /api/consumptions/analytics monthlyData per heating season,
    already filtered down to the months strictly contained in the parent's
    date range. */
export interface MonthlyAnalyticsPoint {
  month: string; // "YYYY-MM"
  nc: number; // kWh
  nbPrime: number; // kWh — climate-corrected target
  djr: number; // degree-days réels
}

interface Props {
  /** Sites of the current contract — used to resolve the selected site
      label / PCE / PDL for the chart title and CSV filename */
  sites: SiteSummary[];
  /** Currently selected site (controlled by the parent) */
  selectedSiteId: string | null;
  /** Date range — controlled by the parent so a sibling chart can share it */
  dateFrom: string;
  dateTo: string;
  /** Frequency — controlled by the parent so it can be in the shared toolbar */
  frequency: Frequency;
  /** Notify the parent of the finest granularity available in the records,
      so the parent can disable finer options in its frequency dropdown. */
  onNaturalGranularityChange?: (g: Frequency) => void;
  /** Monthly analytics (NC, N'B, DJR) for the selected site, fetched and
      filtered by the parent. When provided AND the user is in monthly
      frequency, the chart shows the climate-corrected target as a second
      bar series and the KPIs add Cible (N'B) + Écart. */
  monthlyData?: MonthlyAnalyticsPoint[];
  /** Fresh DJU values by month from the /api/dju endpoint */
  djuByMonth?: Map<string, number>;
  /** When true, omit the surrounding ChartCard (the parent provides one).
      Useful when this chart is rendered inside a unified dashboard card. */
  noCard?: boolean;
  /** When true, hide the local KPI grid because the parent renders shared
      KPIs above the chart instead. */
  hideKpis?: boolean;
  /** Reports daily {date, nc, djr} for the CHAUFFAGE/MIXTE records in the
      current date range — consumed by the sibling signature chart. */
  onDailyDataChange?: (data: { date: string; nc: number; djr: number }[]) => void;
  /** Reports the CSV export function to the parent so it can render the
      button in the shared toolbar. Receives null when there's nothing to export. */
  onExportFnChange?: (fn: (() => void) | null) => void;
}

export function TelereleveBuildingChart({
  sites,
  selectedSiteId,
  dateFrom,
  dateTo,
  frequency,
  onNaturalGranularityChange,
  monthlyData,
  djuByMonth,
  noCard = false,
  hideKpis = false,
  onDailyDataChange,
  onExportFnChange,
}: Props) {
  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  // ─── Records for the selected site (SWR cache) ──────────────────────
  // Fenêtre fixe de 5 ans en arrière, le chart filtre ensuite côté client
  // sur [dateFrom, dateTo]. SWR avec keepPreviousData garde l'ancien chart
  // affiché pendant le re-fetch d'un nouveau site → pas de blank.
  const recordsKey = useMemo(() => {
    if (!selectedSiteId) return null;
    const today = new Date();
    const wideStart = new Date(today);
    wideStart.setUTCFullYear(wideStart.getUTCFullYear() - 5);
    const startIso = wideStart.toISOString().split("T")[0];
    const endIso = today.toISOString().split("T")[0];
    return `/api/consumptions?siteId=${selectedSiteId}&start=${startIso}&end=${endIso}&lite=1`;
  }, [selectedSiteId]);

  const { data: rawRecords, isLoading: isFirstLoad } = useSWR<ConsumptionRecord[]>(
    recordsKey,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 60_000 }
  );

  const records = useMemo(
    // Distributor data only (sync-imported, no exploitant meter name)
    () => (rawRecords ?? []).filter((c) => c.meterName === null),
    [rawRecords]
  );
  // Ne montre le spinner QUE pour le 1er chargement (pas de previous data
  // à afficher) — sinon keepPreviousData rend l'ancien chart visible.
  const loadingRecords = isFirstLoad && !rawRecords;

  // ─── Energy types available for the selected site ────────────────────
  const availableEnergies = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => set.add(r.energyType));
    return Array.from(set).sort();
  }, [records]);

  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);

  // Auto-select first energy when records load / change
  useEffect(() => {
    if (availableEnergies.length === 0) {
      setSelectedEnergy(null);
      return;
    }
    if (!selectedEnergy || !availableEnergies.includes(selectedEnergy)) {
      setSelectedEnergy(
        availableEnergies.includes("GAZ")
          ? "GAZ"
          : availableEnergies.includes("ELECTRICITE")
          ? "ELECTRICITE"
          : availableEnergies[0]
      );
    }
  }, [availableEnergies, selectedEnergy]);

  // ─── Date range — controlled by the parent (TelereleveChartsSection) ─

  // ─── Filtered raw records ────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedEnergy) return [];
    const fromTs = new Date(dateFrom).getTime();
    const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    return records
      .filter((r) => r.energyType === selectedEnergy)
      .filter((r) => {
        const t = new Date(r.period).getTime();
        return t >= fromTs && t <= toTs;
      })
      .sort(
        (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
      );
  }, [records, selectedEnergy, dateFrom, dateTo]);

  // Detect the natural finest granularity present in the records
  // (used to disable frequencies that would invent data we don't have)
  const naturalGranularity: Frequency = useMemo(() => {
    if (records.length < 2) return "day";
    // Pick the smallest gap between two consecutive sorted periods
    const sorted = [...records]
      .filter((r) => r.energyType === selectedEnergy || !selectedEnergy)
      .sort(
        (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
      );
    let minGapMs = Infinity;
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        new Date(sorted[i].period).getTime() -
        new Date(sorted[i - 1].period).getTime();
      if (gap > 0 && gap < minGapMs) minGapMs = gap;
    }
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    if (minGapMs < 23 * oneHour) return "hour";
    if (minGapMs < 6 * oneDay) return "day";
    if (minGapMs < 27 * oneDay) return "week";
    return "month";
  }, [records, selectedEnergy]);

  // Notify the parent of the natural granularity so its frequency dropdown
  // can disable options finer than what the data actually supports.
  useEffect(() => {
    onNaturalGranularityChange?.(naturalGranularity);
  }, [naturalGranularity, onNaturalGranularityChange]);

  // Daily CHAUFFAGE/MIXTE data in the visible range — reported to the sibling
  // signature chart so it can plot kWh/DJU at day granularity.
  const dailySignatureData = useMemo(() => {
    const fromTs = new Date(dateFrom).getTime();
    const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    const map = new Map<string, { nc: number; djr: number }>();
    for (const r of records) {
      if (r.usage !== "CHAUFFAGE" && r.usage !== "MIXTE") continue;
      const t = new Date(r.period).getTime();
      if (t < fromTs || t > toTs) continue;
      const d = new Date(r.period);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = map.get(key) || { nc: 0, djr: 0 };
      existing.nc += r.quantity;
      if (r.djuReel != null) existing.djr += r.djuReel;
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, nc: d.nc, djr: d.djr }));
  }, [records, dateFrom, dateTo]);

  useEffect(() => {
    onDailyDataChange?.(dailySignatureData);
  }, [dailySignatureData, onDailyDataChange]);

  // ─── Aggregate filtered records into the chosen frequency buckets ────
  const buckets = useMemo(() => {
    if (filtered.length === 0)
      return [] as { date: string; total: number }[];

    const map = new Map<string, { date: Date; total: number }>();

    for (const r of filtered) {
      const d = new Date(r.period);
      if (Number.isNaN(d.getTime())) continue;

      let key: string;
      let bucketDate: Date;

      switch (frequency) {
        case "hour": {
          bucketDate = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            d.getHours()
          );
          key = bucketDate.toISOString();
          break;
        }
        case "day": {
          bucketDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          key = bucketDate.toISOString();
          break;
        }
        case "week": {
          // ISO week starts on Monday
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          bucketDate = new Date(d.getFullYear(), d.getMonth(), diff);
          key = bucketDate.toISOString();
          break;
        }
        case "month": {
          bucketDate = new Date(d.getFullYear(), d.getMonth(), 1);
          key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
          break;
        }
        case "year": {
          bucketDate = new Date(d.getFullYear(), 0, 1);
          key = String(bucketDate.getFullYear());
          break;
        }
      }

      const existing = map.get(key);
      if (existing) {
        existing.total += r.quantity;
      } else {
        map.set(key, { date: bucketDate, total: r.quantity });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((b) => ({ date: b.date.toISOString(), total: b.total }));
  }, [filtered, frequency]);

  // ─── KPIs ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = buckets.reduce((s, b) => s + b.total, 0);
    const avg = buckets.length > 0 ? total / buckets.length : 0;
    return { total, avg, count: buckets.length };
  }, [buckets]);

  // ─── Climate KPIs (N'B + écart) — only when we have monthlyData ─────
  // The climate-corrected target only makes sense at month granularity,
  // so we only expose these KPIs when frequency === "month".
  const climateKpis = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0 || frequency !== "month") {
      return null;
    }
    const totalNc = monthlyData.reduce((s, m) => s + m.nc, 0);
    const totalNbPrime = monthlyData.reduce((s, m) => s + m.nbPrime, 0);
    if (totalNbPrime === 0) return null; // no target available
    const delta = totalNc - totalNbPrime;
    const deltaPercent = Math.round((delta / totalNbPrime) * 1000) / 10;
    return { totalNbPrime, delta, deltaPercent };
  }, [monthlyData, frequency]);

  // YoY: same window one year before
  const yoyDelta = useMemo(() => {
    if (!selectedEnergy || filtered.length === 0) return null;
    const fromTs =
      new Date(dateFrom).getTime() - 365 * 24 * 60 * 60 * 1000;
    const toTs =
      new Date(dateTo).getTime() - 365 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000 - 1;
    const lastYearTotal = records
      .filter((r) => r.energyType === selectedEnergy)
      .filter((r) => {
        const t = new Date(r.period).getTime();
        return t >= fromTs && t <= toTs;
      })
      .reduce((s, r) => s + r.quantity, 0);
    if (lastYearTotal === 0) return null;
    return Math.round(((kpis.total - lastYearTotal) / lastYearTotal) * 100);
  }, [records, selectedEnergy, dateFrom, dateTo, kpis.total, filtered.length]);

  // ─── ECharts option ──────────────────────────────────────────────────
  const chartColor = selectedEnergy
    ? ENERGY_COLORS[selectedEnergy] || "#6b7280"
    : "#6b7280";

  const chartOption = useMemo(() => {
    // Choose Y axis unit dynamically: switch to MWh when the largest bar
    // is ≥ 5 000 kWh, otherwise stay in kWh. Avoids ambiguous "40k" labels
    // on monthly/yearly views where each bar is tens of MWh.
    const maxKwh = buckets.reduce((m, b) => Math.max(m, b.total), 0);
    const yUnit: "kWh" | "MWh" = maxKwh >= 5000 ? "MWh" : "kWh";
    // Convert a raw kWh value to the chart's display unit (kWh or MWh).
    // Used by both the main NC bars and the optional N'B target line.
    const toDisplay = (kwh: number) =>
      yUnit === "MWh"
        ? Number((kwh / 1000).toFixed(2))
        : Math.round(kwh);

    const dates = buckets.map((b) => b.date);
    const values = buckets.map((b) => toDisplay(b.total));

    // Format an X-axis label based on the current frequency
    const formatAxisLabel = (iso: string): string => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      switch (frequency) {
        case "hour":
          return d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
          });
        case "day":
          return d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          });
        case "week":
          return `S. ${d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          })}`;
        case "month":
          return d.toLocaleDateString("fr-FR", {
            month: "short",
            year: "2-digit",
          });
        case "year":
          return String(d.getFullYear());
      }
    };

    // Format the tooltip header date based on frequency
    const formatTooltipDate = (iso: string): string => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      switch (frequency) {
        case "hour":
          return d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        case "day":
          return d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
        case "week": {
          const end = new Date(d);
          end.setDate(end.getDate() + 6);
          const fmt = (x: Date) =>
            x.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
          return `Semaine du ${fmt(d)} au ${fmt(end)}`;
        }
        case "month":
          return d.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          });
        case "year":
          return String(d.getFullYear());
      }
    };

    const seriesLabel = "Consommation";

    // Compute kWh/DJU ratio line when in monthly frequency and DJU data available.
    // Seuil DJU >= 50 pour exclure l'été et les intersaisons (mai-sept, DJU 0-50).
    // En dessous, la conso n'est plus principalement liée au chauffage → le ratio
    // explose (ex: juin 12 DJU + 12 MWh non-chauffage → 1050 kWh/DJU aberrant).
    const MIN_DJU = 50;
    const showRatio = frequency === "month" && djuByMonth && djuByMonth.size > 0;
    const ratioValues = showRatio
      ? buckets.map((b) => {
          const d = new Date(b.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const dju = djuByMonth!.get(key) || 0;
          return dju >= MIN_DJU ? Math.round((b.total / dju) * 10) / 10 : null;
        })
      : [];

    const legendData = showRatio ? [seriesLabel, "kWh/DJU"] : [seriesLabel];

    return {
      grid: { left: 64, right: showRatio ? 64 : 24, top: 48, bottom: 48 },
      legend: {
        data: legendData,
        top: 4,
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
        formatter: (params: { axisValueLabel: string; dataIndex: number }[]) => {
          if (!params || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const kwh = buckets[idx]?.total ?? 0;
          let html = `<div style="font-weight:600;margin-bottom:4px">${formatTooltipDate(params[0].axisValueLabel)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${chartColor}"></span>
              ${seriesLabel} :&nbsp;<strong>${formatKwh(kwh)}</strong>
            </div>`;
          if (showRatio && ratioValues[idx] !== null && ratioValues[idx] !== undefined) {
            const d = new Date(buckets[idx]?.date || "");
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const dju = djuByMonth!.get(key) || 0;
            html += `<div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6366f1"></span>
              Ratio :&nbsp;<strong>${ratioValues[idx]} kWh/DJU</strong>
              <span style="font-size:10px;color:#9ca3af">(${Math.round(dju)} DJU)</span>
            </div>`;
          }
          return html;
        },
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: true,
        axisLine: { lineStyle: { color: "#d1d5db" } },
        axisLabel: {
          color: "#6b7280",
          fontSize: 11,
          hideOverlap: true,
          formatter: formatAxisLabel,
        },
      },
      yAxis: [
        {
          type: "value",
          name: yUnit,
          nameTextStyle: { color: "#6b7280", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
          axisLabel: {
            color: "#6b7280",
            fontSize: 11,
            formatter: (v: number) => {
              if (yUnit === "MWh") {
                return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
              }
              return v >= 1000
                ? `${(v / 1000).toFixed(0)}k`
                : v.toLocaleString("fr-FR");
            },
          },
        },
        ...(showRatio
          ? [
              {
                type: "value" as const,
                name: "kWh/DJU",
                nameTextStyle: { color: "#6366f1", fontSize: 11 },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: {
                  color: "#6366f1",
                  fontSize: 11,
                  formatter: (v: number) => Math.round(v).toString(),
                },
              },
            ]
          : []),
      ],
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series: [
        {
          name: seriesLabel,
          type: "bar",
          data: values,
          yAxisIndex: 0,
          itemStyle: {
            color: chartColor,
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: { color: chartColor, opacity: 1 },
          },
          barMaxWidth: 32,
        },
        ...(showRatio
          ? [
              {
                name: "kWh/DJU",
                type: "line" as const,
                data: ratioValues,
                yAxisIndex: 1,
                smooth: true,
                symbol: "circle",
                symbolSize: 6,
                lineStyle: { color: "#6366f1", width: 2 },
                itemStyle: { color: "#6366f1" },
              },
            ]
          : []),
      ],
    };
  }, [buckets, chartColor, selectedSite, frequency, monthlyData, djuByMonth]);

  // ─── CSV export ──────────────────────────────────────────────────────
  const handleExportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    const lines = ["date,kwh"];
    filtered.forEach((r) => {
      const d = r.period.split("T")[0];
      lines.push(`${d},${Math.round(r.quantity)}`);
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const meterRef =
      selectedSite?.pce || selectedSite?.pdl || selectedSite?.id || "site";
    a.download = `conso-${meterRef}-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, selectedSite, dateFrom, dateTo]);

  // Notify the parent each time the export capability changes so it can
  // enable / disable the button it renders in the shared toolbar.
  useEffect(() => {
    onExportFnChange?.(filtered.length > 0 ? handleExportCsv : null);
  }, [filtered, handleExportCsv, onExportFnChange]);

  // Loading / empty states for the contract's site list are handled by the
  // parent wrapper (TelereleveChartsSection) — by the time we render here,
  // we know there's at least one site to pick from.

  const content = (
    <>
      {/* Local toolbar — only the energy selector when multiple energies are
          available. Site picker, date range and export live in the parent
          toolbar (TelereleveChartsSection). */}
      {availableEnergies.length > 1 && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">
              Énergie
            </label>
            <div className="flex gap-1">
              {availableEnergies.map((energy) => {
                const Icon = energy === "GAZ" ? Flame : Zap;
                const isActive = selectedEnergy === energy;
                return (
                  <button
                    key={energy}
                    onClick={() => setSelectedEnergy(energy)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                      isActive
                        ? "text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    )}
                    style={
                      isActive
                        ? { backgroundColor: ENERGY_COLORS[energy] || "#6b7280" }
                        : undefined
                    }
                  >
                    <Icon size={14} />
                    {ENERGY_LABELS[energy] || energy}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KPIs (hidden when the parent renders shared KPIs above) */}
      {!hideKpis && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="NC totale" value={formatKwh(kpis.total)} />
        <Kpi
          label="N'B"
          value={
            climateKpis ? formatKwh(climateKpis.totalNbPrime) : "—"
          }
          tooltip={
            climateKpis
              ? "Cible théorique ajustée à la météo réelle. Formule : NB × (DJR / DJC) où DJR = degrés-jours réels et DJC = degrés-jours contractuels."
              : "Disponible uniquement en fréquence mensuelle, et seulement si le bâtiment a un NB renseigné."
          }
        />
        <Kpi
          label="Écart"
          value={
            climateKpis
              ? `${climateKpis.deltaPercent > 0 ? "+" : ""}${climateKpis.deltaPercent}%`
              : "—"
          }
          subtle={
            climateKpis
              ? `${climateKpis.delta >= 0 ? "+" : "−"}${formatKwh(Math.abs(climateKpis.delta))}`
              : undefined
          }
          tone={
            climateKpis === null
              ? "neutral"
              : climateKpis.deltaPercent > 5
              ? "danger"
              : climateKpis.deltaPercent < -5
              ? "success"
              : "neutral"
          }
          icon={
            climateKpis === null
              ? null
              : climateKpis.deltaPercent > 0
              ? TrendingUp
              : TrendingDown
          }
          tooltip="Écart entre la consommation réelle et la cible climatique. Positif (rouge) = dépassement, négatif (vert) = économie. Seuil de tolérance ±5%."
        />
        <Kpi
          label="Évolution N-1"
          value={
            yoyDelta === null ? "—" : `${yoyDelta > 0 ? "+" : ""}${yoyDelta} %`
          }
          tone={
            yoyDelta === null
              ? "neutral"
              : yoyDelta > 0
              ? "danger"
              : yoyDelta < 0
              ? "success"
              : "neutral"
          }
          icon={
            yoyDelta === null ? null : yoyDelta > 0 ? TrendingUp : TrendingDown
          }
        />
      </div>
      )}

      {/* Chart */}
      {loadingRecords ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Wifi size={28} className="text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">
            Aucun relevé sur la période sélectionnée
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Essayez d&apos;élargir la plage ou attendez la prochaine
            synchronisation du distributeur.
          </p>
        </div>
      ) : (
        <ReactECharts
          option={chartOption}
          style={{ height: 420, width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}
    </>
  );

  if (noCard) return content;

  return (
    <ChartCard
      title="Suivi télérelevé"
      subtitle="Données brutes du distributeur (GRDF / Enedis)"
      className="w-full h-full"
    >
      {content}
    </ChartCard>
  );
}

// ────────────────────────────────────────────────────────────────────────
// KPI sub-component
// ────────────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  subtle?: string;
  tone?: "neutral" | "success" | "danger";
  icon?: LucideIcon | null;
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
