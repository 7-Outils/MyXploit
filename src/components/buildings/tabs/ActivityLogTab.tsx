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
            className="flex items-center gap-2 px-4 py-2 bg-ink text-paper hover:bg-accent transition-colors text-sm font-medium"
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
                <label className="label-tech block mb-1">Type</label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-tech block mb-1">Date</label>
                <input
                  type="date"
                  value={formData.activityDate}
                  onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="label-tech block mb-1">Titre</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Panne chaudière bâtiment A"
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="label-tech block mb-1">Description (optionnel)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Détails supplémentaires..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium border border-ink/20 text-ink hover:border-accent hover:text-accent transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 text-sm font-medium bg-ink text-paper hover:bg-accent disabled:opacity-50 flex items-center gap-2 transition-colors"
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
            <ClipboardList size={36} className="mx-auto text-ink/20 mb-4" />
            <p className="text-sm text-ink/50">Aucune activité enregistrée pour ce site</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title={`Journal d'activité (${logs.length})`}>
          <div className="-my-2 divide-y divide-ink/10">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 py-2.5 hover:bg-ink/[0.02] transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium ${ACTIVITY_TYPE_COLORS[log.activityType] || "border border-ink/20 text-ink/60"}`}>
                    {ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm">{log.title}</p>
                  {log.description && (
                    <p className="text-sm text-ink/60 mt-0.5">{log.description}</p>
                  )}
                  <p className="label-tech mt-1">
                    <span className="tabular-nums">{new Date(log.activityDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
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
