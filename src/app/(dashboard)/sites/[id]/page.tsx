"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Plus,
  Loader2,
  X,
  ArrowLeft,
  Gauge,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Activity,
  Flame,
  Zap,
  Droplets,
  Thermometer,
  GitBranch,
  FileText,
  AlertCircle,
  CheckCircle,
  Calendar,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

// Types
type MeterType = "PRINCIPAL" | "DIVISIONNAIRE";
type MeterFluid = "GAZ" | "ELECTRICITE" | "EAU_CHAUDE" | "EAU_FROIDE" | "CHALEUR" | "FIOUL";
type MeterDataSource = "API" | "MANUEL";

interface MeterReading {
  id: string;
  readingDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  indexValue: number | null;
  consumption: number | null;
  unit: string;
  consumptionConverted: number | null;
  unitConverted: string | null;
  source: MeterDataSource;
  isValidated: boolean;
  notes: string | null;
}

interface Meter {
  id: string;
  name: string;
  reference: string | null;
  type: MeterType;
  fluid: MeterFluid;
  dataSource: MeterDataSource;
  unit: string;
  parentId: string | null;
  isDeductedFromParent: boolean;
  conversionCoefficient: number | null;
  conversionUnit: string | null;
  isActive: boolean;
  children?: Meter[];
  readings?: MeterReading[];
  _count?: {
    readings: number;
  };
}

interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  surfaceChauffee: number | null;
  energyType: string;
  pce: string | null;
  pdl: string | null;
  meters?: Meter[];
  contractSites?: {
    id: string;
    contractType: string;
    hasP1: boolean;
    hasP2: boolean;
    hasP3: boolean;
    contract: {
      id: string;
      reference: string;
      title: string;
    };
  }[];
}

// Labels
const siteTypeLabels: Record<string, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

const energyTypeLabels: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  AUTRE: "Autre",
};

const meterTypeLabels: Record<MeterType, string> = {
  PRINCIPAL: "Principal (Distributeur)",
  DIVISIONNAIRE: "Divisionnaire (Sous-compteur)",
};

const meterFluidLabels: Record<MeterFluid, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "Eau chaude (ECS)",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

const meterFluidIcons: Record<MeterFluid, typeof Flame> = {
  GAZ: Flame,
  ELECTRICITE: Zap,
  EAU_CHAUDE: Droplets,
  EAU_FROIDE: Droplets,
  CHALEUR: Thermometer,
  FIOUL: Droplets,
};

const dataSourceLabels: Record<MeterDataSource, string> = {
  API: "Télérelevé (API)",
  MANUEL: "Relevé manuel",
};

