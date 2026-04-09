"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReadOnlyGate } from "@/components/permissions";
import { useContract } from "@/contexts/ContractContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Plus,
  Loader2,
  X,
  Upload,
  FileSpreadsheet,
  Check,
  Flame,
  ThermometerSun,
  Building2,
  FileText,
  Users,
  Snowflake,
  Sun,
  CloudSnow,
  Thermometer,
  Calendar,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Save,
  Target,
  Pencil,
  Award,
  RefreshCw,
  Info,
  Droplets,
  Euro,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { TelereleveCard } from "@/components/energy/TelereleveCard";
import { DroitsAccesCard } from "@/components/energy/DroitsAccesCard";
import { TelereleveChartsSection } from "@/components/energy/TelereleveChartsSection";

// Types
interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: {
    contractSites: number;
  };
}

interface Site {
  id: string;
  name: string;
  type: string;
  nb: number | null;
  djuContractuel: number | null;
}

interface MonthlyData {
  month: string;
  label: string;
  nc: number;
  nbPrime: number;
  djr: number;
  ecs: number;
}

interface SitePerformance {
  siteId: string;
  siteName: string;
  siteType: string;
  city: string;
  energyType: string;
  nb: number | null;
  nbUnit: string | null;
  djuContractuel: number | null;
  stationMeteo: string | null;
  nc: number;
  nbPrime: number;
  djrTotal: number;
  ecsTotal: number;
  mixteTotal: number;
  delta: number;
  deltaPercent: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
  monthlyData: { month: string; nc: number; nbPrime: number; djr: number; ecs: number }[];
  _debug?: {
    heatingSeasonNb: number | null;
    heatingSeasonDjuc: number | null;
    siteDjuc: number | null;
    usedDjuc: number | null;
    djrTotal: number;
    nbKwh: number;
    calculationApplied: boolean;
  };
}

interface AnalyticsData {
  year: number;
  period: { start: string; end: string };
  summary: {
    totalSites: number;
    totalNc: number;
    totalNbPrime: number;
    totalDelta: number;
    deltaPercent: number;
    status: string;
    sitesEnEconomie: number;
    sitesEnDepassement: number;
    sitesObjectifAtteint: number;
  };
  monthlyData: MonthlyData[];
  performanceByType: { type: string; nc: number; nbPrime: number; count: number; deltaPercent: number }[];
  sites: SitePerformance[];
}

interface Alert {
  id: string;
  type: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  title: string;
  message: string;
  site: { id: string; name: string } | null;
  createdAt: string;
  isRead: boolean;
}

interface DJUData {
  year: number;
  period: { start: string; end: string };
  summary: {
    djuReelMoyen: number;
    djuTrentenaireMoyen: number;
    djuTrentenaireToDate: number;
    ecart: number;
    ecartPercent: number;
    interpretation: string;
  };
  monthlyData: { month: string; label: string; dju: number }[];
  sites: {
    siteId: string;
    siteName: string;
    city: string;
    postalCode: string;
    station: string;
    stationCode: string;
    djuTrentenaire: number;
    djuReel: number;
    djuTrentenaireToDate: number;
    ecartTrentenaire: number;
    ecartPercent: number;
    heatingStartDate: string;
    heatingEndDate: string;
    hasHeatingSeason: boolean;
    monthlyData: { month: string; dju: number; avgTemp: number }[];
  }[];
}

interface HeatingSeason {
  id: string;
  siteId: string;
  season: string;
  startDate: string;
  endDate: string | null;
  startIndex: number | null;
  endIndex: number | null;
  notes: string | null;
  nb: number | null;
  nbUnit: "PCS" | "UTILE" | null;
  djuContractuel: number | null;
  site?: { id: string; name: string; city: string };
}

interface Consumption {
  id: string;
  energyType: string;
  usage: string;
  quantity: number;
  unit: string;
  period: string;
  djuReel: number | null;
  cost: number | null;
  site: { id: string; name: string };
}

// Constants
const SITE_TYPE_LABELS: Record<string, string> = {
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

const ENERGY_TYPE_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "RCU",
  EAU: "Eau",
  AUTRE: "Autre",
};

const USAGE_LABELS: Record<string, string> = {
  CHAUFFAGE: "Chauffage",
  ECS: "ECS",
  MIXTE: "Mixte",
  AUTRE: "Autre",
};

type Tab = "synthese" | "sites" | "p1" | "climat" | "ecs" | "telereleve";

function EnergyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "synthese";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract from global context
  const { selectedContract, isLoading: loadingContracts } = useContract();

  // Data states
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [djuData, setDjuData] = useState<DJUData | null>(null);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [heatingSeasons, setHeatingSeasons] = useState<HeatingSeason[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIdexImportModal, setShowIdexImportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHeatingSeasonModal, setShowHeatingSeasonModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importingIdex, setImportingIdex] = useState(false);
  const [savingHeatingSeason, setSavingHeatingSeason] = useState(false);
  const [idexImportResult, setIdexImportResult] = useState<{
    mode: "preview" | "import";
    imported?: number;
    updated?: number;
    skipped: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors?: number;
    siteMatches: Record<string, {
      matched: boolean;
      siteId?: string;
      siteName?: string;
      confidence?: number;
      suggestions?: Array<{ id: string; name: string; score: number }>;
      rowCount?: number;
    }>;
    unmatchedSites?: Array<{
      excelName: string;
      rowCount: number;
      suggestions: Array<{ id: string; name: string; score: number }>;
    }>;
    availableSites?: Array<{ id: string; name: string }>;
    // Preview data: meters grouped by site
    preview?: Array<{
      siteId: string;
      siteName: string;
      meters: Array<{
        meterName: string;
        energyType: string;
        usage: string;
        periods: Array<{ period: string; quantity: number; unit: string }>;
        totalQuantity: number;
      }>;
    }>;
  } | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // Heating season form
  const [heatingSeasonForm, setHeatingSeasonForm] = useState({
    siteId: "",
    siteName: "",
    season: `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
    startDate: "",
    endDate: "",
    notes: "",
    nb: "",
    nbUnit: "PCS" as "PCS" | "UTILE",
    djuContractuel: "",
  });

  // Create form
  const [formData, setFormData] = useState({
    siteId: "",
    energyType: "GAZ",
    usage: "CHAUFFAGE",
    period: "",
    quantity: "",
    unit: "kWh",
    cost: "",
    djuReel: "",
  });


  // Tab change handler
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (selectedContract) {
      params.set("contractId", selectedContract.id);
    }
    router.push(`/energy?${params.toString()}`, { scroll: false });
  };


  // Calculate available seasons based on contract start date
  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11

    // Current heating season: if we're past July, it's the next year's season
    const currentSeason = currentMonth >= 6 ? currentYear + 1 : currentYear;

    if (!selectedContract?.startDate) {
      // Default: just current season
      return [currentSeason];
    }

    const contractStart = new Date(selectedContract.startDate);
    const contractStartYear = contractStart.getFullYear();
    const contractStartMonth = contractStart.getMonth();

    // First heating season: if contract starts before July, it's that year's season
    // If contract starts July or later, it's next year's season
    const firstSeason = contractStartMonth >= 6 ? contractStartYear + 1 : contractStartYear;

    // Generate years from first season to current season
    const years: number[] = [];
    for (let year = currentSeason; year >= firstSeason; year--) {
      years.push(year);
    }

    return years.length > 0 ? years : [currentSeason];
  };

  const availableYears = getAvailableYears();

  // Reset selected year when contract changes if current selection is not valid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]); // Select most recent valid season
    }
  }, [selectedContract, availableYears, selectedYear]);


  const fetchData = useCallback(async () => {
    if (!selectedContract) return;

    try {
      setLoading(true);

      const sitesRes = await fetch(`/api/contracts/${selectedContract.id}/sites`);
      const sitesData = await sitesRes.json();
      setSites(Array.isArray(sitesData) ? sitesData : []);

      const params = new URLSearchParams();
      params.set("year", selectedYear.toString());
      params.set("contractId", selectedContract.id);

      const [analyticsRes, consumptionsRes, alertsRes, djuRes] = await Promise.all([
        fetch(`/api/consumptions/analytics?${params}`),
        fetch(`/api/consumptions?contractId=${selectedContract.id}`),
        fetch("/api/alerts?type=DERIVE_CONSOMMATION"),
        fetch(`/api/dju?contractId=${selectedContract.id}&year=${selectedYear}`),
      ]);

      const [analyticsData, consumptionsData, alertsData, djuDataRes] = await Promise.all([
        analyticsRes.json(),
        consumptionsRes.json(),
        alertsRes.json(),
        djuRes.json(),
      ]);

      if (analyticsRes.ok) setAnalytics(analyticsData);
      if (djuRes.ok) setDjuData(djuDataRes);
      setConsumptions(Array.isArray(consumptionsData) ? consumptionsData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedContract]);

  useEffect(() => {
    if (selectedContract) {
      fetchData();
    }
  }, [fetchData, selectedContract]);

  // Fetch heating seasons
  const fetchHeatingSeasons = useCallback(async () => {
    if (!selectedContract) return;
    try {
      const season = `${selectedYear - 1}-${selectedYear}`;
      const res = await fetch(`/api/heating-seasons?contractId=${selectedContract.id}&season=${season}`);
      if (res.ok) {
        const data = await res.json();
        setHeatingSeasons(data);
      }
    } catch (error) {
      console.error("Error fetching heating seasons:", error);
    }
  }, [selectedContract, selectedYear]);

  useEffect(() => {
    if (selectedContract) {
      fetchHeatingSeasons();
    }
  }, [fetchHeatingSeasons, selectedContract]);

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/consumptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: formData.siteId,
          energyType: formData.energyType,
          usage: formData.usage,
          period: formData.period,
          quantity: formData.quantity,
          unit: formData.unit,
          cost: formData.cost || null,
          djuReel: formData.djuReel || null,
        }),
      });
      if (response.ok) {
        await fetchData();
        setShowCreateModal(false);
        setFormData({
          siteId: "",
          energyType: "GAZ",
          usage: "CHAUFFAGE",
          period: "",
          quantity: "",
          unit: "kWh",
          cost: "",
          djuReel: "",
        });
      }
    } catch (error) {
      console.error("Error creating consumption:", error);
    } finally {
      setCreating(false);
    }
  };

  const openHeatingSeasonModal = (siteId: string, siteName: string, existingStartDate?: string, existingEndDate?: string) => {
    const season = `${selectedYear - 1}-${selectedYear}`;
    const existingSeason = heatingSeasons.find(hs => hs.siteId === siteId);

    setHeatingSeasonForm({
      siteId,
      siteName,
      season,
      startDate: existingSeason?.startDate?.split("T")[0] || existingStartDate || "",
      endDate: existingSeason?.endDate?.split("T")[0] || existingEndDate || "",
      notes: existingSeason?.notes || "",
      nb: existingSeason?.nb?.toString() || "",
      nbUnit: existingSeason?.nbUnit || "PCS",
      djuContractuel: existingSeason?.djuContractuel?.toString() || "",
    });
    setShowHeatingSeasonModal(true);
  };

  const handleSaveHeatingSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heatingSeasonForm.startDate) return;

    setSavingHeatingSeason(true);
    try {
      const existingSeason = heatingSeasons.find(hs => hs.siteId === heatingSeasonForm.siteId);

      const body = {
        siteId: heatingSeasonForm.siteId,
        season: heatingSeasonForm.season,
        startDate: heatingSeasonForm.startDate,
        endDate: heatingSeasonForm.endDate || null,
        notes: heatingSeasonForm.notes || null,
        nb: heatingSeasonForm.nb ? parseFloat(heatingSeasonForm.nb) : null,
        nbUnit: heatingSeasonForm.nb ? heatingSeasonForm.nbUnit : null,
        djuContractuel: heatingSeasonForm.djuContractuel ? parseFloat(heatingSeasonForm.djuContractuel) : null,
      };

      let res;
      if (existingSeason) {
        res = await fetch(`/api/heating-seasons/${existingSeason.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/heating-seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        setShowHeatingSeasonModal(false);
        await fetchHeatingSeasons();
        await fetchData();
      }
    } catch (error) {
      console.error("Error saving heating season:", error);
    } finally {
      setSavingHeatingSeason(false);
    }
  };


  // First step: preview the import
  const handleIdexImport = async (file: File, importType: "ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET") => {
    if (!selectedContract) return;

    setImportingIdex(true);
    setIdexImportResult(null);
    setPendingImportFile(file);
    setPendingImportType(importType); // Save for confirm step

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractId", selectedContract.id);
      formData.append("importType", importType); // Pass import type
      formData.append("preview", "true"); // Preview mode

      const response = await fetch("/api/consumptions/import-idex", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Preview result:", result);

      if (response.ok) {
        setIdexImportResult(result);
      } else {
        alert(result.error || "Erreur lors de l'analyse du fichier");
      }
    } catch (error) {
      console.error("Error previewing IDEX:", error);
      alert("Erreur lors de l'analyse du fichier");
    } finally {
      setImportingIdex(false);
    }
  };

  // Second step: confirm and execute the import
  const [pendingImportType, setPendingImportType] = useState<"ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET">("RELEVE_MENSUEL");

  const handleConfirmIdexImport = async () => {
    if (!selectedContract || !pendingImportFile) return;

    setImportingIdex(true);

    try {
      const formData = new FormData();
      formData.append("file", pendingImportFile);
      formData.append("contractId", selectedContract.id);
      formData.append("importType", pendingImportType); // Pass import type
      // No preview flag = actual import

      const response = await fetch("/api/consumptions/import-idex", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Import result:", result);

      if (response.ok) {
        setIdexImportResult(result);
        if (result.imported > 0 || result.updated > 0) {
          await fetchData();
        }
      } else {
        alert(result.error || "Erreur lors de l'import");
      }
    } catch (error) {
      console.error("Error importing IDEX:", error);
      alert("Erreur lors de l'import");
    } finally {
      setImportingIdex(false);
      setPendingImportFile(null);
    }
  };

  const closeIdexImportModal = () => {
    setShowIdexImportModal(false);
    setIdexImportResult(null);
    setPendingImportFile(null);
  };


  const handleDeleteConsumptions = async (): Promise<void> => {
    if (!selectedContract) return;

    try {
      const response = await fetch(`/api/consumptions?contractId=${selectedContract.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        await fetchData();
      } else {
        alert(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting consumptions:", error);
      alert("Erreur lors de la suppression des consommations");
    }
  };

  // Chart data
  const chartData = analytics?.monthlyData?.map((m) => ({
    label: m.label,
    value: Math.round(m.nc / 1000),
    target: Math.round(m.nbPrime / 1000),
  })) || [];

  const activeAlerts = alerts.filter((a) => !a.isRead);

  // Loading state
  if (loadingContracts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No contract selected
  if (!selectedContract) {
    return (
      <div className="space-y-6">
        <p className="text-text-secondary">
          Sélectionnez un contrat dans la barre supérieure pour analyser les consommations.
        </p>
      </div>
    );
  }

  // Main content with tabs
  return (
    <div className="space-y-6">
      {/* Toolbar — page title removed (the contract is already shown in
          the global selector above) */}
      <div className="flex justify-end gap-2 flex-wrap">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              Saison {year - 1}/{year}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2 text-sm"
        >
          <Trash2 size={16} />
          Supprimer données
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: "synthese" as Tab, label: "Synthèse", icon: BarChart3 },
            { id: "sites" as Tab, label: "Sites", icon: Building2 },
            { id: "p1" as Tab, label: "P1 / Engagement", icon: Target },
            { id: "climat" as Tab, label: "Climat & DJU", icon: Thermometer },
            { id: "ecs" as Tab, label: "ECS", icon: Droplets },
            { id: "telereleve" as Tab, label: "Télérelève", icon: Flame },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-text-secondary hover:text-primary-dark"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {/* Tab Content */}
      {!loading && activeTab === "synthese" && (
        <SyntheseContent
          analytics={analytics}
          chartData={chartData}
          activeAlerts={activeAlerts}
          setShowIdexImportModal={setShowIdexImportModal}
          setShowCreateModal={setShowCreateModal}
          hasContract={!!selectedContract}
        />
      )}

      {!loading && activeTab === "sites" && (
        <SitesContent
          analytics={analytics}
          consumptions={consumptions}
          sites={sites}
          setShowIdexImportModal={setShowIdexImportModal}
          setShowCreateModal={setShowCreateModal}
          hasContract={!!selectedContract}
        />
      )}

      {!loading && activeTab === "p1" && selectedContract && (
        <P1Content
          contract={selectedContract}
          selectedYear={selectedYear}
          sites={sites}
          heatingSeasons={heatingSeasons}
          onNbUpdate={fetchHeatingSeasons}
        />
      )}

      {!loading && activeTab === "climat" && (
        <ClimatContent
          djuData={djuData}
          analytics={analytics}
          selectedYear={selectedYear}
          heatingSeasons={heatingSeasons}
          openHeatingSeasonModal={openHeatingSeasonModal}
          contractId={selectedContract?.id || null}
          onDjuSync={fetchData}
        />
      )}

      {!loading && activeTab === "ecs" && (
        <ECSContent
          analytics={analytics}
          selectedYear={selectedYear}
          contractId={selectedContract?.id || null}
        />
      )}

      {!loading && activeTab === "telereleve" && (
        <TelereleveContent contractId={selectedContract?.id} />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateConsumptionModal
          formData={formData}
          setFormData={setFormData}
          sites={sites}
          creating={creating}
          handleCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}


      {showHeatingSeasonModal && (
        <HeatingSeasonModal
          form={heatingSeasonForm}
          setForm={setHeatingSeasonForm}
          saving={savingHeatingSeason}
          handleSave={handleSaveHeatingSeason}
          onClose={() => setShowHeatingSeasonModal(false)}
        />
      )}

      {showIdexImportModal && (
        <IdexImportModal
          importing={importingIdex}
          importResult={idexImportResult}
          onImport={handleIdexImport}
          onConfirmImport={handleConfirmIdexImport}
          onClose={closeIdexImportModal}
        />
      )}


      {/* Delete Consumptions Modal */}
      {showDeleteModal && (
        <DeleteConsumptionsModal
          contractName={selectedContract?.title || ""}
          onDelete={handleDeleteConsumptions}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

export default function EnergyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <EnergyPageContent />
    </Suspense>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function SyntheseContent({
  analytics,
  chartData,
  activeAlerts,
  setShowIdexImportModal,
  setShowCreateModal,
  hasContract,
}: {
  analytics: AnalyticsData | null;
  chartData: { label: string; value: number; target: number }[];
  activeAlerts: Alert[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  hasContract: boolean;
}) {
  if (!analytics) {
    return (
      <ChartCard title="">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-text-secondary mb-4">Aucune donnée de consommation</p>
          <div className="flex gap-2 flex-wrap justify-center">
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
      </ChartCard>
    );
  }

  const topEconomies = [...analytics.sites]
    .filter(s => s.status === "ECONOMIE")
    .sort((a, b) => a.deltaPercent - b.deltaPercent)
    .slice(0, 5);

  const topDepassements = [...analytics.sites]
    .filter(s => s.status === "DEPASSEMENT")
    .sort((a, b) => b.deltaPercent - a.deltaPercent)
    .slice(0, 5);

  return (
    <>
      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="NC (Conso. réelle)"
          value={`${(analytics.summary.totalNc / 1000).toFixed(0)} MWh`}
          icon={Flame}
          iconColor="text-orange-600"
        />
        <StatsCard
          title="N'B (Théorique)"
          value={`${(analytics.summary.totalNbPrime / 1000).toFixed(0)} MWh`}
          icon={ThermometerSun}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Écart NC/N'B"
          value={`${analytics.summary.deltaPercent > 0 ? "+" : ""}${analytics.summary.deltaPercent}%`}
          change={analytics.summary.status === "ECONOMIE" ? "Économie" : analytics.summary.status === "DEPASSEMENT" ? "Dépassement" : "Objectif atteint"}
          changeType={analytics.summary.deltaPercent <= 0 ? "positive" : "negative"}
          icon={analytics.summary.deltaPercent <= 0 ? TrendingDown : TrendingUp}
          iconColor={analytics.summary.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatsCard
          title="Sites en économie"
          value={`${analytics.summary.sitesEnEconomie}/${analytics.summary.totalSites}`}
          icon={Building2}
          iconColor="text-accent"
        />
        <StatsCard
          title="Alertes dérives"
          value={activeAlerts.length.toString()}
          change={activeAlerts.filter((a) => a.priority === "CRITIQUE").length > 0 ? `${activeAlerts.filter((a) => a.priority === "CRITIQUE").length} critiques` : "Aucune critique"}
          changeType={activeAlerts.filter((a) => a.priority === "CRITIQUE").length > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      {/* Charts and Top/Flop */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard
          title="Consommation mensuelle"
          subtitle="NC (Réel) vs N'B (Théorique ajusté DJU)"
          className="lg:col-span-2"
        >
          {chartData.length > 0 ? (
            <>
              <SimpleBarChart data={chartData} height={250} />
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
                  <span className="text-text-secondary">NC (Conso. réelle)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-200 rounded" />
                  <span className="text-text-secondary">N&apos;B (Théorique)</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-text-secondary">Aucune donnée mensuelle</p>
            </div>
          )}
        </ChartCard>

        {/* Top/Flop Sites */}
        <ChartCard title="Performance sites">
          <div className="space-y-4">
            {topEconomies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                  <ArrowDownRight size={14} />
                  Top économies
                </p>
                <div className="space-y-2">
                  {topEconomies.map((site) => (
                    <Link
                      key={site.siteId}
                      href={`/energy/sites/${site.siteId}`}
                      className="flex items-center justify-between p-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-primary-dark truncate">{site.siteName}</span>
                      <span className="text-sm font-bold text-green-600">{site.deltaPercent}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {topDepassements.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                  <ArrowUpRight size={14} />
                  Top dépassements
                </p>
                <div className="space-y-2">
                  {topDepassements.map((site) => (
                    <Link
                      key={site.siteId}
                      href={`/energy/sites/${site.siteId}`}
                      className="flex items-center justify-between p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-primary-dark truncate">{site.siteName}</span>
                      <span className="text-sm font-bold text-red-600">+{site.deltaPercent}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {topEconomies.length === 0 && topDepassements.length === 0 && (
              <p className="text-sm text-text-secondary text-center py-4">Pas assez de données</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Performance by type */}
      {analytics.performanceByType.length > 0 && (
        <ChartCard title="Performance par type de bâtiment">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.performanceByType.map((item) => (
              <div key={item.type} className="bg-background-secondary rounded-xl p-4 text-center">
                <p className="text-sm text-text-secondary mb-2">
                  {SITE_TYPE_LABELS[item.type] || item.type}
                </p>
                <p className={`text-3xl font-bold ${item.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}`}>
                  {item.deltaPercent > 0 ? "+" : ""}{item.deltaPercent}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{item.count} site{item.count > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <ChartCard title="Alertes dérives actives">
          <div className="space-y-4">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.priority === "CRITIQUE"
                    ? "bg-red-50 border-red-500"
                    : alert.priority === "HAUTE"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-primary-dark">{alert.title}</p>
                    <p className="text-sm text-text-secondary">{alert.message}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      alert.priority === "CRITIQUE"
                        ? "bg-red-100 text-red-600"
                        : alert.priority === "HAUTE"
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {alert.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </>
  );
}

function SitesContent({
  analytics,
  consumptions,
  sites,
  setShowIdexImportModal,
  setShowCreateModal,
  hasContract,
}: {
  analytics: AnalyticsData | null;
  consumptions: Consumption[];
  sites: Site[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  hasContract: boolean;
}) {
  if (!analytics || analytics.sites.length === 0) {
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
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucune donnée de consommation par site</p>
          </div>
        </ChartCard>
      </>
    );
  }

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

      <ChartCard title="Performance par site">
        <div className="overflow-x-auto -mx-6 -my-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">NC (MWh)</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">N&apos;B (MWh)</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Écart</th>
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.sites.map((site) => (
                <tr key={site.siteId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-primary-dark">{site.siteName}</p>
                      <p className="text-xs text-gray-500">{site.city}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                      {SITE_TYPE_LABELS[site.siteType] || site.siteType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">{(site.nc / 1000).toFixed(1)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>{(site.nbPrime / 1000).toFixed(1)}</span>
                      {site._debug && !site._debug.calculationApplied && (
                        <span className="group relative">
                          <Info size={14} className="text-amber-500 cursor-help" />
                          <span className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                            N&apos;B non ajusté : DJR={site._debug.djrTotal}, DJUC={site._debug.usedDjuc || 0}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${site.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}`}>
                    {site.deltaPercent > 0 ? "+" : ""}{site.deltaPercent}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        site.status === "ECONOMIE"
                          ? "bg-green-100 text-green-700"
                          : site.status === "DEPASSEMENT"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {site.status === "ECONOMIE" ? "Économie" : site.status === "DEPASSEMENT" ? "Dépassement" : "Objectif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/energy/sites/${site.siteId}`}
                      className="inline-flex items-center gap-1 text-accent hover:underline text-sm"
                    >
                      Détail
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Recent consumptions */}
      {consumptions.length > 0 && (
        <ChartCard title="Derniers relevés">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Énergie</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Usage</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Période</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Quantité</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">DJU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumptions.slice(0, 10).map((consumption) => (
                  <tr key={consumption.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-primary-dark">{consumption.site?.name || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          consumption.energyType === "ELECTRICITE"
                            ? "bg-yellow-100 text-yellow-700"
                            : consumption.energyType === "GAZ"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ENERGY_TYPE_LABELS[consumption.energyType] || consumption.energyType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                        {USAGE_LABELS[consumption.usage] || consumption.usage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {new Date(consumption.period).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-primary-dark">
                      {consumption.quantity.toLocaleString()} {consumption.unit}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {consumption.djuReel ? `${consumption.djuReel} DJU` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </>
  );
}

function P1Content({
  contract,
  selectedYear,
  sites,
  heatingSeasons,
  onNbUpdate,
}: {
  contract: Contract;
  selectedYear: number;
  sites: Site[];
  heatingSeasons: HeatingSeason[];
  onNbUpdate: () => void;
}) {
  const [editingCell, setEditingCell] = useState<{ siteId: string; year: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [allSeasons, setAllSeasons] = useState<HeatingSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  // Calculate contract years
  const getContractYears = () => {
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    // Calculate contract duration in years (rounded)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationYears = Math.round(durationMs / (1000 * 60 * 60 * 24 * 365));

    // First heating season: if contract starts before July (month < 6),
    // season ends that year. Otherwise, season ends next year.
    const firstSeason = startMonth >= 6 ? startYear + 1 : startYear;

    const years: { year: number; season: string }[] = [];
    // Limit to actual contract duration
    for (let i = 0; i < durationYears && i < 10; i++) {
      const seasonYear = firstSeason + i;
      years.push({
        year: i + 1,
        season: `${seasonYear - 1}-${seasonYear}`,
      });
    }
    return years;
  };

  const contractYears = getContractYears();

  // Fetch all heating seasons for the contract
  useEffect(() => {
    const fetchAllSeasons = async () => {
      setLoadingSeasons(true);
      try {
        const res = await fetch(`/api/heating-seasons?contractId=${contract.id}`);
        if (res.ok) {
          const data = await res.json();
          setAllSeasons(data);
        }
      } catch (error) {
        console.error("Error fetching heating seasons:", error);
      } finally {
        setLoadingSeasons(false);
      }
    };
    fetchAllSeasons();
  }, [contract.id]);

  // Get NB for a site and season
  const getNbForSiteSeason = (siteId: string, season: string) => {
    const hs = allSeasons.find((s) => s.siteId === siteId && s.season === season);
    return hs?.nb ?? null;
  };

  // Filter sites that have at least one NB value
  const sitesWithEngagement = sites.filter((site) =>
    contractYears.some((cy) => getNbForSiteSeason(site.id, cy.season) !== null)
  );

  // Calculate KPIs
  const calculateKpis = () => {
    // Get year 1 NB total (reference)
    const year1Season = contractYears[0]?.season;
    let year1Total = 0;
    let currentYearTotal = 0;
    let sitesWithNb = 0;

    // Find current year's season
    const currentSeason = `${selectedYear - 1}-${selectedYear}`;

    sites.forEach((site) => {
      const year1Nb = getNbForSiteSeason(site.id, year1Season);
      const currentNb = getNbForSiteSeason(site.id, currentSeason);

      if (year1Nb) year1Total += year1Nb;
      if (currentNb) {
        currentYearTotal += currentNb;
        sitesWithNb++;
      }
    });

    // APE = (NB Année 1 - NB Année N) / NB Année 1 * 100
    const apeProgress = year1Total > 0 ? ((year1Total - currentYearTotal) / year1Total) * 100 : 0;
    const savings = year1Total - currentYearTotal;

    return {
      year1Total,
      currentYearTotal,
      apeProgress,
      savings,
      sitesWithNb,
      totalSites: sites.length,
    };
  };

  const kpis = calculateKpis();

  // Handle inline edit
  const startEdit = (siteId: string, year: number, season: string) => {
    const currentValue = getNbForSiteSeason(siteId, season);
    setEditingCell({ siteId, year });
    setEditValue(currentValue?.toString() || "");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEdit = async (siteId: string, season: string) => {
    setSaving(true);
    try {
      const nbValue = editValue ? parseFloat(editValue) : null;
      const existing = allSeasons.find((s) => s.siteId === siteId && s.season === season);

      if (existing) {
        // Update existing
        await fetch(`/api/heating-seasons/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nb: nbValue }),
        });
      } else if (nbValue !== null) {
        // Create new
        const [startYear] = season.split("-").map(Number);
        await fetch("/api/heating-seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            season,
            startDate: new Date(startYear, 6, 1).toISOString(), // July 1st
            nb: nbValue,
            nbUnit: "PCS",
          }),
        });
      }

      // Refresh data
      const res = await fetch(`/api/heating-seasons?contractId=${contract.id}`);
      if (res.ok) {
        setAllSeasons(await res.json());
      }
      onNbUpdate();
    } catch (error) {
      console.error("Error saving NB:", error);
    } finally {
      setSaving(false);
      setEditingCell(null);
      setEditValue("");
    }
  };

  // Current year index
  const currentYearIndex = contractYears.findIndex((y) => y.season === `${selectedYear - 1}-${selectedYear}`);

  if (loadingSeasons) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Header with Import Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-primary-dark flex items-center gap-2">
            <Award className="text-amber-500" size={24} />
            Engagement Énergétique (P1)
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Suivi des Niveaux de Base (NB) et de l&apos;Amélioration de la Performance Énergétique (APE)
          </p>
        </div>
      </div>

      {/* KPIs Section */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target size={20} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-700">NB Année 1</span>
          </div>
          <p className="text-3xl font-bold text-amber-900">
            {kpis.year1Total > 0 ? kpis.year1Total.toLocaleString("fr-FR") : "-"}
          </p>
          <p className="text-xs text-amber-600 mt-1">MWh PCS (référence)</p>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">NB Année {currentYearIndex + 1 || "-"}</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {kpis.currentYearTotal > 0 ? kpis.currentYearTotal.toLocaleString("fr-FR") : "-"}
          </p>
          <p className="text-xs text-blue-600 mt-1">MWh PCS (saison {selectedYear - 1}/{selectedYear})</p>
        </div>

        <div className={`rounded-xl p-4 text-center ${kpis.apeProgress >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {kpis.apeProgress >= 0 ? (
              <TrendingDown size={20} className="text-green-600" />
            ) : (
              <TrendingUp size={20} className="text-red-600" />
            )}
            <span className={`text-sm font-medium ${kpis.apeProgress >= 0 ? "text-green-700" : "text-red-700"}`}>
              APE Cumulée
            </span>
          </div>
          <p className={`text-3xl font-bold ${kpis.apeProgress >= 0 ? "text-green-900" : "text-red-900"}`}>
            {kpis.year1Total > 0 ? `${kpis.apeProgress >= 0 ? "-" : "+"}${Math.abs(kpis.apeProgress).toFixed(1)}%` : "-"}
          </p>
          <p className={`text-xs mt-1 ${kpis.apeProgress >= 0 ? "text-green-600" : "text-red-600"}`}>
            {kpis.savings > 0 ? `${kpis.savings.toLocaleString("fr-FR")} MWh économisés` : kpis.savings < 0 ? `${Math.abs(kpis.savings).toLocaleString("fr-FR")} MWh en plus` : "vs Année 1"}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Sites suivis</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.sitesWithNb}</p>
          <p className="text-xs text-gray-600 mt-1">sur {kpis.totalSites} sites du contrat</p>
        </div>
      </div>

      {/* Multi-year NB Table */}
      <ChartCard title="Niveaux de Base par site et par année" subtitle="Cliquez sur une cellule pour modifier la valeur">
        <div className="overflow-x-auto -mx-6 -my-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 sticky left-0 bg-background-secondary z-10">
                  Site
                </th>
                {contractYears.map((cy) => (
                  <th
                    key={cy.year}
                    className={`text-center text-xs font-medium uppercase tracking-wider px-4 py-3 min-w-[100px] ${
                      cy.season === `${selectedYear - 1}-${selectedYear}`
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary"
                    }`}
                  >
                    <div>Année {cy.year}</div>
                    <div className="text-[10px] font-normal normal-case">{cy.season}</div>
                  </th>
                ))}
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                  Évolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sitesWithEngagement.map((site) => {
                const year1Nb = getNbForSiteSeason(site.id, contractYears[0]?.season);
                const lastYearWithNb = [...contractYears].reverse().find((cy) => getNbForSiteSeason(site.id, cy.season));
                const lastNb = lastYearWithNb ? getNbForSiteSeason(site.id, lastYearWithNb.season) : null;
                const evolution = year1Nb && lastNb ? ((year1Nb - lastNb) / year1Nb) * 100 : null;

                return (
                  <tr key={site.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      <p className="font-medium text-primary-dark text-sm">{site.name}</p>
                    </td>
                    {contractYears.map((cy) => {
                      const nb = getNbForSiteSeason(site.id, cy.season);
                      const isEditing = editingCell?.siteId === site.id && editingCell?.year === cy.year;
                      const isCurrent = cy.season === `${selectedYear - 1}-${selectedYear}`;

                      return (
                        <td
                          key={cy.year}
                          className={`px-4 py-2 text-center ${isCurrent ? "bg-primary/5" : ""}`}
                        >
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 px-2 py-1 text-sm border rounded text-center"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(site.id, cy.season);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <button
                                onClick={() => saveEdit(site.id, cy.season)}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(site.id, cy.year, cy.season)}
                              className={`px-3 py-1 rounded transition-colors min-w-[60px] ${
                                nb
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              {nb ? nb.toLocaleString("fr-FR") : "-"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {evolution !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            evolution >= 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {evolution >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {evolution >= 0 ? "-" : "+"}
                          {Math.abs(evolution).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-primary-dark sticky left-0 bg-gray-50 z-10">
                  TOTAL
                </td>
                {contractYears.map((cy) => {
                  const total = sites.reduce((sum, site) => {
                    const nb = getNbForSiteSeason(site.id, cy.season);
                    return sum + (nb || 0);
                  }, 0);
                  const isCurrent = cy.season === `${selectedYear - 1}-${selectedYear}`;

                  return (
                    <td
                      key={cy.year}
                      className={`px-4 py-3 text-center font-semibold ${
                        isCurrent ? "bg-primary/10 text-primary" : "text-primary-dark"
                      }`}
                    >
                      {total > 0 ? total.toLocaleString("fr-FR") : "-"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {kpis.apeProgress !== 0 && kpis.year1Total > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        kpis.apeProgress >= 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {kpis.apeProgress >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {kpis.apeProgress >= 0 ? "-" : "+"}
                      {Math.abs(kpis.apeProgress).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Qu&apos;est-ce que le NB (Niveau de Base) ?</p>
          <p className="text-blue-700">
            Le NB représente l&apos;engagement contractuel de consommation énergétique pour chaque site.
            Il est exprimé en MWh PCS et diminue chaque année selon le coefficient APE (Amélioration de la Performance Énergétique)
            défini dans le contrat P1. La consommation réelle (NC) est comparée au NB corrigé climatiquement (N&apos;B) pour
            déterminer si les objectifs sont atteints.
          </p>
        </div>
      </div>
    </>
  );
}

function ClimatContent({
  djuData,
  analytics,
  selectedYear,
  heatingSeasons,
  openHeatingSeasonModal,
  contractId,
  onDjuSync,
}: {
  djuData: DJUData | null;
  analytics: AnalyticsData | null;
  selectedYear: number;
  heatingSeasons: HeatingSeason[];
  openHeatingSeasonModal: (siteId: string, siteName: string, startDate?: string, endDate?: string) => void;
  contractId: string | null;
  onDjuSync: () => void;
}) {
  const { profile } = useUserProfile();
  // CLIENT must never see the manual sync plumbing — DJU is refreshed every
  // night by the /api/cron/dju-sync Vercel Cron (vercel.json).
  const showSyncButton = profile !== "CLIENT";
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; total: number; errors?: string[] } | null>(null);

  // Filter DJU data to only show months with consumption
  const monthsWithConsumption = new Set(
    analytics?.monthlyData.filter(m => m.nc > 0).map(m => m.month) || []
  );

  // Filter monthly DJU data
  const filteredMonthlyData = djuData?.monthlyData.filter(m =>
    monthsWithConsumption.has(m.month)
  ) || [];

  // Calculate filtered DJU total
  const filteredDjuTotal = filteredMonthlyData.reduce((sum, m) => sum + m.dju, 0);

  // Build consumption by site for site-level filtering
  const consumptionBySite = new Map<string, Set<string>>();
  analytics?.sites.forEach(site => {
    const monthsWithData = new Set(
      site.monthlyData.filter(m => m.nc > 0).map(m => m.month)
    );
    consumptionBySite.set(site.siteId, monthsWithData);
  });

  const handleSyncDju = async () => {
    if (!contractId) {
      setSyncResult({ updated: 0, total: 0, errors: ["Veuillez sélectionner un contrat"] });
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/dju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, overwrite: true }),
      });
      const data = await res.json();
      setSyncResult({
        updated: data.updated || 0,
        total: data.total || 0,
        errors: data.errors || (data.error ? [data.error] : undefined)
      });
      if (data.updated > 0) {
        onDjuSync(); // Refresh analytics data
      }
    } catch {
      setSyncResult({ updated: 0, total: 0, errors: ["Erreur de connexion"] });
    } finally {
      setSyncing(false);
    }
  };

  if (!djuData) {
    return (
      <ChartCard title="">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Thermometer className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-text-secondary">Aucune donnée météo disponible</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <>
      {/* Sync DJU header — manual button only for AMO/EXPLOITANT */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-primary-dark">DJU réels</h3>
          <p className="text-sm text-text-secondary">
            {showSyncButton
              ? "Récupère les DJU réels depuis la station météo et les applique aux consommations"
              : "Vos DJU sont mis à jour automatiquement chaque nuit."}
          </p>
        </div>
        {showSyncButton && (
          <ReadOnlyGate>
            <button
              onClick={handleSyncDju}
              disabled={syncing || !contractId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Synchroniser DJU
                </>
              )}
            </button>
          </ReadOnlyGate>
        )}
      </div>

      {syncResult && (
        <div className={`p-4 rounded-lg ${syncResult.updated > 0 ? "bg-green-50 text-green-800" : syncResult.errors?.length ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
          {syncResult.updated > 0 ? (
            <p className="font-medium">✓ {syncResult.updated}/{syncResult.total} consommations mises à jour avec les DJU réels</p>
          ) : syncResult.errors?.length ? (
            <div>
              <p className="font-medium mb-2">✗ Erreurs lors de la synchronisation :</p>
              <ul className="list-disc list-inside text-sm">
                {syncResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : syncResult.total === 0 ? (
            <p className="font-medium">ℹ Aucune consommation trouvée. Importez d&apos;abord les consommations.</p>
          ) : (
            <p className="font-medium">ℹ Toutes les consommations ({syncResult.total}) ont déjà des DJU réels</p>
          )}
        </div>
      )}

      {/* DJU Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Snowflake size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">DJU Réels</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{filteredDjuTotal}</p>
          <p className="text-xs text-blue-600 mt-1">Cumul mois avec consommation</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Thermometer size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">DJU Trentenaire</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{djuData.summary.djuTrentenaireToDate}</p>
          <p className="text-xs text-gray-600 mt-1">Attendu à ce jour (moy. 30 ans)</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${djuData.summary.ecart > 0 ? "bg-cyan-50" : "bg-orange-50"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {djuData.summary.ecart > 0 ? (
              <CloudSnow size={20} className="text-cyan-600" />
            ) : (
              <Sun size={20} className="text-orange-600" />
            )}
            <span className={`text-sm font-medium ${djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"}`}>
              Écart
            </span>
          </div>
          <p className={`text-3xl font-bold ${djuData.summary.ecart > 0 ? "text-cyan-900" : "text-orange-900"}`}>
            {djuData.summary.ecart > 0 ? "+" : ""}{djuData.summary.ecart}
          </p>
          <p className={`text-xs mt-1 ${djuData.summary.ecart > 0 ? "text-cyan-600" : "text-orange-600"}`}>
            {djuData.summary.ecartPercent > 0 ? "+" : ""}{djuData.summary.ecartPercent}% vs trentenaire
          </p>
        </div>
        <div className={`rounded-xl p-4 text-center ${djuData.summary.ecart > 0 ? "bg-cyan-100" : "bg-orange-100"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <ThermometerSun size={20} className={djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"} />
            <span className={`text-sm font-medium ${djuData.summary.ecart > 0 ? "text-cyan-800" : "text-orange-800"}`}>
              Interprétation
            </span>
          </div>
          <p className={`text-sm font-semibold ${djuData.summary.ecart > 0 ? "text-cyan-900" : "text-orange-900"}`}>
            {djuData.summary.interpretation}
          </p>
          <p className={`text-xs mt-2 ${djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"}`}>
            {djuData.summary.ecart > 0 ? "Besoins de chauffage supérieurs" : "Besoins de chauffage inférieurs"}
          </p>
        </div>
      </div>

      {/* DJU Monthly Chart - filtered by months with consumption */}
      {filteredMonthlyData.length > 0 && (
        <ChartCard title="DJU mensuels" subtitle={`Saison ${selectedYear - 1}/${selectedYear}`}>
          {(() => {
            const maxDju = Math.max(...filteredMonthlyData.map((d) => d.dju), 1);
            const barAreaHeight = 120; // pixels
            return (
              <div className="flex items-end gap-2" style={{ height: barAreaHeight + 40 }}>
                {filteredMonthlyData.map((m) => {
                  const barHeight = (m.dju / maxDju) * barAreaHeight;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: barAreaHeight + 40 }}>
                      <span className="text-xs font-medium text-primary-dark mb-1">{m.dju}</span>
                      <div
                        className="w-full max-w-12 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                        style={{ height: Math.max(barHeight, m.dju > 0 ? 4 : 0) }}
                      />
                      <span className="text-xs text-text-secondary mt-1">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </ChartCard>
      )}

      {/* DJU by Site with Heating Seasons */}
      {djuData.sites.length > 0 && (
        <ChartCard title="DJU par site (station météo)" subtitle="Cliquez sur une période pour la modifier">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Site</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Station</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Période</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Réel</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Trent.</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {djuData.sites.map((site) => {
                  return (
                    <tr key={site.siteId} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-primary-dark">{site.siteName}</p>
                        <p className="text-xs text-gray-500">{site.postalCode} {site.city}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-700 font-medium">{site.station}</p>
                        <p className="text-xs text-gray-400">DJU trent. {site.djuTrentenaire}</p>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openHeatingSeasonModal(site.siteId, site.siteName, site.heatingStartDate, site.heatingEndDate)}
                          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                            site.hasHeatingSeason
                              ? "bg-gradient-to-r from-green-50 to-blue-50 text-gray-700 hover:from-green-100 hover:to-blue-100 border border-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          <Calendar size={12} />
                          <span>
                            {site.hasHeatingSeason ? (
                              <>
                                <span className="text-green-700 font-medium">
                                  {new Date(site.heatingStartDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                </span>
                                <span className="mx-1 text-gray-400">→</span>
                                <span className="text-blue-700 font-medium">
                                  {site.heatingEndDate
                                    ? new Date(site.heatingEndDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                                    : "..."}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{site.djuReel}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{site.djuTrentenaireToDate}</td>
                      <td className={`px-3 py-2 text-right font-medium ${site.ecartTrentenaire > 0 ? "text-blue-600" : "text-orange-600"}`}>
                        {site.ecartTrentenaire > 0 ? "+" : ""}{site.ecartTrentenaire}
                        <span className="text-xs ml-1">({site.ecartPercent > 0 ? "+" : ""}{site.ecartPercent}%)</span>
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

// Prix de référence Component
function PrixReferenceContent() {
  const [prices, setPrices] = useState<{
    PEG?: { value: number; date: string; source?: string };
    TICGN?: { value: number; date: string; source?: string };
    CEE?: { value: number; date: string; source?: string };
    TVD?: { value: number; date: string; source?: string };
  }>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrice, setNewPrice] = useState({
    type: "PEG",
    value: "",
    date: new Date().toISOString().split("T")[0],
    source: "",
    notes: "",
  });

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const response = await fetch("/api/energy-prices");
      const data = await response.json();

      if (data.success) {
        const latestPrices: Record<string, { value: number; date: string; source?: string }> = {};
        Object.entries(data.latest).forEach(([type, priceData]: [string, any]) => {
          latestPrices[type] = {
            value: priceData.value,
            date: new Date(priceData.date).toLocaleDateString("fr-FR"),
            source: priceData.source,
          };
        });
        setPrices(latestPrices);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrice = async () => {
    try {
      const response = await fetch("/api/energy-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrice),
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchPrices();
        setNewPrice({
          type: "PEG",
          value: "",
          date: new Date().toISOString().split("T")[0],
          source: "",
          notes: "",
        });
      }
    } catch (error) {
      console.error("Error adding price:", error);
    }
  };

  const handleSyncPrices = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/energy-prices/sync", {
        method: "POST",
      });

      if (response.ok) {
        await fetchPrices();
      }
    } catch (error) {
      console.error("Error syncing prices:", error);
    } finally {
      setSyncing(false);
    }
  };

  const priceConfig = {
    PEG: {
      label: "PEG (Point d'Échange de Gaz)",
      description: "Prix spot du gaz naturel sur le marché de gros",
      color: "blue",
      unit: "€/MWh",
    },
    TICGN: {
      label: "TICGN (Accise sur le gaz)",
      description: "Taxe Intérieure de Consommation sur le Gaz Naturel",
      color: "red",
      unit: "€/MWh",
    },
    CEE: {
      label: "CEE (Certificats d'Économies d'Énergie)",
      description: "Prix des certificats sur le marché EMMY",
      color: "green",
      unit: "€/MWh cumac",
    },
    TVD: {
      label: "TVD (Tarif Distribution)",
      description: "Tarif de distribution GRDF",
      color: "purple",
      unit: "€/MWh",
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary-dark">Prix de référence du gaz naturel</h2>
          <p className="text-sm text-gray-600">Composantes tarifaires et taxes applicables</p>
        </div>
        <ReadOnlyGate>
          <div className="flex gap-2">
            <Button
              onClick={handleSyncPrices}
              variant="outline"
              className="gap-2"
              disabled={syncing}
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus size={16} />
              Ajouter un prix
            </Button>
          </div>
        </ReadOnlyGate>
      </div>

      {/* Price cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Object.entries(priceConfig).map(([type, config]) => {
          const price = prices[type as keyof typeof prices];
          const colorClasses = {
            blue: { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-100", icon: "text-blue-600", text: "text-blue-700" },
            red: { bg: "bg-red-50", border: "border-red-100", iconBg: "bg-red-100", icon: "text-red-600", text: "text-red-700" },
            green: { bg: "bg-green-50", border: "border-green-100", iconBg: "bg-green-100", icon: "text-green-600", text: "text-green-700" },
            purple: { bg: "bg-purple-50", border: "border-purple-100", iconBg: "bg-purple-100", icon: "text-purple-600", text: "text-purple-700" },
          };
          const colors = colorClasses[config.color as keyof typeof colorClasses];

          return (
            <div
              key={type}
              className={`${colors.bg} rounded-xl p-4 border-2 ${colors.border}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                  <Euro size={20} className={colors.icon} />
                </div>
                {price && (
                  <span className="text-xs text-gray-500">{price.date}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">{config.label}</h3>
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{config.description}</p>
              {price ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${colors.text}`}>
                      {price.value.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">{config.unit}</span>
                  </div>
                  {price.source && (
                    <p className="text-xs text-gray-500 mt-1">Source: {price.source}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Aucune donnée</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Info card */}
      <ChartCard title="À propos des prix de référence" subtitle="Sources et mises à jour">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700 mb-2">
                <strong>PEG :</strong> Prix spot du gaz naturel, fluctue quotidiennement selon l'offre et la demande.
                Données gratuites disponibles sur JeChange.fr ou autres plateformes publiques.
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>TICGN :</strong> Taxe gouvernementale fixée annuellement (19,83 €/MWh en 2026).
                Mise à jour le 1er février de chaque année.
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>CEE :</strong> Prix des certificats d'économies d'énergie sur le registre EMMY
                (~8,49 €/MWh en novembre 2025). Consultable sur emmy.fr.
              </p>
              <p className="text-sm text-gray-700">
                <strong>TVD :</strong> Tarif de distribution GRDF, variable selon la zone géographique et le profil de consommation.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <ExternalLink size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Sources gratuites recommandées :</p>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>
                  <a href="https://www.emmy.fr/public/donnees-mensuelles" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    EMMY - Prix CEE mensuels (gratuit)
                  </a>
                </li>
                <li>
                  <a href="https://www.jechange.fr/energie/gaz/guides/prix-peg" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    JeChange.fr - Prix PEG en direct (gratuit)
                  </a>
                </li>
                <li>
                  <a href="https://www.grdf.fr/institutionnel/role-transition-energetique/tarifs-reglemente-distribution" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    GRDF - Grilles tarifaires TVD (gratuit)
                  </a>
                </li>
                <li>
                  <a href="https://www.ecologie.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Ministère - Guide fiscalité énergies (TICGN)
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </ChartCard>

      {/* Add price modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Ajouter un prix de référence</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de prix</label>
                <select
                  value={newPrice.type}
                  onChange={(e) => setNewPrice({ ...newPrice, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="PEG">PEG - Point d'Échange de Gaz</option>
                  <option value="TICGN">TICGN - Accise sur le gaz</option>
                  <option value="CEE">CEE - Certificats d'Économies d'Énergie</option>
                  <option value="TVD">TVD - Tarif de Distribution</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valeur ({priceConfig[newPrice.type as keyof typeof priceConfig]?.unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newPrice.value}
                  onChange={(e) => setNewPrice({ ...newPrice, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ex: 26.79"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date d'application</label>
                <input
                  type="date"
                  value={newPrice.date}
                  onChange={(e) => setNewPrice({ ...newPrice, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source (optionnel)</label>
                <input
                  type="text"
                  value={newPrice.source}
                  onChange={(e) => setNewPrice({ ...newPrice, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ex: EMMY, Selectra, manuel..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea
                  value={newPrice.notes}
                  onChange={(e) => setNewPrice({ ...newPrice, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Informations additionnelles..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddPrice}
                disabled={!newPrice.value || !newPrice.date}
                className="flex-1"
              >
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ECSContent({
  analytics,
  selectedYear,
  contractId,
}: {
  analytics: AnalyticsData | null;
  selectedYear: number;
  contractId: string | null;
}) {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <Droplets size={48} className="mx-auto mb-4 opacity-50" />
        <p>Aucune donnée ECS disponible</p>
      </div>
    );
  }

  // Calculate total ECS consumption across all sites
  // Note: ecsTotal is water-based ECS only (m³), heat-based ECS is tracked separately
  const totalECS = analytics.sites.reduce((sum, site) => sum + site.ecsTotal, 0);

  // Filter sites that have ECS consumption
  const sitesWithECS = analytics.sites.filter(site => site.ecsTotal > 0);

  // Calculate monthly ECS totals
  const monthlyECS = new Map<string, number>();
  analytics.sites.forEach(site => {
    site.monthlyData.forEach(month => {
      if (month.ecs > 0) {
        const existing = monthlyECS.get(month.month) || 0;
        monthlyECS.set(month.month, existing + month.ecs);
      }
    });
  });

  const monthlyECSData = Array.from(monthlyECS.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ecs]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short" }),
      ecs: Math.round(ecs),
    }));

  return (
    <>
      {/* Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Droplets size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">ECS Total</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{totalECS.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-blue-600 mt-1">m³ - Saison {selectedYear - 1}/{selectedYear}</p>
        </div>

        <div className="bg-cyan-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 size={20} className="text-cyan-600" />
            <span className="text-sm font-medium text-cyan-700">Sites avec ECS</span>
          </div>
          <p className="text-3xl font-bold text-cyan-900">{sitesWithECS.length}</p>
          <p className="text-xs text-cyan-600 mt-1">sur {analytics.sites.length} sites</p>
        </div>

        <div className="bg-teal-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar size={20} className="text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Moyenne mensuelle</span>
          </div>
          <p className="text-3xl font-bold text-teal-900">
            {monthlyECSData.length > 0 ? Math.round(totalECS / monthlyECSData.length).toLocaleString('fr-FR') : "0"}
          </p>
          <p className="text-xs text-teal-600 mt-1">m³ / mois</p>
        </div>
      </div>

      {/* Monthly ECS Chart */}
      {monthlyECSData.length > 0 && (
        <ChartCard title="Consommation ECS mensuelle" subtitle={`Saison ${selectedYear - 1}/${selectedYear}`}>
          {(() => {
            const maxEcs = Math.max(...monthlyECSData.map((d) => d.ecs), 1);
            const barAreaHeight = 120;
            return (
              <div className="flex items-end gap-2" style={{ height: barAreaHeight + 40 }}>
                {monthlyECSData.map((m) => {
                  const barHeight = (m.ecs / maxEcs) * barAreaHeight;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: barAreaHeight + 40 }}>
                      <span className="text-xs font-medium text-primary-dark mb-1">{Math.round(m.ecs).toLocaleString('fr-FR')}</span>
                      <div
                        className="w-full max-w-12 bg-gradient-to-t from-blue-500 to-cyan-300 rounded-t"
                        style={{ height: Math.max(barHeight, m.ecs > 0 ? 4 : 0) }}
                      />
                      <span className="text-xs text-text-secondary mt-1">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </ChartCard>
      )}

      {/* Sites ECS Table */}
      {sitesWithECS.length > 0 && (
        <ChartCard title="ECS par site" subtitle={`${sitesWithECS.length} sites avec consommation ECS`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">Ville</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">ECS (m³)</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">% du total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesWithECS
                  .sort((a, b) => b.ecsTotal - a.ecsTotal)
                  .map((site) => {
                    const percentOfTotal = totalECS > 0 ? (site.ecsTotal / totalECS) * 100 : 0;
                    return (
                      <tr key={site.siteId} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-primary-dark">{site.siteName}</p>
                          <p className="text-xs text-gray-500">{site.siteType}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{site.city}</td>
                        <td className="px-3 py-2 text-right font-medium text-blue-600">
                          {Math.round(site.ecsTotal).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{percentOfTotal.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-semibold text-primary-dark">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700">{Math.round(totalECS).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ChartCard>
      )}

      {sitesWithECS.length === 0 && (
        <div className="text-center py-12 text-text-secondary bg-gray-50 rounded-lg">
          <Droplets size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">Aucune consommation ECS enregistrée</p>
          <p className="text-sm mt-2">Les consommations ECS apparaîtront ici une fois saisies avec le type d'usage "ECS"</p>
        </div>
      )}
    </>
  );
}

function TelereleveContent({ contractId }: { contractId?: string }) {
  // Plumbing (GRDF/Enedis configuration + droits d'accès) is collapsed by
  // default — the chart is what users come here for. Open the section only
  // if they need to configure something.
  const [plumbingOpen, setPlumbingOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* The data — what users actually want to see */}
      {contractId && <TelereleveChartsSection contractId={contractId} />}

      {/* The plumbing — folded behind a disclosure */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <button
          onClick={() => setPlumbingOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-primary-dark">
              Configuration & droits d&apos;accès
            </span>
            <span className="text-xs text-text-secondary">
              GRDF, Enedis, mandats
            </span>
          </div>
          {plumbingOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {plumbingOpen && (
          <div className="border-t border-gray-200 p-4 space-y-6">
            <TelereleveCard contractId={contractId} />
            <DroitsAccesCard />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function CreateConsumptionModal({
  formData,
  setFormData,
  sites,
  creating,
  handleCreate,
  onClose,
}: {
  formData: { siteId: string; energyType: string; usage: string; period: string; quantity: string; unit: string; cost: string; djuReel: string };
  setFormData: (data: typeof formData) => void;
  sites: Site[];
  creating: boolean;
  handleCreate: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Saisir un relevé</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Site *</label>
            <select
              required
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Sélectionner un site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;énergie *</label>
              <select
                required
                value={formData.energyType}
                onChange={(e) => {
                  const type = e.target.value;
                  let unit = "kWh";
                  if (type === "EAU") unit = "m³";
                  if (type === "FIOUL") unit = "L";
                  setFormData({ ...formData, energyType: type, unit });
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="GAZ">Gaz</option>
                <option value="ELECTRICITE">Électricité</option>
                <option value="RESEAU_CHALEUR">Réseau de chaleur</option>
                <option value="FIOUL">Fioul</option>
                <option value="BOIS">Bois</option>
                <option value="EAU">Eau</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Usage *</label>
              <select
                required
                value={formData.usage}
                onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="CHAUFFAGE">Chauffage</option>
                <option value="ECS">ECS (Eau chaude)</option>
                <option value="MIXTE">Mixte (Chauff + ECS)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Période *</label>
            <input
              type="month"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Quantité *</label>
              <div className="flex">
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="12500"
                />
                <span className="px-4 py-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-gray-600">
                  {formData.unit}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">DJU Réels</label>
              <input
                type="number"
                step="0.1"
                value={formData.djuReel}
                onChange={(e) => setFormData({ ...formData, djuReel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="350"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Coût (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="1250.50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={creating}>
              {creating ? (
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
  );
}

function HeatingSeasonModal({
  form,
  setForm,
  saving,
  handleSave,
  onClose,
}: {
  form: { siteId: string; siteName: string; season: string; startDate: string; endDate: string; notes: string; nb: string; nbUnit: "PCS" | "UTILE"; djuContractuel: string };
  setForm: (f: typeof form) => void;
  saving: boolean;
  handleSave: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Période de chauffe</h2>
            <p className="text-sm text-text-secondary mt-1">
              {form.siteName} - Saison {form.season}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Calendar className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Dates d&apos;allumage et d&apos;arrêt
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Ces dates sont transmises par l&apos;exploitant au début de chaque saison.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Date d&apos;allumage *
            </label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Date d&apos;arrêt
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="text-xs text-gray-500 mt-1">Laissez vide si la saison est en cours</p>
          </div>

          {/* Engagement énergétique (NB) */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <div className="bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="text-amber-600 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Engagement énergétique (NB)
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Niveau de Base de la saison (peut varier avec l&apos;APE)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  NB (MWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.nb}
                  onChange={(e) => setForm({ ...form, nb: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Ex: 150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Unité
                </label>
                <select
                  value={form.nbUnit}
                  onChange={(e) => setForm({ ...form, nbUnit: e.target.value as "PCS" | "UTILE" })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="PCS">PCS</option>
                  <option value="UTILE">Utile</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-primary-dark mb-1">
                DJU Contractuels
              </label>
              <input
                type="number"
                step="1"
                value={form.djuContractuel}
                onChange={(e) => setForm({ ...form, djuContractuel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Ex: 2450"
              />
              <p className="text-xs text-gray-500 mt-1">Laissez vide pour utiliser les DJU du site</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              placeholder="Observations, APE appliquée..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !form.startDate}>
              {saving ? (
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
  );
}

function IdexImportModal({
  importing,
  importResult,
  onImport,
  onConfirmImport,
  onClose,
}: {
  importing: boolean;
  importResult: {
    mode: "preview" | "import";
    imported?: number;
    updated?: number;
    skipped: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors?: number;
    siteMatches: Record<string, {
      matched: boolean;
      siteId?: string;
      siteName?: string;
      confidence?: number;
      suggestions?: Array<{ id: string; name: string; score: number }>;
      rowCount?: number;
    }>;
    unmatchedSites?: Array<{
      excelName: string;
      rowCount: number;
      suggestions: Array<{ id: string; name: string; score: number }>;
    }>;
    availableSites?: Array<{ id: string; name: string }>;
    preview?: Array<{
      siteId: string;
      siteName: string;
      meters: Array<{
        meterName: string;
        energyType: string;
        usage: string;
        periods: Array<{ period: string; quantity: number; unit: string }>;
        totalQuantity: number;
      }>;
    }>;
  } | null;
  onImport: (file: File, importType: "ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET") => void;
  onConfirmImport: () => void;
  onClose: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET">("RELEVE_MENSUEL");
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [mappingsSaved, setMappingsSaved] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onImport(selectedFile, importType);
    }
  };

  const handleMappingChange = (excelName: string, siteId: string) => {
    setManualMappings(prev => ({
      ...prev,
      [excelName]: siteId
    }));
  };

  const handleSaveMappings = async () => {
    const mappingsToSave = Object.entries(manualMappings).filter(([, siteId]) => siteId);
    if (mappingsToSave.length === 0) return;

    setSavingMappings(true);
    try {
      const response = await fetch("/api/site-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mappingsToSave.map(([alias, siteId]) => ({
            alias,
            siteId,
            source: "EXPLOITANT"
          }))
        ),
      });

      if (response.ok) {
        setMappingsSaved(true);
      }
    } catch (error) {
      console.error("Error saving mappings:", error);
    } finally {
      setSavingMappings(false);
    }
  };

  const unmatchedSites = importResult?.unmatchedSites ||
    (importResult ? Object.entries(importResult.siteMatches)
      .filter(([, v]) => !v.matched)
      .map(([excelName, v]) => ({
        excelName,
        rowCount: v.rowCount || 0,
        suggestions: v.suggestions || []
      })) : []);
  const matchedSites = importResult
    ? Object.entries(importResult.siteMatches).filter(([, v]) => v.matched)
    : [];
  const availableSites = importResult?.availableSites || [];
  const hasMappingsToSave = Object.values(manualMappings).some(v => v);

  // Debug
  console.log("Modal - importResult:", importResult);
  console.log("Modal - unmatchedSites:", unmatchedSites);
  console.log("Modal - matchedSites:", matchedSites);
  console.log("Modal - availableSites:", availableSites);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Import Exploitant</h2>
            <p className="text-sm text-text-secondary mt-1">
              Importez les relevés de consommation de votre exploitant (IDEX, Engie, Dalkia...)
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type d'import selector */}
          {!importResult && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm font-semibold text-primary-dark mb-3">Type d'import</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setImportType("ALLUMAGE")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "ALLUMAGE"
                      ? "border-green-500 bg-green-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-green-300"
                  }`}
                >
                  <div className="text-center">
                    <Flame className={`mx-auto mb-1 ${importType === "ALLUMAGE" ? "text-green-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "ALLUMAGE" ? "text-green-700" : "text-gray-600"}`}>
                      Allumage
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Init. dates démarrage</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("RELEVE_MENSUEL")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "RELEVE_MENSUEL"
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="text-center">
                    <BarChart3 className={`mx-auto mb-1 ${importType === "RELEVE_MENSUEL" ? "text-blue-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "RELEVE_MENSUEL" ? "text-blue-700" : "text-gray-600"}`}>
                      Relevé mensuel
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Conso uniquement</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("ARRET")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "ARRET"
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-red-300"
                  }`}
                >
                  <div className="text-center">
                    <Snowflake className={`mx-auto mb-1 ${importType === "ARRET" ? "text-red-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "ARRET" ? "text-red-700" : "text-gray-600"}`}>
                      Arrêt chauffage
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Clôture saison</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Flame className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">Formats exploitants supportés</p>
                <p className="text-xs text-blue-600 mt-1">
                  Fichiers Excel avec colonnes : Date, Site/Installation, Compteur, Conso, Unité, Fluide...
                </p>
                <ul className="text-xs text-blue-600 mt-2 space-y-0.5">
                  <li>• <strong>Gaz</strong> (CPT GAZ, GRDF, Gaz naturel...) → Chauffage P1</li>
                  <li>• <strong>ECS</strong> (Eau chaude, Sanitaire...) → Eau chaude sanitaire</li>
                  <li>• <strong>Électricité</strong> (Enedis, kWh élec...) → Consommation électrique</li>
                  <li>• <strong>Eau appoint</strong> (Remplissage...) → Indicateur maintenance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upload */}
          {!importResult && (
            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                selectedFile ? "border-accent bg-accent/5" : "border-gray-300 hover:border-accent"
              }`}>
                <FileSpreadsheet className={`w-12 h-12 mx-auto mb-4 ${selectedFile ? "text-accent" : "text-gray-400"}`} />
                {selectedFile ? (
                  <>
                    <p className="text-lg font-medium text-primary-dark mb-1">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Cliquez pour changer de fichier
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-primary-dark mb-2">
                      Sélectionnez le fichier Excel de l&apos;exploitant
                    </p>
                    <p className="text-sm text-text-secondary">
                      Formats: .xlsx, .xls (IDEX, Engie, Dalkia, etc.)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {/* Preview Mode */}
          {importResult?.mode === "preview" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-blue-600" size={24} />
                  <div>
                    <p className="font-semibold text-primary-dark">Prévisualisation</p>
                    <p className="text-sm text-text-secondary">
                      {importResult.preview?.length || 0} site(s) trouvé(s), {importResult.skipped} ligne(s) ignorée(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview by site with meters */}
              {importResult.preview && importResult.preview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    Compteurs par site :
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-80 overflow-y-auto space-y-4">
                    {importResult.preview.map((site) => (
                      <div key={site.siteId} className="border-b border-gray-200 pb-3 last:border-0">
                        <p className="font-medium text-primary-dark text-sm mb-2">{site.siteName}</p>
                        <div className="space-y-1 pl-3">
                          {site.meters.map((meter, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                              <div className="flex-1">
                                <span className="font-medium text-gray-700">{meter.meterName || "Sans nom"}</span>
                                <span className="text-gray-500 ml-2">({meter.energyType} - {meter.usage})</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-primary-dark">
                                  {meter.totalQuantity.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} {meter.periods[0]?.unit || "kWh"}
                                </span>
                                <span className="text-gray-500 ml-1">({meter.periods.length} période(s))</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched sites for manual mapping */}
              {unmatchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                    <AlertTriangle size={16} />
                    Sites non reconnus ({unmatchedSites.length})
                  </p>
                  <div className="bg-amber-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-3">
                      {unmatchedSites.map((site) => (
                        <div key={site.excelName} className="border-b border-amber-200 pb-2 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-amber-900 truncate">{site.excelName}</p>
                              <p className="text-xs text-amber-600">{site.rowCount} ligne(s)</p>
                            </div>
                            <select
                              className="text-xs border border-amber-300 rounded px-2 py-1 bg-white max-w-[200px]"
                              value={manualMappings[site.excelName] || ""}
                              onChange={(e) => handleMappingChange(site.excelName, e.target.value)}
                            >
                              <option value="">-- Sélectionner --</option>
                              {site.suggestions.length > 0 && (
                                <optgroup label="Suggestions">
                                  {site.suggestions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} ({Math.round(s.score * 100)}%)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Tous les sites">
                                {availableSites.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {hasMappingsToSave && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveMappings}
                        disabled={savingMappings}
                        className="text-xs"
                      >
                        {savingMappings ? (
                          <><Loader2 size={14} className="mr-1 animate-spin" />Enregistrement...</>
                        ) : mappingsSaved ? (
                          <><Check size={14} className="mr-1" />Enregistré</>
                        ) : (
                          <><Save size={14} className="mr-1" />Enregistrer correspondances</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResult?.mode === "import" && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${
                (importResult.totalErrors || 0) === 0 ? "bg-green-50" : "bg-yellow-50"
              }`}>
                <div className="flex items-center gap-3">
                  {(importResult.totalErrors || 0) === 0 ? (
                    <Check className="text-green-600" size={24} />
                  ) : (
                    <AlertTriangle className="text-yellow-600" size={24} />
                  )}
                  <div>
                    <p className="font-semibold text-primary-dark">Import terminé</p>
                    <p className="text-sm text-text-secondary">
                      {importResult.imported || 0} créés, {importResult.updated || 0} mis à jour, {importResult.skipped} ignorés
                      {(importResult.totalErrors || 0) > 0 && `, ${importResult.totalErrors} erreurs`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched sites */}
              {matchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Check size={16} />
                    Sites importés ({matchedSites.length})
                  </p>
                  <div className="bg-green-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {matchedSites.map(([idexName, match]) => (
                        <div key={idexName} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate">{idexName}</span>
                          <span className="text-green-700 font-medium ml-2">→ {match.siteName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {importResult?.mode === "import" ? (
              <Button className="flex-1" onClick={onClose}>Fermer</Button>
            ) : importResult?.mode === "preview" ? (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2"
                  onClick={onConfirmImport}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Import en cours...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <span>Confirmer l&apos;import</span>
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2"
                  onClick={handleSubmit}
                  disabled={importing || !selectedFile}
                >
                  {importing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Analyse...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={18} />
                      <span>Analyser le fichier</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de suppression des consommations
function DeleteConsumptionsModal({
  contractName,
  onDelete,
  onClose,
}: {
  contractName: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="text-red-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-primary-dark">Supprimer les consommations</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-sm text-red-800">
              <strong>Attention :</strong> Cette action est irréversible. Toutes les consommations du contrat seront supprimées.
            </p>
          </div>

          <p className="text-sm text-text-secondary">
            Vous êtes sur le point de supprimer toutes les consommations du contrat <strong>&quot;{contractName}&quot;</strong>.
          </p>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
              Annuler
            </Button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Supprimer tout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal d'import des NB (DPGF)
