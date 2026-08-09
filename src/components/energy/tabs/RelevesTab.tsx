"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Building2, ChevronDown, ChevronUp, Check, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
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

// Palette énergie « bureau d'études » : teintes sobres dérivées de ink/accent,
// suffisamment distinctes pour rester lisibles empilées.
const FLUID_COLORS: Record<string, string> = {
  GAZ: "#0F1E33",
  ELECTRICITE: "#2563EB",
  EAU_CHAUDE: "#60A5FA",
  EAU_FROIDE: "#94A3B8",
  CHALEUR: "#B45309",
  FIOUL: "#475569",
};

// Couleur de la courbe signature énergétique (ratio conso/DJU)
const RATIO_COLOR = "#2563EB";
const GRID_COLOR = "rgba(15,30,51,0.08)";
const AXIS_COLOR = "rgba(15,30,51,0.5)";

// Ordre de stack stable (bas → haut) pour que l'ECS soit toujours
// au même endroit quel que soit l'ordre d'arrivée des relevés.
// Chauffage en bas, ECS au-dessus, eau froide en dernier.
const FLUID_STACK_ORDER = ["GAZ", "FIOUL", "CHALEUR", "ELECTRICITE", "EAU_CHAUDE", "EAU_FROIDE"];

type SortKey = "date" | "site" | "meter" | "fluid";
type SortDir = "asc" | "desc";

