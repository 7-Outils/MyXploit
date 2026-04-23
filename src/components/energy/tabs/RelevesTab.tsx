"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Check, Flame, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { prorateAcrossMonths } from "@/lib/date-prorate";
import { addDays } from "date-fns";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, MarkLineComponent, LegendComponent, CanvasRenderer]);

interface MeterReadingRow {
  id: string;
  readingDate: string;
  indexValue: number | null;
  consumption: number | null;
  unit: string;
  consumptionConverted: number | null;
  unitConverted: string | null;
  notes: string | null;
  meter: {
    id: string;
    name: string;
    fluid: string;
    unit: string;
    siteId: string;
    site: { name: string };
  };
  previous: { readingDate: string; indexValue: number | null } | null;
}

const FLUID_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "ECS",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

// Regroupe les variantes MeterFluid en fluide canonique pour le filtre.
// ECS (EAU_CHAUDE) est séparé de Eau froide car physiquement différent:
// ECS se convertit en kWh via coefficient Q (énergie), eau froide est pure
// volume (indicateur de maintenance/fuite uniquement).
const CANONICAL_FLUID: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "ECS",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

const FLUID_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#eab308",
  EAU_CHAUDE: "#3b82f6",
  EAU_FROIDE: "#06b6d4",
  CHALEUR: "#ef4444",
  FIOUL: "#8b5cf6",
};

type SortKey = "date" | "site" | "meter" | "fluid";
type SortDir = "asc" | "desc";

