"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Loader2,
  ArrowLeft,
  Gauge,
  Flame,
  Zap,
  GitBranch,
  FileText,
  AlertCircle,
  List,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

import type { Site, Meter, MeterReading } from "@/components/sites/types";
import { siteTypeLabels, energyTypeLabels } from "@/components/sites/constants";
import { MeterFlowchart } from "@/components/sites/MeterFlowchart";
import { MeterTreeView } from "@/components/sites/MeterTreeView";
import { MeterModal } from "@/components/sites/modals/MeterModal";
import { ReadingModal } from "@/components/sites/modals/ReadingModal";
import { ReadingsHistoryModal } from "@/components/sites/modals/ReadingsHistoryModal";

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  // State
  const [site, setSite] = useState<Site | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Meter tree state
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

  // Fetch site and meters
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [siteRes, metersRes] = await Promise.all([
          fetch(`/api/sites/${siteId}`),
          fetch(`/api/sites/${siteId}/meters`),
        ]);

        if (!siteRes.ok) throw new Error("Site non trouvé");
        const siteData = await siteRes.json();
        setSite(siteData);

        if (metersRes.ok) {
          const metersData = await metersRes.json();
          setMeters(metersData);
          // Expand all by default
          const allIds = new Set<string>();
          const collectIds = (mList: Meter[]) => {
            for (const m of mList) {
              allIds.add(m.id);
              if (m.children) collectIds(m.children);
            }
          };
          collectIds(metersData);
          setExpandedMeters(allIds);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId]);

  // Build meter tree from flat list
  const meterTree = useMemo(() => {
    // Meters already come as a tree from the API
    return meters;
  }, [meters]);

  // Get flat list of principal meters for parent selection
  const principalMeters = useMemo(() => {
    const principals: Meter[] = [];
    const findPrincipals = (mList: Meter[]) => {
      for (const m of mList) {
        if (m.type === "PRINCIPAL") principals.push(m);
        if (m.children) findPrincipals(m.children);
      }
    };
    findPrincipals(meters);
    return principals;
  }, [meters]);

  // Refresh meters from API
  const refreshMeters = async () => {
    const metersRes = await fetch(`/api/sites/${siteId}/meters`);
    if (metersRes.ok) {
      setMeters(await metersRes.json());
    }
  };

  // Toggle meter expansion
  const toggleMeter = (meterId: string) => {
    setExpandedMeters((prev) => {
      const next = new Set(prev);
      if (next.has(meterId)) {
        next.delete(meterId);
      } else {
        next.add(meterId);
      }
      return next;
    });
  };

  // Open meter modal for create
  const openCreateMeterModal = () => {
    setEditingMeter(null);
    setShowMeterModal(true);
  };

  // Open meter modal for edit
  const openEditMeterModal = (meter: Meter) => {
    setEditingMeter(meter);
    setShowMeterModal(true);
  };

  // Delete meter
  const handleDeleteMeter = async (meter: Meter) => {
    if (!confirm(`Supprimer le compteur "${meter.name}" ?`)) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/meters/${meter.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      await refreshMeters();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  // Open reading modal
  const openAddReadingModal = (meter: Meter) => {
    setSelectedMeterForReading(meter);
    setShowReadingModal(true);
  };

  // Open readings history modal
  const openReadingsModal = async (meter: Meter) => {
    setSelectedMeterReadings(meter);
    setLoadingReadings(true);
    setShowReadingsModal(true);

    try {
      const response = await fetch(`/api/sites/${siteId}/meters/${meter.id}/readings?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMeterReadings(data);
      }
    } catch (err) {
      console.error("Error loading readings:", err);
    } finally {
      setLoadingReadings(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (error || !site) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </button>
          <h1 className="text-2xl font-bold text-primary-dark">Site non trouvé</h1>
        </div>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error || "Site introuvable"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <Building2 size={24} className="text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-dark">{site.name}</h1>
                <p className="text-text-secondary">
                  {siteTypeLabels[site.type]} • {site.address}, {site.postalCode} {site.city}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Site Info Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <span className="text-sm text-text-secondary">Surface</span>
          </div>
          <p className="text-xl font-semibold text-primary-dark">
            {site.surface ? `${site.surface.toLocaleString()} m²` : "-"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              {site.energyType === "GAZ" ? (
                <Flame size={16} className="text-amber-600" />
              ) : (
                <Zap size={16} className="text-amber-600" />
              )}
            </div>
            <span className="text-sm text-text-secondary">Énergie</span>
          </div>
          <p className="text-xl font-semibold text-primary-dark">
            {energyTypeLabels[site.energyType] || site.energyType}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Gauge size={16} className="text-green-600" />
            </div>
            <span className="text-sm text-text-secondary">Compteurs</span>
          </div>
          <p className="text-xl font-semibold text-primary-dark">{meters.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-purple-600" />
            </div>
            <span className="text-sm text-text-secondary">Contrats</span>
          </div>
          <p className="text-xl font-semibold text-primary-dark">
            {site.contractSites?.length || 0}
          </p>
        </div>
      </div>

      {/* References (PCE/PDL) */}
      {(site.pce || site.pdl) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Références distributeur</h3>
          <div className="flex gap-6">
            {site.pce && (
              <div>
                <span className="text-xs text-text-secondary">PCE (Gaz)</span>
                <p className="font-mono text-sm font-medium text-primary-dark">{site.pce}</p>
              </div>
            )}
            {site.pdl && (
              <div>
                <span className="text-xs text-text-secondary">PDL (Électricité)</span>
                <p className="font-mono text-sm font-medium text-primary-dark">{site.pdl}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meters Section */}
      <ChartCard
        title="Schéma de comptage"
        subtitle={`${meters.length} compteur${meters.length > 1 ? "s" : ""} configuré${meters.length > 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("visual")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "visual"
                    ? "bg-white text-accent shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                title="Vue diagramme"
              >
                <Network size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-accent shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
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
            <h3 className="text-lg font-medium text-primary-dark mb-2">
              Aucun compteur configuré
            </h3>
            <p className="text-text-secondary mb-4 text-center max-w-md">
              Configurez le schéma de comptage de ce site pour suivre les consommations
              (gaz, ECS, électricité...)
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

      {/* Formula explanation card */}
      {meters.some((m) => m.children?.some((c) => c.isDeductedFromParent)) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Calcul automatique du chauffage</h4>
              <p className="text-sm text-blue-700 mt-1">
                Les compteurs marqués &quot;Déduit&quot; seront soustraits du compteur principal pour
                calculer la consommation de chauffage.
              </p>
              <p className="text-sm text-blue-700 mt-1 font-mono">
                Chauffage = Gaz Total - (ECS × coefficient Q)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meter Modal */}
      {showMeterModal && (
        <MeterModal
          editingMeter={editingMeter}
          principalMeters={principalMeters}
          siteId={siteId}
          onClose={() => setShowMeterModal(false)}
          onSaved={refreshMeters}
        />
      )}

      {/* Add Reading Modal */}
      {showReadingModal && selectedMeterForReading && (
        <ReadingModal
          meter={selectedMeterForReading}
          siteId={siteId}
          onClose={() => setShowReadingModal(false)}
          onSaved={refreshMeters}
        />
      )}

      {/* Readings History Modal */}
      {showReadingsModal && selectedMeterReadings && (
        <ReadingsHistoryModal
          meter={selectedMeterReadings}
          readings={meterReadings}
          loading={loadingReadings}
          onClose={() => setShowReadingsModal(false)}
        />
      )}
    </div>
  );
}