const unitOptions = [
  { value: "m3", label: "m³" },
  { value: "kWh", label: "kWh" },
  { value: "MWh", label: "MWh" },
  { value: "L", label: "Litres" },
];

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

  // Modal states
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [savingMeter, setSavingMeter] = useState(false);

  const [showReadingModal, setShowReadingModal] = useState(false);
  const [selectedMeterForReading, setSelectedMeterForReading] = useState<Meter | null>(null);
  const [savingReading, setSavingReading] = useState(false);

  const [showReadingsModal, setShowReadingsModal] = useState(false);
  const [selectedMeterReadings, setSelectedMeterReadings] = useState<Meter | null>(null);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  // Meter form state
  const [meterForm, setMeterForm] = useState({
    name: "",
    reference: "",
    type: "DIVISIONNAIRE" as MeterType,
    fluid: "GAZ" as MeterFluid,
    dataSource: "MANUEL" as MeterDataSource,
    unit: "m3",
    parentId: "",
    isDeductedFromParent: false,
    conversionCoefficient: "",
    conversionUnit: "",
  });

  // Reading form state
  const [readingForm, setReadingForm] = useState({
    readingDate: new Date().toISOString().split("T")[0],
    indexValue: "",
    consumption: "",
    unit: "m3",
    source: "MANUEL" as MeterDataSource,
    notes: "",
  });

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
    setMeterForm({
      name: "",
      reference: "",
      type: "DIVISIONNAIRE",
      fluid: "GAZ",
      dataSource: "MANUEL",
      unit: "m3",
      parentId: "",
      isDeductedFromParent: false,
      conversionCoefficient: "",
      conversionUnit: "",
    });
    setShowMeterModal(true);
  };

  // Open meter modal for edit
  const openEditMeterModal = (meter: Meter) => {
    setEditingMeter(meter);
    setMeterForm({
      name: meter.name,
      reference: meter.reference || "",
      type: meter.type,
      fluid: meter.fluid,
      dataSource: meter.dataSource,
      unit: meter.unit,
      parentId: meter.parentId || "",
      isDeductedFromParent: meter.isDeductedFromParent,
      conversionCoefficient: meter.conversionCoefficient?.toString() || "",
      conversionUnit: meter.conversionUnit || "",
    });
    setShowMeterModal(true);
  };

  // Save meter (create or update)
  const handleSaveMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeter(true);

    try {
      const payload = {
        name: meterForm.name,
        reference: meterForm.reference || null,
        type: meterForm.type,
        fluid: meterForm.fluid,
        dataSource: meterForm.dataSource,
        unit: meterForm.unit,
        parentId: meterForm.parentId || null,
        isDeductedFromParent: meterForm.isDeductedFromParent,
        conversionCoefficient: meterForm.conversionCoefficient
          ? parseFloat(meterForm.conversionCoefficient)
          : null,
        conversionUnit: meterForm.conversionUnit || null,
      };

      const url = editingMeter
        ? `/api/sites/${siteId}/meters/${editingMeter.id}`
        : `/api/sites/${siteId}/meters`;

      const response = await fetch(url, {
        method: editingMeter ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      // Refresh meters
      const metersRes = await fetch(`/api/sites/${siteId}/meters`);
      if (metersRes.ok) {
        setMeters(await metersRes.json());
      }

      setShowMeterModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingMeter(false);
    }
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

      // Refresh meters
      const metersRes = await fetch(`/api/sites/${siteId}/meters`);
      if (metersRes.ok) {
        setMeters(await metersRes.json());
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  // Open reading modal
  const openAddReadingModal = (meter: Meter) => {
    setSelectedMeterForReading(meter);
    setReadingForm({
      readingDate: new Date().toISOString().split("T")[0],
      indexValue: "",
      consumption: "",
      unit: meter.unit,
      source: "MANUEL",
      notes: "",
    });
    setShowReadingModal(true);
  };

  // Save reading
  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeterForReading) return;
    setSavingReading(true);

    try {
      const payload = {
        readingDate: readingForm.readingDate,
        indexValue: readingForm.indexValue ? parseFloat(readingForm.indexValue) : null,
        consumption: readingForm.consumption ? parseFloat(readingForm.consumption) : null,
        unit: readingForm.unit,
        source: readingForm.source,
        notes: readingForm.notes || null,
      };

      const response = await fetch(
        `/api/sites/${siteId}/meters/${selectedMeterForReading.id}/readings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'ajout du relevé");
      }

      // Refresh meters to update reading count
      const metersRes = await fetch(`/api/sites/${siteId}/meters`);
      if (metersRes.ok) {
        setMeters(await metersRes.json());
      }

      setShowReadingModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingReading(false);
    }
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

  // Render meter tree recursively
  const renderMeterTree = (meterList: Meter[], level = 0) => {
    return meterList.map((meter) => {
      const hasChildren = meter.children && meter.children.length > 0;
      const isExpanded = expandedMeters.has(meter.id);
      const FluidIcon = meterFluidIcons[meter.fluid] || Activity;

      return (
        <div key={meter.id}>
          <div
            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
              level > 0 ? "ml-6 border-l-2 border-gray-200" : ""
            }`}
          >
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => toggleMeter(meter.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Icon */}
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                meter.type === "PRINCIPAL"
                  ? "bg-accent/10"
                  : meter.isDeductedFromParent
                  ? "bg-orange-50"
                  : "bg-gray-100"
              }`}
            >
              <FluidIcon
                size={20}
                className={
                  meter.type === "PRINCIPAL"
                    ? "text-accent"
                    : meter.isDeductedFromParent
                    ? "text-orange-500"
                    : "text-gray-500"
                }
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-primary-dark truncate">{meter.name}</p>
                {meter.type === "PRINCIPAL" && (
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Principal
                  </span>
                )}
                {meter.isDeductedFromParent && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    Déduit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span>{meterFluidLabels[meter.fluid]}</span>
                {meter.reference && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-xs">{meter.reference}</span>
                  </>
                )}
                <span className="text-gray-300">•</span>
                <span>{dataSourceLabels[meter.dataSource]}</span>
                {meter.conversionCoefficient && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>
                      Q={meter.conversionCoefficient} {meter.conversionUnit}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Reading count */}
            <div className="text-right">
              <p className="text-sm font-medium text-primary-dark">
                {meter._count?.readings || 0}
              </p>
              <p className="text-xs text-text-secondary">relevés</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => openAddReadingModal(meter)}
                className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                title="Ajouter un relevé"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => openReadingsModal(meter)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Historique des relevés"
              >
                <Activity size={16} />
              </button>
              <button
                onClick={() => openEditMeterModal(meter)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Modifier"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDeleteMeter(meter)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="mt-1">{renderMeterTree(meter.children!, level + 1)}</div>
          )}
        </div>
      );
    });
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
          <Button onClick={openCreateMeterModal}>
            <Plus size={18} className="mr-2" />
            Ajouter un compteur
          </Button>
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
        ) : (
          <div className="space-y-2">{renderMeterTree(meterTree)}</div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                {editingMeter ? "Modifier le compteur" : "Nouveau compteur"}
              </h2>
              <button
                onClick={() => setShowMeterModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMeter} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Nom du compteur *
                </label>
                <input
                  type="text"
                  required
                  value={meterForm.name}
                  onChange={(e) => setMeterForm({ ...meterForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: Compteur gaz principal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type de compteur *
                  </label>
                  <select
                    required
                    value={meterForm.type}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, type: e.target.value as MeterType })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(meterTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Fluide *
                  </label>
                  <select
                    required
                    value={meterForm.fluid}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, fluid: e.target.value as MeterFluid })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(meterFluidLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Source des données *
                  </label>
                  <select
                    required
                    value={meterForm.dataSource}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, dataSource: e.target.value as MeterDataSource })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(dataSourceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Unité *</label>
                  <select
                    required
                    value={meterForm.unit}
                    onChange={(e) => setMeterForm({ ...meterForm, unit: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Référence (PCE, PDL, n° série)
                </label>
                <input
                  type="text"
                  value={meterForm.reference}
                  onChange={(e) => setMeterForm({ ...meterForm, reference: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: GI123456"
                />
              </div>

              {meterForm.type === "DIVISIONNAIRE" && principalMeters.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Rattaché au compteur principal
                    </label>
                    <select
                      value={meterForm.parentId}
                      onChange={(e) => setMeterForm({ ...meterForm, parentId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    >
                      <option value="">Aucun (indépendant)</option>
                      {principalMeters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {meterForm.parentId && (
                    <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="isDeducted"
                        checked={meterForm.isDeductedFromParent}
                        onChange={(e) =>
                          setMeterForm({ ...meterForm, isDeductedFromParent: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-accent focus:ring-accent"
                      />
                      <label htmlFor="isDeducted" className="text-sm text-orange-800">
                        <span className="font-medium">Déduit du principal</span>
                        <br />
                        <span className="text-orange-600">
                          Ce compteur sera soustrait pour calculer le chauffage
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* Conversion coefficient (for ECS) */}
              {meterForm.fluid === "EAU_CHAUDE" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Coefficient Q (MWh/m³)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={meterForm.conversionCoefficient}
                      onChange={(e) =>
                        setMeterForm({ ...meterForm, conversionCoefficient: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                      placeholder="Ex: 0.12"
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      Entre 0.10 et 0.14 selon le contrat
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Unité convertie
                    </label>
                    <select
                      value={meterForm.conversionUnit}
                      onChange={(e) =>
                        setMeterForm({ ...meterForm, conversionUnit: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    >
                      <option value="">-</option>
                      <option value="MWh">MWh</option>
                      <option value="kWh">kWh</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowMeterModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={savingMeter}>
                  {savingMeter ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : editingMeter ? (
                    "Modifier"
                  ) : (
                    "Créer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Reading Modal */}
      {showReadingModal && selectedMeterForReading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Nouveau relevé</h2>
                <p className="text-sm text-text-secondary">{selectedMeterForReading.name}</p>
              </div>
              <button
                onClick={() => setShowReadingModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReading} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Date du relevé *
                </label>
                <input
                  type="date"
                  required
                  value={readingForm.readingDate}
                  onChange={(e) => setReadingForm({ ...readingForm, readingDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Index compteur
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={readingForm.indexValue}
                    onChange={(e) => setReadingForm({ ...readingForm, indexValue: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Ex: 12345.67"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Consommation ({selectedMeterForReading.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={readingForm.consumption}
                    onChange={(e) => setReadingForm({ ...readingForm, consumption: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Ex: 150"
                  />
                </div>
              </div>

              {selectedMeterForReading.conversionCoefficient && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  La consommation sera convertie automatiquement :
                  <br />
                  <span className="font-mono">
                    × {selectedMeterForReading.conversionCoefficient} ={" "}
                    {selectedMeterForReading.conversionUnit}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Notes</label>
                <textarea
                  value={readingForm.notes}
                  onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Observations éventuelles..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowReadingModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={savingReading}>
                  {savingReading ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Readings History Modal */}
      {showReadingsModal && selectedMeterReadings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Historique des relevés</h2>
                <p className="text-sm text-text-secondary">{selectedMeterReadings.name}</p>
              </div>
              <button
                onClick={() => setShowReadingsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingReadings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              ) : meterReadings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Activity size={48} className="text-gray-300 mb-4" />
                  <p className="text-text-secondary">Aucun relevé enregistré</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-text-secondary">Date</th>
                      <th className="text-right px-4 py-2 font-medium text-text-secondary">Index</th>
                      <th className="text-right px-4 py-2 font-medium text-text-secondary">
                        Conso ({selectedMeterReadings.unit})
                      </th>
                      {selectedMeterReadings.conversionCoefficient && (
                        <th className="text-right px-4 py-2 font-medium text-text-secondary">
                          Converti ({selectedMeterReadings.conversionUnit})
                        </th>
                      )}
                      <th className="text-center px-4 py-2 font-medium text-text-secondary">
                        Source
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-text-secondary">
                        Validé
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {meterReadings.map((reading) => (
                      <tr key={reading.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {new Date(reading.readingDate).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {reading.indexValue?.toLocaleString("fr-FR") || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">
                          {reading.consumption?.toLocaleString("fr-FR") || "-"}
                        </td>
                        {selectedMeterReadings.conversionCoefficient && (
                          <td className="px-4 py-3 text-right font-mono">
                            {reading.consumptionConverted?.toLocaleString("fr-FR", {
                              maximumFractionDigits: 2,
                            }) || "-"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              reading.source === "API"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {reading.source === "API" ? "API" : "Manuel"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {reading.isValidated ? (
                            <CheckCircle size={16} className="text-green-500 inline" />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <Button variant="outline" className="w-full" onClick={() => setShowReadingsModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