function formatValue(v: number, unit: string): string {
  if (unit === "kWh" && Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`;
  return `${Math.round(v).toLocaleString("fr-FR")} ${unit}`;
}

// Normalize to kWh for KPI totals
function toKwh(r: MeterReadingRow): number {
  if (r.consumption == null) return 0;
  if (r.consumptionConverted != null && r.unitConverted === "kWh") return r.consumptionConverted;
  if (r.consumptionConverted != null && r.unitConverted === "MWh") return r.consumptionConverted * 1000;
  if (r.unit === "kWh") return r.consumption;
  if (r.unit === "MWh") return r.consumption * 1000;
  return 0; // m³ not normalizable without coefficient (EAU_FROIDE)
}

/**
 * Clé mensuelle "YYYY-MM" depuis un ISO YYYY-MM-01T00:00:00.000Z.
 */
function periodIsoToKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Proratise une ligne de relevé sur les mois calendaires qu'elle couvre
 * (entre previous.readingDate+1 et readingDate). Retourne Map<"YYYY-MM", kWh>.
 * Si pas de previous, attribue au mois du relevé.
 */
function monthlyShare(r: MeterReadingRow, kwh: number): Map<string, number> {
  const result = new Map<string, number>();
  if (kwh === 0) return result;
  if (r.previous?.readingDate) {
    const start = addDays(new Date(r.previous.readingDate), 1);
    const end = new Date(r.readingDate);
    const share = prorateAcrossMonths(start, end, kwh);
    for (const [iso, q] of share.entries()) {
      result.set(periodIsoToKey(iso), q);
    }
  } else {
    const d = new Date(r.readingDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.set(key, kwh);
  }
  return result;
}

/* ───────────────────────── Sparkline sub-component ───────────────────────── */

function Sparkline({ values, color, height = 28 }: { values: number[]; color: string; height?: number }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const width = 80;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className="block" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

/* ───────────────────────── StackedMonthlyChart ───────────────────────── */

function StackedMonthlyChart({
  data,
  fluids,
  displayUnit,
  monthlyTargetKwh,
}: {
  // data: Map<fluid, Map<"YYYY-MM", kWh>>
  data: Map<string, Map<string, number>>;
  fluids: string[];
  displayUnit: "kWh" | "MWh";
  monthlyTargetKwh?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Union des mois présents sur tous les fluides
  const months = useMemo(() => {
    const all = new Set<string>();
    for (const byMonth of data.values()) for (const k of byMonth.keys()) all.add(k);
    return Array.from(all).sort();
  }, [data]);

  const divisor = displayUnit === "MWh" ? 1000 : 1;
  const targetInUnit = monthlyTargetKwh != null ? monthlyTargetKwh / divisor : null;

  const series = useMemo(() => {
    const base = fluids.map((fluid) => {
      const byMonth = data.get(fluid) ?? new Map<string, number>();
      return {
        name: FLUID_LABELS[fluid] || fluid,
        type: "bar" as const,
        stack: "total",
        barMaxWidth: 48,
        itemStyle: { color: FLUID_COLORS[fluid] || "#9ca3af", borderRadius: [3, 3, 0, 0] },
        data: months.map((m) => {
          const v = (byMonth.get(m) ?? 0) / divisor;
          return displayUnit === "MWh" ? Math.round(v * 10) / 10 : Math.round(v);
        }),
      };
    });
    // Ligne cible (NB/12) en markLine sur la 1ère série si fournie
    if (targetInUnit != null && targetInUnit > 0 && base.length > 0) {
      (base[0] as Record<string, unknown>).markLine = {
        symbol: "none",
        lineStyle: { color: "#64748b", type: "dashed", width: 1.5 },
        label: {
          formatter: `Cible ${displayUnit === "MWh" ? targetInUnit.toFixed(1) : Math.round(targetInUnit).toLocaleString("fr-FR")} ${displayUnit}/mois`,
          color: "#64748b",
          fontSize: 10,
          position: "insideEndTop",
        },
        data: [{ yAxis: targetInUnit }],
      };
    }
    return base;
  }, [fluids, data, months, divisor, displayUnit, targetInUnit]);

  useEffect(() => {
    if (!ref.current || months.length === 0) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      grid: { left: 60, right: 16, top: 16, bottom: 56 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(17,24,39,0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
      },
      legend: {
        data: series.map((s) => s.name),
        bottom: 8,
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      xAxis: {
        type: "category",
        data: months.map((m) => {
          const [y, mo] = m.split("-");
          return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        }),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#6b7280" },
      },
      yAxis: {
        type: "value",
        name: displayUnit,
        nameTextStyle: { color: "#6b7280", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: {
          fontSize: 11,
          color: "#6b7280",
          formatter: (v: number) =>
            displayUnit === "MWh" ? v.toString() : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString(),
        },
      },
      series,
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [months, series, displayUnit]);

  if (months.length === 0) return null;
  return <div ref={ref} style={{ width: "100%", height: 240 }} />;
}

/* ─────────────────── Ratio Conso chauffage / DJU ─────────────────── */

function RatioChauffageDjuChart({ monthlyRatio }: { monthlyRatio: Map<string, number> }) {
  const ref = useRef<HTMLDivElement>(null);

  const { months, ratios } = useMemo(() => {
    const keys = Array.from(monthlyRatio.keys()).sort();
    return {
      months: keys,
      ratios: keys.map((k) => Math.round((monthlyRatio.get(k) ?? 0) * 10) / 10),
    };
  }, [monthlyRatio]);

  useEffect(() => {
    if (!ref.current || months.length === 0) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      grid: { left: 56, right: 16, top: 24, bottom: 32 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(17,24,39,0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (params as { axisValueLabel: string; value: number }[])[0];
          return `<div style="font-weight:600;margin-bottom:2px">${p.axisValueLabel}</div>
            <div>${p.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kWh/DJU</div>`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: months.map((m) => {
          const [y, mo] = m.split("-");
          return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        }),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#6b7280" },
      },
      yAxis: {
        type: "value",
        name: "kWh/DJU",
        nameTextStyle: { color: "#6b7280", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: { fontSize: 11, color: "#6b7280" },
      },
      series: [
        {
          type: "line",
          data: ratios,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#6366f1", width: 2 },
          itemStyle: { color: "#6366f1" },
          areaStyle: { color: "rgba(99,102,241,0.08)" },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [months, ratios]);

  if (months.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-xs text-text-secondary">
        Données insuffisantes (besoin de conso chauffage + DJU &gt; 10 par mois)
      </div>
    );
  }
  return <div ref={ref} style={{ width: "100%", height: 240 }} />;
}

/* ───────────────────────── Main component ───────────────────────── */

export function RelevesContent({
  contractId,
  setShowIdexImportModal,
  setShowCreateModal,
  refreshKey = 0,
}: {
  contractId: string | null;
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  refreshKey?: number;
}) {
  const [readings, setReadings] = useState<MeterReadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editIndex, setEditIndex] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterFluid, setFilterFluid] = useState<string>("all");
  const [filterSite, setFilterSite] = useState<string>("all");
  const [filterMeter, setFilterMeter] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle unité d'affichage du chart empilé
  const [displayUnit, setDisplayUnit] = useState<"kWh" | "MWh">("kWh");

  // Combobox site (searchable)
  const [siteSearch, setSiteSearch] = useState("");
  const [siteOpen, setSiteOpen] = useState(false);
  const siteComboRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (siteComboRef.current && !siteComboRef.current.contains(e.target as Node)) {
        setSiteOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchReadings = useCallback(() => {
    if (!contractId) {
      setReadings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/contracts/${contractId}/readings?limit=1000`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReadings(Array.isArray(data) ? data : []))
      .catch(() => setReadings([]))
      .finally(() => setLoading(false));
  }, [contractId]);

  useEffect(() => { fetchReadings(); }, [fetchReadings, refreshKey]);

  // Objectif NB par site (pour l'overlay cible sur chart chauffage).
  // On garde un map siteId → NB_kWh pour pouvoir adapter la cible au filtre.
  const [nbBySite, setNbBySite] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!contractId) { setNbBySite(new Map()); return; }
    fetch(`/api/heating-seasons?contractId=${contractId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { siteId: string; season: string; nb: number | null }[]) => {
        if (!Array.isArray(data) || data.length === 0) { setNbBySite(new Map()); return; }
        // Saison la plus récente = plus grande clé
        const latestSeason = [...new Set(data.map((d) => d.season))].sort().pop();
        if (!latestSeason) { setNbBySite(new Map()); return; }
        const m = new Map<string, number>();
        for (const hs of data) {
          if (hs.season !== latestSeason) continue;
          if (hs.nb == null || hs.nb <= 0) continue;
          m.set(hs.siteId, hs.nb * 1000); // MWh → kWh
        }
        setNbBySite(m);
      })
      .catch(() => setNbBySite(new Map()));
  }, [contractId]);

  // DJU mensuel par site (pour calcul cohérent du ratio conso/DJU selon le filtre).
  // Quand filterSite=all: on pondère par la conso chauffage de chaque site.
  // Quand filterSite=siteId: on utilise directement les DJU du site.
  const [djuBySite, setDjuBySite] = useState<Map<string, Map<string, number>>>(new Map());
  useEffect(() => {
    if (!contractId) { setDjuBySite(new Map()); return; }
    const year = new Date().getFullYear();
    fetch(`/api/dju?contractId=${contractId}&year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        sites?: { siteId: string; monthlyData: { month: string; dju: number }[] }[];
      } | null) => {
        if (!data?.sites) { setDjuBySite(new Map()); return; }
        const m = new Map<string, Map<string, number>>();
        for (const s of data.sites) {
          const byMonth = new Map<string, number>();
          for (const md of s.monthlyData) byMonth.set(md.month, md.dju);
          m.set(s.siteId, byMonth);
        }
        setDjuBySite(m);
      })
      .catch(() => setDjuBySite(new Map()));
  }, [contractId]);

  // Filtres en cascade: chaque dropdown se rétrécit en fonction des autres filtres actifs.
  // Exemple: fluide=Gaz → sites qui n'ont pas de gaz disparaissent; compteur choisi → le
  // site auquel il appartient devient le seul disponible.
  const matchFluid = (r: MeterReadingRow) =>
    filterFluid === "all" || (CANONICAL_FLUID[r.meter.fluid] ?? r.meter.fluid) === filterFluid;
  const matchSite = (r: MeterReadingRow) =>
    filterSite === "all" || r.meter.siteId === filterSite;
  const matchMeter = (r: MeterReadingRow) =>
    filterMeter === "all" || (filterSite === "all" ? r.meter.name === filterMeter : r.meter.id === filterMeter);

  const fluids = useMemo(() => {
    const canonSet = new Set<string>();
    for (const r of readings) {
      if (!matchSite(r)) continue;
      if (!matchMeter(r)) continue;
      canonSet.add(CANONICAL_FLUID[r.meter.fluid] ?? r.meter.fluid);
    }
    return Array.from(canonSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings, filterSite, filterMeter]);

  const sitesList = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of readings) {
      if (!matchFluid(r)) continue;
      if (!matchMeter(r)) continue;
      map.set(r.meter.siteId, r.meter.site.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings, filterFluid, filterMeter]);

  // Compteurs: dédoublonnés par nom quand site=all (plusieurs sites peuvent partager
  // "CPT GAZ GrDF"), par id quand un site est sélectionné.
  const metersList = useMemo(() => {
    if (filterSite === "all") {
      const names = new Set<string>();
      for (const r of readings) if (matchFluid(r)) names.add(r.meter.name);
      return Array.from(names).map((name) => ({ id: name, name, siteId: "" }));
    }
    const map = new Map<string, { id: string; name: string; siteId: string }>();
    for (const r of readings) {
      if (r.meter.siteId !== filterSite) continue;
      if (!matchFluid(r)) continue;
      if (!map.has(r.meter.id)) map.set(r.meter.id, { id: r.meter.id, name: r.meter.name, siteId: r.meter.siteId });
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings, filterSite, filterFluid]);

  const availableMeters = metersList;

  // Filtered readings (applies to KPIs, charts and table)
  const filtered = useMemo(() => {
    let list = readings;
    if (filterFluid !== "all") {
      list = list.filter((r) => (CANONICAL_FLUID[r.meter.fluid] ?? r.meter.fluid) === filterFluid);
    }
    if (filterSite !== "all") list = list.filter((r) => r.meter.siteId === filterSite);
    if (filterMeter !== "all") {
      // Quand site=all, filterMeter est un nom de compteur; sinon un id.
      list = list.filter((r) =>
        filterSite === "all" ? r.meter.name === filterMeter : r.meter.id === filterMeter
      );
    }
    if (filterDateFrom) list = list.filter((r) => r.readingDate.split("T")[0] >= filterDateFrom);
    if (filterDateTo) list = list.filter((r) => r.readingDate.split("T")[0] <= filterDateTo);

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime();
      else if (sortKey === "site") cmp = a.meter.site.name.localeCompare(b.meter.site.name);
      else if (sortKey === "meter") cmp = a.meter.name.localeCompare(b.meter.name);
      else if (sortKey === "fluid") cmp = a.meter.fluid.localeCompare(b.meter.fluid);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [readings, filterFluid, filterSite, filterMeter, filterDateFrom, filterDateTo, sortKey, sortDir]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterFluid, filterSite, filterMeter, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(currentPage, totalPages);
  const pagedRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  // Monthly kWh per fluid (via proratisation) — source unique pour KPIs + stacked chart
  const monthlyByFluid = useMemo(() => {
    const byFluid = new Map<string, Map<string, number>>();
    for (const r of filtered) {
      const kwh = toKwh(r);
      if (kwh === 0) continue; // EAU_FROIDE ou pas de conversion
      const share = monthlyShare(r, kwh);
      if (share.size === 0) continue;
      let entry = byFluid.get(r.meter.fluid);
      if (!entry) { entry = new Map(); byFluid.set(r.meter.fluid, entry); }
      for (const [k, q] of share.entries()) entry.set(k, (entry.get(k) ?? 0) + q);
    }
    return byFluid;
  }, [filtered]);

  // Total natif par fluide (m³ pour GAZ/ECS, L pour FIOUL). r.consumption
  // est en unité native depuis /api/contracts/[id]/readings.
  const nativeByFluid = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      if (r.consumption == null || r.consumption <= 0) continue;
      m.set(r.meter.fluid, (m.get(r.meter.fluid) ?? 0) + r.consumption);
    }
    return m;
  }, [filtered]);

  // KPIs dynamiques par fluide: total + sparkline + trend (dernier mois vs avant-dernier)
  const kpiCards = useMemo(() => {
    const order: string[] = ["GAZ", "CHALEUR", "FIOUL", "EAU_CHAUDE", "ELECTRICITE"];
    const nativeUnit: Record<string, string> = {
      GAZ: "m³",
      EAU_CHAUDE: "m³",
      FIOUL: "L",
    };
    const cards: Array<{
      fluid: string;
      label: string;
      color: string;
      total: number;
      spark: number[];
      trend: number | null;
      nativeTotal: number | null;
      nativeUnit: string | null;
    }> = [];
    for (const fluid of order) {
      const byMonth = monthlyByFluid.get(fluid);
      if (!byMonth || byMonth.size === 0) continue;
      const months = Array.from(byMonth.keys()).sort();
      const spark = months.map((m) => byMonth.get(m) ?? 0);
      const total = spark.reduce((s, v) => s + v, 0);
      let trend: number | null = null;
      if (spark.length >= 2 && spark[spark.length - 2] > 0) {
        trend = ((spark[spark.length - 1] - spark[spark.length - 2]) / spark[spark.length - 2]) * 100;
      }
      const native = nativeByFluid.get(fluid);
      cards.push({
        fluid,
        label: FLUID_LABELS[fluid] || fluid,
        color: FLUID_COLORS[fluid] || "#9ca3af",
        total,
        spark,
        trend,
        nativeTotal: native && nativeUnit[fluid] ? native : null,
        nativeUnit: nativeUnit[fluid] ?? null,
      });
    }
    return cards;
  }, [monthlyByFluid, nativeByFluid]);

  // Fluids énergétiques pour le stacked chart (exclut eau froide — non convertible)
  const energyFluidsInFiltered = useMemo(
    () => Array.from(monthlyByFluid.keys()),
    [monthlyByFluid]
  );

  // Cible mensuelle NB/12 adaptée au filtre:
  //   - filterSite spécifique → NB de ce site / 12
  //   - filterSite "all" → somme des NB des sites visibles dans les relevés / 12
  // Affichée uniquement si la vue ne contient QUE des fluides chauffage.
  const monthlyTargetKwh = useMemo(() => {
    const onlyHeating = energyFluidsInFiltered.length > 0
      && energyFluidsInFiltered.every((f) => f === "GAZ" || f === "CHALEUR" || f === "FIOUL");
    if (!onlyHeating) return null;

    let totalNb = 0;
    if (filterSite !== "all") {
      totalNb = nbBySite.get(filterSite) ?? 0;
    } else {
      // Sites présents dans les relevés filtrés (respecte filterFluid et autres)
      const siteIds = new Set<string>();
      for (const r of filtered) siteIds.add(r.meter.siteId);
      for (const siteId of siteIds) {
        totalNb += nbBySite.get(siteId) ?? 0;
      }
    }
    return totalNb > 0 ? totalNb / 12 : null;
  }, [energyFluidsInFiltered, filterSite, filtered, nbBySite]);

  // Conso chauffage mensuelle (GAZ + CHALEUR + FIOUL) en kWh — par site puis totale.
  // Per-site sert à pondérer le DJU effectif quand plusieurs sites sont affichés.
  const chauffageByMonthBySite = useMemo(() => {
    // Map<siteId, Map<"YYYY-MM", kWh>>
    const bySite = new Map<string, Map<string, number>>();
    const heatingFluids = new Set(["GAZ", "CHALEUR", "FIOUL"]);
    for (const r of filtered) {
      if (!heatingFluids.has(r.meter.fluid)) continue;
      const kwh = toKwh(r);
      if (kwh === 0) continue;
      const share = monthlyShare(r, kwh);
      if (share.size === 0) continue;
      let siteMap = bySite.get(r.meter.siteId);
      if (!siteMap) { siteMap = new Map(); bySite.set(r.meter.siteId, siteMap); }
      for (const [k, q] of share.entries()) siteMap.set(k, (siteMap.get(k) ?? 0) + q);
    }
    return bySite;
  }, [filtered]);

  const monthlyChauffageKwh = useMemo(() => {
    const result = new Map<string, number>();
    for (const byMonth of chauffageByMonthBySite.values()) {
      for (const [k, v] of byMonth.entries()) result.set(k, (result.get(k) ?? 0) + v);
    }
    return result;
  }, [chauffageByMonthBySite]);

  // DJU effectif mensuel: moyenne pondérée par la conso chauffage de chaque site ce mois-là.
  // Si tous les sites du filtre partagent la même station, ça revient au DJU de cette station.
  const effectiveMonthlyDju = useMemo(() => {
    const result = new Map<string, number>();
    // Union des mois présents dans au moins un site
    const allMonths = new Set<string>();
    for (const byMonth of chauffageByMonthBySite.values()) for (const m of byMonth.keys()) allMonths.add(m);
    for (const m of allMonths) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const [siteId, byMonth] of chauffageByMonthBySite.entries()) {
        const kwh = byMonth.get(m) ?? 0;
        if (kwh <= 0) continue;
        const djuMap = djuBySite.get(siteId);
        const dju = djuMap?.get(m);
        if (dju == null || dju <= 0) continue;
        weightedSum += dju * kwh;
        totalWeight += kwh;
      }
      if (totalWeight > 0) result.set(m, weightedSum / totalWeight);
    }
    return result;
  }, [chauffageByMonthBySite, djuBySite]);

  // Ratio mensuel kWh/DJU (exclut été + intersaisons: DJU < 50 → non pertinent)
  const monthlyRatio = useMemo(() => {
    const result = new Map<string, number>();
    for (const [m, kwh] of monthlyChauffageKwh.entries()) {
      const dju = effectiveMonthlyDju.get(m);
      if (dju == null || dju < 50 || kwh <= 0) continue;
      result.set(m, kwh / dju);
    }
    return result;
  }, [monthlyChauffageKwh, effectiveMonthlyDju]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const startEdit = (r: MeterReadingRow) => {
    setEditingId(r.id);
    setEditDate(r.readingDate.split("T")[0]);
    setEditIndex(r.indexValue?.toString() || "");
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meter-readings/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingDate: editDate, indexValue: editIndex }),
      });
      if (res.ok) { cancelEdit(); fetchReadings(); }
      else { const data = await res.json(); alert(data.error || "Erreur"); }
    } finally { setSaving(false); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce relevé ?")) return;
    const res = await fetch(`/api/meter-readings/${id}`, { method: "DELETE" });
    if (res.ok) fetchReadings();
    else { const data = await res.json(); alert(data.error || "Erreur"); }
  };

  const hasActiveFilter = filterFluid !== "all" || filterSite !== "all" || filterMeter !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-6">
      {/* Filters + Actions — one row */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterFluid}
          onChange={(e) => setFilterFluid(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">Tous fluides</option>
          {fluids.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div ref={siteComboRef} className="relative">
          <input
            type="text"
            value={siteOpen ? siteSearch : (filterSite === "all" ? "" : (sitesList.find((s) => s.id === filterSite)?.name ?? ""))}
            onChange={(e) => { setSiteSearch(e.target.value); setSiteOpen(true); }}
            onFocus={() => { setSiteSearch(""); setSiteOpen(true); }}
            placeholder="Tous sites"
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white w-56"
          />
          {siteOpen && (
            <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => { setFilterSite("all"); setFilterMeter("all"); setSiteOpen(false); setSiteSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterSite === "all" ? "bg-accent/10 text-accent" : ""}`}
              >
                Tous sites
              </button>
              {sitesList
                .filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase()))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setFilterSite(s.id); setFilterMeter("all"); setSiteOpen(false); setSiteSearch(""); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterSite === s.id ? "bg-accent/10 text-accent" : ""}`}
                  >
                    {s.name}
                  </button>
                ))}
              {sitesList.filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-xs text-text-secondary">Aucun site</div>
              )}
            </div>
          )}
        </div>
        <select
          value={filterMeter}
          onChange={(e) => setFilterMeter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">Tous compteurs</option>
          {availableMeters.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="h-9 px-2 rounded-lg border border-gray-200 text-sm bg-white"
        />
        <span className="text-xs text-text-secondary">→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="h-9 px-2 rounded-lg border border-gray-200 text-sm bg-white"
        />
        {hasActiveFilter && (
          <button
            onClick={() => {
              setFilterFluid("all"); setFilterSite("all"); setFilterMeter("all");
              setFilterDateFrom(""); setFilterDateTo("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Réinitialiser
          </button>
        )}

        <div className="flex-1" />

        <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
          <Flame size={16} className="mr-2" />
          Import Exploitant
        </Button>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} className="mr-2" />
          Saisir relevé
        </Button>
      </div>

      {/* KPIs dynamiques — une card par fluide énergétique présent */}
      {(kpiCards.length > 0 || monthlyRatio.size > 0) && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {kpiCards.map((k) => (
            <div key={k.fluid} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                  {k.label}
                </p>
                {k.trend != null && (
                  <span className={`text-[10px] font-medium ${k.trend > 0 ? "text-red-600" : k.trend < 0 ? "text-green-600" : "text-text-secondary"}`}>
                    {k.trend > 0 ? "↑" : k.trend < 0 ? "↓" : "="} {Math.abs(k.trend).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-primary-dark">{formatValue(k.total, "kWh")}</p>
              {k.nativeTotal != null && k.nativeUnit && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {k.nativeTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} {k.nativeUnit}
                </p>
              )}
              <div className="mt-2">
                <Sparkline values={k.spark} color={k.color} />
              </div>
            </div>
          ))}
          {monthlyRatio.size > 0 && (() => {
            const ratioKeys = Array.from(monthlyRatio.keys()).sort();
            const ratioSpark = ratioKeys.map((k) => monthlyRatio.get(k) ?? 0);
            const avgRatio = ratioSpark.reduce((s, v) => s + v, 0) / ratioSpark.length;
            let ratioTrend: number | null = null;
            if (ratioSpark.length >= 2 && ratioSpark[ratioSpark.length - 2] > 0) {
              ratioTrend = ((ratioSpark[ratioSpark.length - 1] - ratioSpark[ratioSpark.length - 2]) / ratioSpark[ratioSpark.length - 2]) * 100;
            }
            return (
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#6366f1" }} />
                    Ratio conso/DJU
                  </p>
                  {ratioTrend != null && (
                    <span className={`text-[10px] font-medium ${ratioTrend > 0 ? "text-red-600" : ratioTrend < 0 ? "text-green-600" : "text-text-secondary"}`}>
                      {ratioTrend > 0 ? "↑" : ratioTrend < 0 ? "↓" : "="} {Math.abs(ratioTrend).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-2xl font-semibold text-primary-dark">
                  {avgRatio.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                  <span className="text-sm font-normal text-text-secondary ml-1">kWh/DJU</span>
                </p>
                <p className="text-xs text-text-secondary mt-0.5">Moyenne {ratioSpark.length} mois</p>
                <div className="mt-2">
                  <Sparkline values={ratioSpark} color="#6366f1" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Charts côte à côte: consommation empilée + ratio conso chauffage / DJU
          (signature énergétique, gomme la variation climatique). */}
      {energyFluidsInFiltered.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChartCard
            title="Consommation mensuelle"
            subtitle="Répartition par énergie"
            action={
              <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayUnit("kWh")}
                  className={`px-3 py-1 transition-colors ${
                    displayUnit === "kWh" ? "bg-accent text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  kWh
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayUnit("MWh")}
                  className={`px-3 py-1 transition-colors border-l border-gray-200 ${
                    displayUnit === "MWh" ? "bg-accent text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  MWh
                </button>
              </div>
            }
          >
            <StackedMonthlyChart
              data={monthlyByFluid}
              fluids={energyFluidsInFiltered}
              displayUnit={displayUnit}
              monthlyTargetKwh={monthlyTargetKwh}
            />
          </ChartCard>

          <ChartCard
            title="Conso chauffage / DJU"
            subtitle="kWh par degré-jour (signature énergétique)"
          >
            <RatioChauffageDjuChart monthlyRatio={monthlyRatio} />
          </ChartCard>
        </div>
      )}

      {/* Table — affichée uniquement quand un site ET un fluide sont filtrés */}
      {filterSite !== "all" && filterFluid !== "all" && (
      <ChartCard title="Relevés">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucun relevé</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th onClick={() => toggleSort("site")} className="text-left text-xs font-medium text-text-secondary uppercase px-4 py-3 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Site <SortIcon col="site" /></span>
                  </th>
                  <th onClick={() => toggleSort("meter")} className="text-left text-xs font-medium text-text-secondary uppercase px-4 py-3 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Compteur <SortIcon col="meter" /></span>
                  </th>
                  <th onClick={() => toggleSort("fluid")} className="text-left text-xs font-medium text-text-secondary uppercase px-4 py-3 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Fluide <SortIcon col="fluid" /></span>
                  </th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase px-4 py-3">Date préc.</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-4 py-3">Index préc.</th>
                  <th onClick={() => toggleSort("date")} className="text-center text-xs font-medium text-text-secondary uppercase px-4 py-3 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Date <SortIcon col="date" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-4 py-3">Index</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-4 py-3">Conso</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase px-4 py-3">Converti</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedRows.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-dark">{r.meter.site.name}</td>
                      <td className="px-4 py-3 text-sm text-primary-dark">{r.meter.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${FLUID_COLORS[r.meter.fluid] || "#9ca3af"}20`, color: FLUID_COLORS[r.meter.fluid] || "#6b7280" }}
                        >
                          {FLUID_LABELS[r.meter.fluid] || r.meter.fluid}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-text-secondary">
                        {r.previous ? new Date(r.previous.readingDate).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                        {r.previous?.indexValue != null ? `${r.previous.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {isEditing ? (
                          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="px-2 py-1 text-sm border rounded w-32 text-center" />
                        ) : (
                          new Date(r.readingDate).toLocaleDateString("fr-FR")
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-primary-dark">
                        {isEditing ? (
                          <input
                            type="number" step="0.01" value={editIndex} onChange={(e) => setEditIndex(e.target.value)}
                            className="px-2 py-1 text-sm border rounded w-28 text-right font-mono"
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          />
                        ) : (
                          r.indexValue != null ? `${r.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-primary-dark">
                        {r.consumption != null ? `${r.consumption.toLocaleString("fr-FR")} ${r.unit}` : <span className="text-text-secondary text-xs">1er relevé</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-text-secondary">
                        {r.consumptionConverted != null && r.unitConverted
                          ? formatValue(r.consumptionConverted, r.unitConverted)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-100 rounded" title="Modifier">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
                <span className="text-text-secondary">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={pageClamped === 1}
                    className="h-8 px-3 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <span className="text-xs text-text-secondary px-2">
                    Page {pageClamped} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageClamped === totalPages}
                    className="h-8 px-3 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </ChartCard>
      )}
    </div>
  );
}