function formatValue(v: number, unit: string): string {
  if (unit === "kWh" && Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`;
  return `${Math.round(v).toLocaleString("fr-FR")} ${unit}`;
}

// Formatage strict forcé sur kWh ou MWh (pour les KPIs qui suivent le toggle)
function formatForced(v: number, unit: "kWh" | "MWh"): string {
  if (unit === "MWh") {
    return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`;
  }
  return `${Math.round(v).toLocaleString("fr-FR")} kWh`;
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
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // viewBox interne fixe, le SVG s'étire via width=100% + preserveAspectRatio=none
  const vbWidth = 100;
  const step = vbWidth / Math.max(values.length - 1, 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${vbWidth} ${height}`}
      preserveAspectRatio="none"
      className="block overflow-visible"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
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
        itemStyle: { color: FLUID_COLORS[fluid] || "#94A3B8", borderRadius: 0 },
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
        lineStyle: { color: "#2563EB", type: "dashed", width: 1.5 },
        label: {
          formatter: `Cible ${displayUnit === "MWh" ? targetInUnit.toFixed(1) : Math.round(targetInUnit).toLocaleString("fr-FR")} ${displayUnit}/mois`,
          color: "#2563EB",
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
        backgroundColor: "#ffffff",
        borderColor: "rgba(15,30,51,0.15)",
        borderWidth: 1,
        borderRadius: 0,
        textStyle: { color: "#0F1E33", fontSize: 12 },
      },
      legend: {
        data: series.map((s) => s.name),
        bottom: 8,
        icon: "rect",
        itemWidth: 10,
        itemHeight: 2,
        textStyle: { fontSize: 11, color: AXIS_COLOR },
      },
      xAxis: {
        type: "category",
        data: months.map((m) => {
          const [y, mo] = m.split("-");
          return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        }),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: AXIS_COLOR },
      },
      yAxis: {
        type: "value",
        name: displayUnit,
        nameTextStyle: { color: AXIS_COLOR, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: {
          fontSize: 11,
          color: AXIS_COLOR,
          formatter: (v: number) =>
            displayUnit === "MWh" ? v.toString() : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString(),
        },
      },
      series,
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    // ResizeObserver: déclenche aussi le resize quand le container passe de
    // display:none à display:block (changement d'onglet) — sans ça le chart
    // reste coincé aux dimensions mesurées lors du mount (potentiellement 0px).
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
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
      // Bottom:56 pour aligner l'axe X avec le chart stacked (qui a une légende en bas)
      grid: { left: 56, right: 16, top: 24, bottom: 56 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "rgba(15,30,51,0.15)",
        borderWidth: 1,
        borderRadius: 0,
        textStyle: { color: "#0F1E33", fontSize: 12 },
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
        axisLabel: { fontSize: 11, color: AXIS_COLOR },
      },
      yAxis: {
        type: "value",
        name: "kWh/DJU",
        nameTextStyle: { color: AXIS_COLOR, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { fontSize: 11, color: AXIS_COLOR },
      },
      series: [
        {
          type: "line",
          data: ratios,
          smooth: true,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: RATIO_COLOR, width: 2 },
          itemStyle: { color: RATIO_COLOR },
          areaStyle: { color: "rgba(37,99,235,0.06)" },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      chart.dispose();
    };
  }, [months, ratios]);

  if (months.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-xs text-ink/50">
        Données insuffisantes (besoin de conso chauffage + DJU &gt; 10 par mois)
      </div>
    );
  }
  return <div ref={ref} style={{ width: "100%", height: 240 }} />;
}

/* ───────────────────────── Main component ───────────────────────── */

export function RelevesContent({
  contractId,
  setShowCreateModal,
  refreshKey = 0,
}: {
  contractId: string | null;
  setShowCreateModal: (v: boolean) => void;
  refreshKey?: number;
}) {
  const router = useRouter();
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

  // Toggle unité d'affichage du chart empilé (MWh par défaut — plus lisible
  // pour des gros volumes annuels, switch manuel si besoin de précision kWh)
  const [displayUnit, setDisplayUnit] = useState<"kWh" | "MWh">("MWh");

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

  // SWR pour le cache cross-page (revisite /energy = instant).
  // refreshKey suffixe la key pour forcer un re-fetch après save/delete.
  const readingsKey = contractId
    ? `/api/contracts/${contractId}/readings?limit=1000&v=${refreshKey ?? 0}`
    : null;
  const { data: readingsData, isLoading: readingsLoading } = useSWR(readingsKey, fetcher, { keepPreviousData: true });
  useEffect(() => {
    setReadings(Array.isArray(readingsData) ? readingsData : []);
    setLoading(readingsLoading);
  }, [readingsData, readingsLoading]);

  const fetchReadings = useCallback(() => {
    // Compat avec les anciens callsites (edit/delete) : SWR ré-revalide
    // automatiquement, mais on bumpe la version externe si nécessaire.
  }, []);

  // Objectif NB par site
  const heatingSeasonsKey = contractId ? `/api/heating-seasons?contractId=${contractId}` : null;
  const { data: heatingSeasonsData } = useSWR<{ siteId: string; season: string; nb: number | null }[]>(
    heatingSeasonsKey,
    fetcher
  );
  const nbBySite = useMemo(() => {
    if (!Array.isArray(heatingSeasonsData) || heatingSeasonsData.length === 0) return new Map<string, number>();
    const latestSeason = [...new Set(heatingSeasonsData.map((d) => d.season))].sort().pop();
    if (!latestSeason) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const hs of heatingSeasonsData) {
      if (hs.season !== latestSeason) continue;
      if (hs.nb == null || hs.nb <= 0) continue;
      m.set(hs.siteId, hs.nb * 1000);
    }
    return m;
  }, [heatingSeasonsData]);

  // DJU mensuel par site
  const djuKey = contractId
    ? `/api/dju?contractId=${contractId}&year=${new Date().getFullYear()}`
    : null;
  const { data: djuData } = useSWR<{
    sites?: { siteId: string; monthlyData: { month: string; dju: number }[] }[];
  }>(djuKey, fetcher);
  const djuBySite = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    if (djuData?.sites) {
      for (const s of djuData.sites) {
        const byMonth = new Map<string, number>();
        for (const md of s.monthlyData) byMonth.set(md.month, md.dju);
        m.set(s.siteId, byMonth);
      }
    }
    return m;
  }, [djuData]);


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
  // Trié selon FLUID_STACK_ORDER pour que l'empilement soit stable (sinon l'ordre
  // dépendait de l'ordre d'arrivée des relevés → ECS tantôt en haut tantôt en bas).
  const energyFluidsInFiltered = useMemo(() => {
    const present = Array.from(monthlyByFluid.keys());
    return [...present].sort((a, b) => {
      const ia = FLUID_STACK_ORDER.indexOf(a);
      const ib = FLUID_STACK_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [monthlyByFluid]);

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
    <div className="space-y-4">
      {/* Filters + Actions — one row */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterFluid}
          onChange={(e) => setFilterFluid(e.target.value)}
          className="h-9 border border-ink/20 bg-white px-3 text-sm text-ink focus:border-accent focus:outline-none"
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
            className="h-9 w-56 border border-ink/20 bg-white px-3 text-sm text-ink focus:border-accent focus:outline-none"
          />
          {siteOpen && (
            <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto border border-ink/15 bg-white shadow-large">
              <button
                type="button"
                onClick={() => { setFilterSite("all"); setFilterMeter("all"); setSiteOpen(false); setSiteSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/[0.02] ${filterSite === "all" ? "bg-accent/5 text-accent" : "text-ink"}`}
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
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/[0.02] ${filterSite === s.id ? "bg-accent/5 text-accent" : "text-ink"}`}
                  >
                    {s.name}
                  </button>
                ))}
              {sitesList.filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-xs text-ink/50">Aucun site</div>
              )}
            </div>
          )}
        </div>
        <select
          value={filterMeter}
          onChange={(e) => setFilterMeter(e.target.value)}
          className="h-9 border border-ink/20 bg-white px-3 text-sm text-ink focus:border-accent focus:outline-none"
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
          className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
        />
        <span className="text-xs text-ink/40">→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
        />
        {hasActiveFilter && (
          <button
            onClick={() => {
              setFilterFluid("all"); setFilterSite("all"); setFilterMeter("all");
              setFilterDateFrom(""); setFilterDateTo("");
            }}
            className="font-mono text-[11px] uppercase tracking-widest text-ink/50 transition-colors hover:text-accent"
          >
            Réinitialiser
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={() => router.push("/energy/import")}
          title="Import Exploitant"
          className="h-9 w-9 flex items-center justify-center border border-ink/20 text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <Upload size={16} />
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          title="Saisir relevé"
          className="h-9 w-9 flex items-center justify-center bg-ink text-paper transition-colors hover:bg-accent"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* KPIs dynamiques — une card par fluide énergétique présent */}
      {(kpiCards.length > 0 || monthlyRatio.size > 0) && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {kpiCards.map((k) => (
            <div key={k.fluid} className="panel p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="label-tech flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.color }} />
                  {k.label}
                </p>
                {k.trend != null && (
                  <span className={`font-mono text-[10px] tabular-nums font-medium ${k.trend > 0 ? "text-red-600" : k.trend < 0 ? "text-green-600" : "text-ink/50"}`}>
                    {k.trend > 0 ? "↑" : k.trend < 0 ? "↓" : "="} {Math.abs(k.trend).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">{formatForced(k.total, displayUnit)}</p>
              {k.nativeTotal != null && k.nativeUnit && (
                <p className="font-mono text-xs tabular-nums text-ink/50 mt-0.5">
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
              <div className="panel p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="label-tech flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RATIO_COLOR }} />
                    Ratio conso/DJU
                  </p>
                  {ratioTrend != null && (
                    <span className={`font-mono text-[10px] tabular-nums font-medium ${ratioTrend > 0 ? "text-red-600" : ratioTrend < 0 ? "text-green-600" : "text-ink/50"}`}>
                      {ratioTrend > 0 ? "↑" : ratioTrend < 0 ? "↓" : "="} {Math.abs(ratioTrend).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
                  {avgRatio.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                  <span className="ml-1 text-sm font-normal text-ink/50">kWh/DJU</span>
                </p>
                <p className="text-xs text-ink/50 mt-0.5">Moyenne {ratioSpark.length} mois</p>
                <div className="mt-2">
                  <Sparkline values={ratioSpark} color={RATIO_COLOR} />
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
              <div className="flex border border-ink/15 bg-white font-mono text-[11px] uppercase tracking-widest">
                <button
                  type="button"
                  onClick={() => setDisplayUnit("kWh")}
                  className={`px-2.5 py-1 transition-colors ${
                    displayUnit === "kWh" ? "bg-ink text-paper" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  kWh
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayUnit("MWh")}
                  className={`border-l border-ink/15 px-2.5 py-1 transition-colors ${
                    displayUnit === "MWh" ? "bg-ink text-paper" : "text-ink/50 hover:text-ink"
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
            <Building2 className="w-8 h-8 text-ink/25 mb-3" />
            <p className="text-sm text-ink/60">Aucun relevé</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 -my-4">
            <table className="w-full">
              <thead className="border-b border-ink/10">
                <tr>
                  <th onClick={() => toggleSort("site")} className="label-tech px-3 py-2 font-normal text-left cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Site <SortIcon col="site" /></span>
                  </th>
                  <th onClick={() => toggleSort("meter")} className="label-tech px-3 py-2 font-normal text-left cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Compteur <SortIcon col="meter" /></span>
                  </th>
                  <th onClick={() => toggleSort("fluid")} className="label-tech px-3 py-2 font-normal text-left cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Fluide <SortIcon col="fluid" /></span>
                  </th>
                  <th className="label-tech px-3 py-2 font-normal text-center">Date préc.</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">Index préc.</th>
                  <th onClick={() => toggleSort("date")} className="label-tech px-3 py-2 font-normal text-center cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Date <SortIcon col="date" /></span>
                  </th>
                  <th className="label-tech px-3 py-2 font-normal text-right">Index</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">Conso</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">Converti</th>
                  <th className="label-tech px-3 py-2 font-normal text-center w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.06]">
                {pagedRows.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-ink/[0.02]">
                      <td className="px-3 py-2 text-sm font-medium text-ink">{r.meter.site.name}</td>
                      <td className="px-3 py-2 text-sm text-ink">{r.meter.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 border"
                          style={{ borderColor: `${FLUID_COLORS[r.meter.fluid] || "#94A3B8"}33`, color: FLUID_COLORS[r.meter.fluid] || "#64748B" }}
                        >
                          {FLUID_LABELS[r.meter.fluid] || r.meter.fluid}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-ink/50">
                        {r.previous ? new Date(r.previous.readingDate).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-ink/50">
                        {r.previous?.indexValue != null ? `${r.previous.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-sm tabular-nums text-ink">
                        {isEditing ? (
                          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-32 border border-ink/20 bg-white px-2 py-1 text-center font-mono text-sm tabular-nums focus:border-accent focus:outline-none" />
                        ) : (
                          new Date(r.readingDate).toLocaleDateString("fr-FR")
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums font-medium text-ink">
                        {isEditing ? (
                          <input
                            type="number" step="0.01" value={editIndex} onChange={(e) => setEditIndex(e.target.value)}
                            className="w-28 border border-ink/20 bg-white px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          />
                        ) : (
                          r.indexValue != null ? `${r.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums font-medium text-ink">
                        {r.consumption != null ? `${r.consumption.toLocaleString("fr-FR")} ${r.unit}` : <span className="font-sans text-xs text-ink/40">1er relevé</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-ink/60">
                        {r.consumptionConverted != null && r.unitConverted
                          ? formatValue(r.consumptionConverted, r.unitConverted)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} disabled={saving} title="Enregistrer" className="p-1.5 text-green-700 transition-colors hover:bg-green-50">
                              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={cancelEdit} title="Annuler" className="p-1.5 text-ink/40 transition-colors hover:text-ink">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(r)} className="p-1.5 text-ink/40 transition-colors hover:text-accent" title="Modifier">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-ink/40 transition-colors hover:text-red-600" title="Supprimer">
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
              <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2">
                <span className="font-mono text-[11px] uppercase tracking-widest tabular-nums text-ink/50">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={pageClamped === 1}
                    className="h-8 border border-ink/20 px-3 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <span className="px-2 font-mono text-[11px] uppercase tracking-widest tabular-nums text-ink/50">
                    Page {pageClamped} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={pageClamped === totalPages}
                    className="h-8 border border-ink/20 px-3 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
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
