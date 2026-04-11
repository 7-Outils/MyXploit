"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Loader2,
  Gauge,
  GitBranch,
  AlertCircle,
  List,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { Meter, MeterReading } from "@/components/sites/types";
import { MeterFlowchart } from "@/components/sites/MeterFlowchart";
import { MeterTreeView } from "@/components/sites/MeterTreeView";
import { MeterModal } from "@/components/sites/modals/MeterModal";
import { ReadingModal } from "@/components/sites/modals/ReadingModal";
import { ReadingsHistoryModal } from "@/components/sites/modals/ReadingsHistoryModal";

export function MetersTab({ siteId }: { siteId: string }) {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMeters, setExpandedMeters] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"visual" | "list">("visual");

  // Modal states
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [selectedMeterForReading, setSelectedMeterForReading] = useState<Meter | null>(null);
  const [showReadingsModal, setShowReadingsModal] = useState(false);
  const [selectedMeterReadings, setSelectedMeterReadings] = useState<Meter | null>(null);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  const fetchMeters = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/meters`);
      if (res.ok) {
        const data = await res.json();
        setMeters(data);
        const allIds = new Set<string>();
        const collectIds = (mList: Meter[]) => {
          for (const m of mList) {
            allIds.add(m.id);
            if (m.children) collectIds(m.children);
          }
        };
        collectIds(data);
        setExpandedMeters(allIds);
      }
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchMeters(); }, [fetchMeters]);

  const meterTree = useMemo(() => meters, [meters]);

  const principalMeters = useMemo(() => {
    const principals: Meter[] = [];
    const find = (mList: Meter[]) => {
      for (const m of mList) {
        if (m.type === "PRINCIPAL") principals.push(m);
        if (m.children) find(m.children);
      }
    };
    find(meters);
    return principals;
  }, [meters]);

  const toggleMeter = (meterId: string) => {
    setExpandedMeters((prev) => {
      const next = new Set(prev);
      next.has(meterId) ? next.delete(meterId) : next.add(meterId);
      return next;
    });
  };

  const openCreateMeterModal = () => { setEditingMeter(null); setShowMeterModal(true); };
  const openEditMeterModal = (meter: Meter) => { setEditingMeter(meter); setShowMeterModal(true); };

  const handleDeleteMeter = async (meter: Meter) => {
    if (!confirm(`Supprimer le compteur "${meter.name}" ?`)) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/meters/${meter.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
      await fetchMeters();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  const openAddReadingModal = (meter: Meter) => {
    setSelectedMeterForReading(meter);
    setShowReadingModal(true);
  };

  const openReadingsModal = async (meter: Meter) => {
    setSelectedMeterReadings(meter);
    setLoadingReadings(true);
    setShowReadingsModal(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/meters/${meter.id}/readings?limit=50`);
      if (res.ok) setMeterReadings(await res.json());
    } catch (err) {
      console.error("Error loading readings:", err);
    } finally {
      setLoadingReadings(false);
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
    <>
      <ChartCard
        title="Schéma de comptage"
        subtitle={`${meters.length} compteur${meters.length > 1 ? "s" : ""} configuré${meters.length > 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("visual")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "visual" ? "bg-white text-accent shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                title="Vue diagramme"
              >
                <Network size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list" ? "bg-white text-accent shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                title="Vue liste"
              >
                <List size={18} />
              </button>
            </div>
            <Button onClick={openCreateMeterModal}>
              <Plus size={18} className="mr-2" />
              Ajouter un compteur
            </Button>
          </div>
        }
      >
        {meters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <GitBranch size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-primary-dark mb-2">Aucun compteur configuré</h3>
            <p className="text-text-secondary mb-4 text-center max-w-md">
              Configurez le schéma de comptage de ce site pour suivre les consommations (gaz, ECS, électricité...)
            </p>
            <Button onClick={openCreateMeterModal}>
              <Plus size={18} className="mr-2" />
              Ajouter un compteur
            </Button>
          </div>
        ) : viewMode === "visual" ? (
          <MeterFlowchart
            meters={meterTree}
            onCreateMeter={openCreateMeterModal}
            onEditMeter={openEditMeterModal}
            onDeleteMeter={handleDeleteMeter}
            onAddReading={openAddReadingModal}
            onViewReadings={openReadingsModal}
          />
        ) : (
          <MeterTreeView
            meters={meterTree}
            expandedMeters={expandedMeters}
            onToggleMeter={toggleMeter}
            onCreateMeter={openCreateMeterModal}
            onEditMeter={openEditMeterModal}
            onDeleteMeter={handleDeleteMeter}
            onAddReading={openAddReadingModal}
            onViewReadings={openReadingsModal}
          />
        )}
      </ChartCard>

      {meters.some((m) => m.children?.some((c) => c.isDeductedFromParent)) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Calcul automatique du chauffage</h4>
              <p className="text-sm text-blue-700 mt-1">
                Les compteurs marqués &quot;Déduit&quot; seront soustraits du compteur principal pour calculer la consommation de chauffage.
              </p>
              <p className="text-sm text-blue-700 mt-1 font-mono">
                Chauffage = Gaz Total - (ECS × coefficient Q)
              </p>
            </div>
          </div>
        </div>
      )}

      {showMeterModal && (
        <MeterModal
          editingMeter={editingMeter}
          principalMeters={principalMeters}
          siteId={siteId}
          onClose={() => setShowMeterModal(false)}
          onSaved={fetchMeters}
        />
      )}

      {showReadingModal && selectedMeterForReading && (
        <ReadingModal
          meter={selectedMeterForReading}
          siteId={siteId}
          onClose={() => setShowReadingModal(false)}
          onSaved={fetchMeters}
        />
      )}

      {showReadingsModal && selectedMeterReadings && (
        <ReadingsHistoryModal
          meter={selectedMeterReadings}
          readings={meterReadings}
          loading={loadingReadings}
          onClose={() => setShowReadingsModal(false)}
        />
      )}
    </>
  );
}
