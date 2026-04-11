"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Flame, Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

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

type SortKey = "date" | "site" | "meter";
type SortDir = "asc" | "desc";

export function SitesContent({
  contractId,
  setShowIdexImportModal,
  setShowCreateModal,
}: {
  contractId: string | null;
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
}) {
  const [readings, setReadings] = useState<MeterReadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editIndex, setEditIndex] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters & sort
  const [filterMeter, setFilterMeter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchReadings = useCallback(() => {
    if (!contractId) {
      setReadings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/contracts/${contractId}/readings?limit=50`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReadings(Array.isArray(data) ? data : []))
      .catch(() => setReadings([]))
      .finally(() => setLoading(false));
  }, [contractId]);

  useEffect(() => { fetchReadings(); }, [fetchReadings]);

  // Unique meters for filter dropdown
  const meters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; fluid: string; siteName: string }>();
    readings.forEach((r) => {
      if (!map.has(r.meter.id)) {
        map.set(r.meter.id, { id: r.meter.id, name: r.meter.name, fluid: r.meter.fluid, siteName: r.meter.site.name });
      }
    });
    return Array.from(map.values());
  }, [readings]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = readings;
    if (filterMeter !== "all") {
      list = list.filter((r) => r.meter.id === filterMeter);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime();
      else if (sortKey === "site") cmp = a.meter.site.name.localeCompare(b.meter.site.name);
      else if (sortKey === "meter") cmp = a.meter.name.localeCompare(b.meter.name);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [readings, filterMeter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
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

  const cancelEdit = () => { setEditingId(null); };

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

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Filter by meter */}
        {meters.length > 1 && (
          <select
            value={filterMeter}
            onChange={(e) => setFilterMeter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="all">Tous les compteurs</option>
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.siteName} — {m.name} ({FLUID_LABELS[m.fluid] || m.fluid})
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
            <Flame size={18} className="mr-2" />
            Import Exploitant
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={18} className="mr-2" />
            Saisir relevé
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <ChartCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucun relevé de compteur</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard>
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th
                    className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort("site")}
                  >
                    <span className="inline-flex items-center gap-1">Site <SortIcon col="site" /></span>
                  </th>
                  <th
                    className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort("meter")}
                  >
                    <span className="inline-flex items-center gap-1">Compteur <SortIcon col="meter" /></span>
                  </th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Date préc.</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Index préc.</th>
                  <th
                    className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort("date")}
                  >
                    <span className="inline-flex items-center gap-1">Date <SortIcon col="date" /></span>
                  </th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Index</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Consommation</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-dark">{r.meter.site.name}</td>
                      <td className="px-4 py-3 text-sm text-primary-dark">
                        {r.meter.name}
                        <span className="text-xs text-text-secondary ml-1">({FLUID_LABELS[r.meter.fluid] || r.meter.fluid})</span>
                      </td>
                      {/* Date précédente */}
                      <td className="px-4 py-3 text-center text-xs text-text-secondary">
                        {r.previous ? new Date(r.previous.readingDate).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      {/* Index précédent */}
                      <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                        {r.previous?.indexValue != null ? `${r.previous.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"}
                      </td>
                      {/* Date actuelle */}
                      <td className="px-4 py-3 text-center text-sm">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="px-2 py-1 text-sm border rounded w-32 text-center"
                          />
                        ) : (
                          new Date(r.readingDate).toLocaleDateString("fr-FR")
                        )}
                      </td>
                      {/* Index actuel */}
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-primary-dark">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editIndex}
                            onChange={(e) => setEditIndex(e.target.value)}
                            className="px-2 py-1 text-sm border rounded w-28 text-right font-mono"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          r.indexValue != null ? `${r.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"
                        )}
                      </td>
                      {/* Consommation */}
                      <td className="px-4 py-3 text-right text-sm font-medium text-primary-dark">
                        {r.consumption != null ? (
                          <>
                            {r.consumption.toLocaleString("fr-FR")} {r.unit}
                            {r.consumptionConverted != null && r.unitConverted && (
                              <span className="text-xs text-text-secondary ml-1">
                                ({r.consumptionConverted.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {r.unitConverted})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-text-secondary text-xs">1er relevé</span>
                        )}
                      </td>
                      {/* Actions */}
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
          </div>
        </ChartCard>
      )}
    </>
  );
}
