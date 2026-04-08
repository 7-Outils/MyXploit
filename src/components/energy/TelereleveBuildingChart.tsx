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

interface SiteSummary {
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

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
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
  contractId: string;
}

export function TelereleveBuildingChart({ contractId }: Props) {
  // ─── Sites of the contract that have a PCE/PDL ───────────────────────
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

  // ─── Selected site ───────────────────────────────────────────────────
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Auto-select first site once loaded
  useEffect(() => {
    if (selectedSiteId === null && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

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

  // ─── Date range ──────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(daysAgoIso(90));
  const [dateTo, setDateTo] = useState(todayIso());

  // ─── Filtered series ─────────────────────────────────────────────────
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

  // ─── KPIs ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.quantity, 0);
    const cost = filtered.reduce((s, r) => s + (r.cost || 0), 0);
    return { total, cost, count: filtered.length };
  }, [filtered]);

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
    const dates = filtered.map((r) => r.period.split("T")[0]);
    const values = filtered.map((r) => Math.round(r.quantity));
    const seriesName = selectedSite?.pce || selectedSite?.pdl || "Consommation";

    return {
      grid: { left: 64, right: 24, top: 24, bottom: 90 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: { axisValueLabel: string; value: number }[]) => {
          if (!params || params.length === 0) return "";
          const p = params[0];
          const date = new Date(p.axisValueLabel);
          const dateStr = date.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
          return `<div style="font-weight:600;margin-bottom:4px">${dateStr}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${chartColor}"></span>
              ${formatKwh(p.value)}
            </div>`;
        },
      },
      legend: {
        data: [seriesName],
        bottom: 60,
        left: "center",
        icon: "circle",
        textStyle: { color: "#374151", fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: true,
        axisLine: { lineStyle: { color: "#d1d5db" } },
        axisLabel: {
          color: "#6b7280",
          fontSize: 11,
          formatter: (val: string) => {
            const d = new Date(val);
            if (Number.isNaN(d.getTime())) return val;
            return d.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            });
          },
        },
      },
      yAxis: {
        type: "value",
        name: "kWh",
        nameTextStyle: { color: "#6b7280", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
        axisLabel: {
          color: "#6b7280",
          fontSize: 11,
          formatter: (v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
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
          height: 28,
          bottom: 18,
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
  }, [filtered, chartColor, selectedSite]);

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

  // ─── Empty / loading states ──────────────────────────────────────────
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
    <ChartCard title="Suivi télérelevé" subtitle="Données brutes du distributeur (GRDF / Enedis)">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {/* Site selector */}
        <div className="flex flex-col gap-1 min-w-[220px]">
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

        {/* Date range */}
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
            max={todayIso()}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        {/* Date presets */}
        <div className="flex gap-1">
          {[
            { label: "30 j", days: 30 },
            { label: "90 j", days: 90 },
            { label: "1 an", days: 365 },
            { label: "3 ans", days: 365 * 3 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setDateFrom(daysAgoIso(preset.days));
                setDateTo(todayIso());
              }}
              className="px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100"
            >
              {preset.label}
            </button>
          ))}
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
          label="Coût estimé"
          value={
            kpis.cost > 0
              ? `${Math.round(kpis.cost).toLocaleString("fr-FR")} €`
              : "—"
          }
          subtle={kpis.cost > 0 ? undefined : "non renseigné"}
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
