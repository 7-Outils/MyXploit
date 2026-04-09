"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Wifi,
  Flame,
  Zap,
  Download,
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
  period: string;
  quantity: number;
  cost: number | null;
  meterName: string | null;
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

interface Props {
  /** Sites of the current contract — used to resolve the selected site
      label / PCE / PDL for the chart title and CSV filename */
  sites: SiteSummary[];
  /** Currently selected site (controlled by the parent) */
  selectedSiteId: string | null;
  /** Date range — controlled by the parent so a sibling chart can share it */
  dateFrom: string;
  dateTo: string;
}

export function TelereleveBuildingChart({
  sites,
  selectedSiteId,
  dateFrom,
  dateTo,
}: Props) {
  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  // ─── Records for the selected site ───────────────────────────────────
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    if (!selectedSiteId) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingRecords(true);
    fetch(`/api/consumptions?siteId=${selectedSiteId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsumptionRecord[]) => {
        if (cancelled) return;
        // Distributor data only (sync-imported, no exploitant meter name)
        setRecords((data || []).filter((c) => c.meterName === null));
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecords(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSiteId]);

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

  // ─── Frequency (display granularity) ─────────────────────────────────
  // Default to monthly view because it's the most readable starting point
  // for users coming in cold; they can drill down to weekly/daily later.
  type Frequency = "hour" | "day" | "week" | "month" | "year";
  const [frequency, setFrequency] = useState<Frequency>("month");

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

  // If the user picked a frequency finer than what's in the data,
  // bump them up to the finest available
  useEffect(() => {
    const order: Frequency[] = ["hour", "day", "week", "month", "year"];
    if (order.indexOf(frequency) < order.indexOf(naturalGranularity)) {
      setFrequency(naturalGranularity);
    }
  }, [naturalGranularity, frequency]);

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

    const dates = buckets.map((b) => b.date);
    const values = buckets.map((b) =>
      yUnit === "MWh" ? Number((b.total / 1000).toFixed(2)) : Math.round(b.total)
    );
    const seriesName = selectedSite?.pce || selectedSite?.pdl || "Consommation";

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

    return {
      grid: { left: 64, right: 24, top: 24, bottom: 60 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: { axisValueLabel: string; dataIndex: number }[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          // Always format from the original kWh, not the scaled chart value
          const originalKwh = buckets[p.dataIndex]?.total ?? 0;
          return `<div style="font-weight:600;margin-bottom:4px">${formatTooltipDate(p.axisValueLabel)}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${chartColor}"></span>
              ${formatKwh(originalKwh)}
            </div>`;
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
          formatter: (v: number) => {
            // v is already in the chart's display unit (kWh or MWh)
            if (yUnit === "MWh") {
              return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
            }
            return v >= 1000
              ? `${(v / 1000).toFixed(0)}k`
              : v.toLocaleString("fr-FR");
          },
        },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          height: 24,
          bottom: 8,
          borderColor: "transparent",
          backgroundColor: "#f3f4f6",
          fillerColor: "rgba(59,130,246,0.15)",
          handleStyle: { color: "#3b82f6" },
          textStyle: { color: "#6b7280", fontSize: 10 },
          start: 0,
          end: 100,
        },
      ],
      series: [
        {
          name: seriesName,
          type: "bar",
          data: values,
          itemStyle: {
            color: chartColor,
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: {
            itemStyle: { color: chartColor, opacity: 1 },
          },
          barMaxWidth: 24,
        },
      ],
    };
  }, [buckets, chartColor, selectedSite, frequency]);

  // ─── CSV export ──────────────────────────────────────────────────────
  const handleExportCsv = () => {
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
  };

  // Loading / empty states for the contract's site list are handled by the
  // parent wrapper (TelereleveChartsSection) — by the time we render here,
  // we know there's at least one site to pick from.

  return (
    <ChartCard
      title="Suivi télérelevé"
      subtitle="Données brutes du distributeur (GRDF / Enedis)"
      className="w-full h-full"
    >
      {/* Local toolbar — only Energy + Frequency + CSV export.
          Site picker and date range live in the parent toolbar
          (TelereleveChartsSection) so they are shared with the
          climate-corrected chart on the right. */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {/* Energy selector */}
        {availableEnergies.length > 1 && (
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
        )}

        {/* Frequency selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">
            Fréquence
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {(
              [
                { v: "hour", label: "Horaire" },
                { v: "day", label: "Journalière" },
                { v: "week", label: "Hebdomadaire" },
                { v: "month", label: "Mensuelle" },
                { v: "year", label: "Annuelle" },
              ] as const
            ).map((opt) => {
              const order: Frequency[] = ["hour", "day", "week", "month", "year"];
              const isFinerThanData =
                order.indexOf(opt.v as Frequency) <
                order.indexOf(naturalGranularity);
              return (
                <option
                  key={opt.v}
                  value={opt.v}
                  disabled={isFinerThanData}
                >
                  {opt.label}
                  {isFinerThanData ? " (non disponible)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Export */}
        <div className="ml-auto">
          <button
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Download size={14} />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Conso totale" value={formatKwh(kpis.total)} />
        <Kpi
          label="Moyenne / relevé"
          value={kpis.avg > 0 ? formatKwh(kpis.avg) : "—"}
          subtle={kpis.count > 0 ? `sur ${kpis.count} relevé(s)` : undefined}
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
        <Kpi
          label="Relevés"
          value={kpis.count.toLocaleString("fr-FR")}
          subtle="sur la période"
        />
      </div>

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
}

function Kpi({ label, value, subtle, tone = "neutral", icon: Icon }: KpiProps) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
      ? "text-green-600"
      : "text-primary-dark";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
        {label}
      </p>
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
