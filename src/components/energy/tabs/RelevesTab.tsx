"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Check, Flame, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

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

// Converted-to-display value (keeps native unit for chart)
function getDisplayValue(r: MeterReadingRow): { value: number; unit: string } {
  if (r.consumption == null) return { value: 0, unit: r.unit };
  if (r.consumptionConverted != null && r.unitConverted) {
    return { value: r.consumptionConverted, unit: r.unitConverted };
  }
  return { value: r.consumption, unit: r.unit };
}

// Normalize to kWh for KPI totals
function toKwh(r: MeterReadingRow): number {
  if (r.consumption == null) return 0;
  if (r.consumptionConverted != null && r.unitConverted === "kWh") return r.consumptionConverted;
  if (r.consumptionConverted != null && r.unitConverted === "MWh") return r.consumptionConverted * 1000;
  if (r.unit === "kWh") return r.consumption;
  if (r.unit === "MWh") return r.consumption * 1000;
  return 0; // m³ not normalizable without coefficient
}

/* ───────────────────────── FluidChart sub-component ───────────────────────── */

function FluidChart({ fluid, readings }: { fluid: string; readings: MeterReadingRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  const { months, labels, values, unit } = useMemo(() => {
    const byMonth = new Map<string, number>();
    let detectedUnit = "";
    for (const r of readings) {
      if (r.meter.fluid !== fluid || r.consumption == null) continue;
      const { value, unit: u } = getDisplayValue(r);
      if (!detectedUnit) detectedUnit = u;
      // The consumption was done BETWEEN previous reading and current reading.
      // Attribute it to the previous month (month when the gas was actually consumed).
      const refDate = r.previous?.readingDate ? new Date(r.previous.readingDate) : new Date(r.readingDate);
      const key = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) || 0) + value);
    }
    const months = Array.from(byMonth.keys()).sort();
    return {
      months,
      labels: months.map((m) => {
        const [y, mo] = m.split("-");
        return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      }),
      values: months.map((m) => Math.round((byMonth.get(m) || 0) * 10) / 10),
      unit: detectedUnit,
    };
  }, [fluid, readings]);

  const total = values.reduce((s, v) => s + v, 0);

  useEffect(() => {
    if (!ref.current || months.length === 0) {
      instance.current?.dispose();
      instance.current = null;
      return;
    }
    const chart = echarts.init(ref.current);
    instance.current = chart;
    const color = FLUID_COLORS[fluid] || "#9ca3af";
    chart.setOption({
      grid: { left: 56, right: 16, top: 20, bottom: 32 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(17,24,39,0.95)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (params as { axisValueLabel: string; value: number }[])[0];
          return `<div style="font-weight:600;margin-bottom:2px">${p.axisValueLabel}</div>
            <div>${p.value.toLocaleString("fr-FR")} ${unit}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#6b7280" },
      },
      yAxis: {
        type: "value",
        name: unit,
        nameTextStyle: { color: "#6b7280", fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLabel: {
          fontSize: 11,
          color: "#6b7280",
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()),
        },
      },
      series: [
        {
          type: "bar",
          data: values,
          itemStyle: { color, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28,
        },
      ],
    });
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      instance.current = null;
    };
  }, [labels, values, unit, fluid, months.length]);

  if (months.length === 0) return null;

  return (
    <ChartCard
      title={FLUID_LABELS[fluid] || fluid}
      subtitle={`${total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${unit}`}
    >
      <div ref={ref} style={{ width: "100%", height: 220 }} />
    </ChartCard>
  );
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

  // Unique filter lists
  const fluids = useMemo(() => Array.from(new Set(readings.map((r) => r.meter.fluid))), [readings]);
  const sitesList = useMemo(() => {
    const map = new Map<string, string>();
    readings.forEach((r) => map.set(r.meter.siteId, r.meter.site.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [readings]);
  const metersList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; siteId: string }>();
    readings.forEach((r) => {
      if (!map.has(r.meter.id)) map.set(r.meter.id, { id: r.meter.id, name: r.meter.name, siteId: r.meter.siteId });
    });
    return Array.from(map.values());
  }, [readings]);

  const availableMeters = filterSite === "all" ? metersList : metersList.filter((m) => m.siteId === filterSite);

  // Filtered readings (applies to KPIs, charts and table)
  const filtered = useMemo(() => {
    let list = readings;
    if (filterFluid !== "all") list = list.filter((r) => r.meter.fluid === filterFluid);
    if (filterSite !== "all") list = list.filter((r) => r.meter.siteId === filterSite);
    if (filterMeter !== "all") list = list.filter((r) => r.meter.id === filterMeter);
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

  // Fluids present in filtered data — one chart per fluid
  const fluidsInFiltered = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.meter.fluid))),
    [filtered]
  );

  // KPIs
  const kpis = useMemo(() => {
    let gas = 0, ecs = 0, elec = 0;
    for (const r of filtered) {
      const kwh = toKwh(r);
      if (r.meter.fluid === "EAU_CHAUDE") ecs += kwh;
      else if (r.meter.fluid === "ELECTRICITE") elec += kwh;
      else if (r.meter.fluid === "GAZ" || r.meter.fluid === "CHALEUR" || r.meter.fluid === "FIOUL") gas += kwh;
    }
    return { gas, ecs, elec, total: filtered.length };
  }, [filtered]);

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
            <option key={f} value={f}>{FLUID_LABELS[f] || f}</option>
          ))}
        </select>
        <select
          value={filterSite}
          onChange={(e) => { setFilterSite(e.target.value); setFilterMeter("all"); }}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="all">Tous sites</option>
          {sitesList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">Gaz / Chaleur</p>
          <p className="text-2xl font-semibold text-primary-dark">{formatValue(kpis.gas, "kWh")}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">ECS</p>
          <p className="text-2xl font-semibold text-primary-dark">{formatValue(kpis.ecs, "kWh")}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-text-secondary mb-1">Électricité</p>
          <p className="text-2xl font-semibold text-primary-dark">{formatValue(kpis.elec, "kWh")}</p>
        </div>
      </div>

      {/* One chart per fluid — 2 columns on desktop */}
      {fluidsInFiltered.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {fluidsInFiltered.map((fluid) => (
            <FluidChart key={fluid} fluid={fluid} readings={filtered} />
          ))}
        </div>
      )}

      {/* Table */}
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
    </div>
  );
}
