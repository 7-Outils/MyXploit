"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Flame, Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";
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

  const fetchReadings = useCallback(() => {
    if (!contractId) {
      setReadings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/contracts/${contractId}/readings?limit=30`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReadings(Array.isArray(data) ? data : []))
      .catch(() => setReadings([]))
      .finally(() => setLoading(false));
  }, [contractId]);

  useEffect(() => { fetchReadings(); }, [fetchReadings]);

  const startEdit = (r: MeterReadingRow) => {
    setEditingId(r.id);
    setEditDate(r.readingDate.split("T")[0]);
    setEditIndex(r.indexValue?.toString() || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDate("");
    setEditIndex("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/meter-readings/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingDate: editDate, indexValue: editIndex }),
      });
      if (res.ok) {
        cancelEdit();
        fetchReadings();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce relevé ?")) return;
    try {
      const res = await fetch(`/api/meter-readings/${id}`, { method: "DELETE" });
      if (res.ok) fetchReadings();
      else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
          <Flame size={18} className="mr-2" />
          Import Exploitant
        </Button>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />
          Saisir relevé
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : readings.length === 0 ? (
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucun relevé de compteur</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title="Derniers relevés">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Compteur</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Relevé précédent</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Relevé actuel</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Consommation</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.map((r) => {
                  const isEditing = editingId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-dark">
                        {r.meter.site.name}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-primary-dark">{r.meter.name}</p>
                        <span className="text-xs text-text-secondary">{FLUID_LABELS[r.meter.fluid] || r.meter.fluid}</span>
                      </td>
                      {/* Relevé précédent */}
                      <td className="px-4 py-3 text-center text-sm text-text-secondary">
                        {r.previous ? (
                          <div>
                            <span className="font-mono">{r.previous.indexValue?.toLocaleString("fr-FR")} {r.unit}</span>
                            <br />
                            <span className="text-xs">{new Date(r.previous.readingDate).toLocaleDateString("fr-FR")}</span>
                          </div>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </td>
                      {/* Relevé actuel */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="px-2 py-1 text-sm border rounded w-32 text-center"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={editIndex}
                              onChange={(e) => setEditIndex(e.target.value)}
                              className="px-2 py-1 text-sm border rounded w-32 text-center font-mono"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-sm font-medium text-primary-dark">
                              {r.indexValue?.toLocaleString("fr-FR")} {r.unit}
                            </span>
                            <br />
                            <span className="text-xs text-text-secondary">
                              {new Date(r.readingDate).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        )}
                      </td>
                      {/* Consommation */}
                      <td className="px-4 py-3 text-right text-sm font-medium text-primary-dark">
                        {r.consumption !== null ? (
                          <>
                            {r.consumption.toLocaleString("fr-FR")} {r.unit}
                            {r.consumptionConverted !== null && r.unitConverted && (
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
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(r)}
                              className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-100 rounded"
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
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
