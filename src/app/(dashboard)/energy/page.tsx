"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useContract } from "@/contexts/ContractContext";
import {
  BarChart3,
  Loader2,
  Flame,
  Building2,
  Thermometer,
  Trash2,
  Target,
  Droplets,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { TelereleveCard } from "@/components/energy/TelereleveCard";
import { DroitsAccesCard } from "@/components/energy/DroitsAccesCard";
import { TelereleveChartsSection } from "@/components/energy/TelereleveChartsSection";
import { CreateConsumptionModal } from "@/components/energy/modals/CreateConsumptionModal";
import { HeatingSeasonModal } from "@/components/energy/modals/HeatingSeasonModal";
import { IdexImportModal } from "@/components/energy/modals/IdexImportModal";
import { DeleteConsumptionsModal } from "@/components/energy/modals/DeleteConsumptionsModal";
import { SyntheseContent } from "@/components/energy/tabs/SyntheseTab";
import { SitesContent } from "@/components/energy/tabs/SitesTab";
import { P1Content } from "@/components/energy/tabs/P1Tab";
import { ClimatContent } from "@/components/energy/tabs/ClimatTab";
import { ECSContent } from "@/components/energy/tabs/EcsTab";

// Types and constants live in their own files now — see
// src/components/energy/types.ts and src/components/energy/constants.ts
import type {
  Site,
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
      {/* Tabs + toolbar on the same row */}
      <div className="border-b border-gray-200 flex items-end justify-between">
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
        <div className="flex items-center gap-2 pb-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                Saison {year - 1}/{year}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            Supprimer données
          </button>
        </div>
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
        <TelereleveContent contractId={selectedContract?.id} yearType={selectedContract?.yearType ?? "HEATING_SEASON"} />
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

function TelereleveContent({ contractId, yearType }: { contractId?: string; yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL" }) {
  // Plumbing (GRDF/Enedis configuration + droits d'accès) is collapsed by
  // default — the chart is what users come here for. Open the section only
  // if they need to configure something.
  const [plumbingOpen, setPlumbingOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* The data — what users actually want to see */}
      {contractId && (
        <TelereleveChartsSection
          contractId={contractId}
          yearType={yearType ?? "HEATING_SEASON"}
        />
      )}

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
