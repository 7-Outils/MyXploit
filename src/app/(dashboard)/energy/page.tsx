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
import { CreateConsumptionModal } from "@/components/energy/modals/CreateConsumptionModal";
import { HeatingSeasonModal } from "@/components/energy/modals/HeatingSeasonModal";
import { IdexImportModal } from "@/components/energy/modals/IdexImportModal";
import { DeleteConsumptionsModal } from "@/components/energy/modals/DeleteConsumptionsModal";

// Types and constants live in their own files now — see
// src/components/energy/types.ts and src/components/energy/constants.ts
import type {
  Contract,
  Site,
  MonthlyData,
  SitePerformance,
  AnalyticsData,
  Alert,
  DJUData,
  HeatingSeason,
  Consumption,
  EnergyTab as Tab,
} from "@/components/energy/types";
import {
  SITE_TYPE_LABELS,
  ENERGY_TYPE_LABELS,
  USAGE_LABELS,
} from "@/components/energy/constants";

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
