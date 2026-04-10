"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { usePermissions } from "@/contexts/PermissionContext";
import type { ActivityLog } from "@/components/buildings/types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
} from "@/components/buildings/constants";

export function ActivityLogTab({ siteId }: { siteId: string }) {
  const { canEdit: userCanEdit } = usePermissions();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    activityType: "INCIDENT",
    title: "",
    description: "",
    activityDate: new Date().toISOString().split("T")[0],
  });

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/activity-log`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/activity-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ activityType: "NOTE", title: "", description: "", activityDate: new Date().toISOString().split("T")[0] });
        await fetchLogs();
      }
    } catch (error) {
      console.error("Error creating log:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {userCanEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nouvelle entrée
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <ChartCard title="Nouvelle entrée">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                >
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.activityDate}
                  onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Panne chaudière bâtiment A"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Détails supplémentaires..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </ChartCard>
      )}

      {/* Timeline */}
      {logs.length === 0 ? (
        <ChartCard title="">
          <div className="text-center py-8">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucune activité enregistrée pour ce site</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title={`Journal d'activité (${logs.length})`}>
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTIVITY_TYPE_COLORS[log.activityType] || "bg-gray-100 text-gray-700"}`}>
                    {ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{log.title}</p>
                  {log.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(log.activityDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {" - "}
                    {log.user.firstName || ""} {log.user.lastName || ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
