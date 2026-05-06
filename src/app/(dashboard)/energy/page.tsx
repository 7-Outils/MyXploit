"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import {
  BarChart3,
  Loader2,
  Flame,
  Building2,
  Download,
} from "lucide-react";
import { TelereleveChartsSection } from "@/components/energy/TelereleveChartsSection";
import { CreateReadingModal } from "@/components/energy/modals/CreateReadingModal";
import { IdexImportModal } from "@/components/energy/modals/IdexImportModal";
import { SyntheseContent } from "@/components/energy/tabs/SyntheseTab";
import { RelevesContent } from "@/components/energy/tabs/RelevesTab";

// Types and constants live in their own files now — see
// src/components/energy/types.ts and src/components/energy/constants.ts
import type {
  Site,
  AnalyticsData,
  Alert,
  EnergyTab as Tab,
} from "@/components/energy/types";


function EnergyPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "synthese";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  // Lazy-mount des onglets : un onglet ne se mount QUE la 1re fois qu'on
  // y va. Avant, les 3 tabs étaient mountés en parallèle et chacun fetchait
  // ses données (analytics ×5, sites ×4, etc.) → 70s de blocage au load.
  // Le set est conservé pour qu'un onglet visité reste mounted (pas de
  // re-fetch au tab-switch).
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(() => new Set([initialTab]));

  // Contract from global context
  const { selectedContract, isLoading: loadingContracts } = useContract();
  const { user } = useUserProfile();

  // Data via SWR : cache cross-page → revisite = instant.
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIdexImportModal, setShowIdexImportModal] = useState(false);
  const [readingsVersion, setReadingsVersion] = useState(0);

  const [importingIdex, setImportingIdex] = useState(false);
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
  const [pendingImportType, setPendingImportType] = useState<"ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET">("RELEVE_MENSUEL");

  // Tab change handler — update state + URL without triggering a navigation
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMountedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `/energy?${params.toString()}`);
  };


  const yearType = selectedContract?.yearType ?? "HEATING_SEASON";
  const isCivil = yearType === "CIVIL";

  // Calculate available years/seasons based on contract dates and yearType
  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11

    // For CIVIL: the period is the calendar year.
    // For HEATING_SEASON / CONTRACTUAL: Jul-Jun, so after July we're in next year's season.
    const currentPeriod = isCivil
      ? currentYear
      : currentMonth >= 6 ? currentYear + 1 : currentYear;

    if (!selectedContract?.startDate) {
      return [currentPeriod];
    }

    const contractStart = new Date(selectedContract.startDate);
    const contractStartYear = contractStart.getFullYear();
    const contractStartMonth = contractStart.getMonth();

    const firstPeriod = isCivil
      ? contractStartYear
      : contractStartMonth >= 6 ? contractStartYear + 1 : contractStartYear;

    const years: number[] = [];
    for (let year = currentPeriod; year >= firstPeriod; year--) {
      years.push(year);
    }

    return years.length > 0 ? years : [currentPeriod];
  };

  const availableYears = getAvailableYears();

  // Reset selected year when contract changes if current selection is not valid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]); // Select most recent valid season
    }
  }, [selectedContract, availableYears, selectedYear]);


  // SWR pour les 3 fetches : cache cross-page → revisiter /energy = instant.
  // readingsVersion suffixe la key pour forcer un re-fetch après import/save.
  const sitesKey = selectedContract
    ? `/api/contracts/${selectedContract.id}/sites?v=${readingsVersion}`
    : null;
  const analyticsKey = selectedContract
    ? `/api/consumptions/analytics?year=${selectedYear}&contractId=${selectedContract.id}&yearType=${yearType}&v=${readingsVersion}`
    : null;
  const alertsKey = selectedContract ? "/api/alerts?type=DERIVE_CONSOMMATION" : null;

  const { data: sitesData, isLoading: sitesLoading } = useSWR<Site[]>(sitesKey, fetcher);
  const { data: analyticsData, isLoading: analyticsLoadingSWR } = useSWR<AnalyticsData>(
    analyticsKey,
    fetcher,
    { keepPreviousData: true }
  );
  const { data: alertsData } = useSWR<Alert[]>(alertsKey, fetcher);

  const sites = useMemo(() => (Array.isArray(sitesData) ? sitesData : []), [sitesData]);
  const alerts = useMemo(() => (Array.isArray(alertsData) ? alertsData : []), [alertsData]);
  const analytics = analyticsData ?? null;
  const loading = sitesLoading || analyticsLoadingSWR;

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
          // setReadingsVersion change la SWR key → re-fetch auto
          setReadingsVersion((v) => v + 1);
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
      {/* Tabs + toolbar — empilés sur mobile, inline sur desktop */}
      <div className="border-b border-gray-200 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-0">
        <nav className="flex gap-6 sm:gap-8 overflow-x-auto -mb-px">
          {[
            { id: "synthese" as Tab, label: "Synthèse", icon: BarChart3 },
            { id: "sites" as Tab, label: "Relevés", icon: Building2 },
            { id: "telereleve" as Tab, label: "Télérelève", icon: Flame },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 py-3 sm:py-4 border-b-2 transition-colors whitespace-nowrap text-sm sm:text-base ${
                activeTab === tab.id
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-text-secondary hover:text-primary-dark"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 pb-2 px-0">
          {activeTab !== "telereleve" && activeTab !== "sites" && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {isCivil ? `Année ${year}` : `Saison ${year - 1}/${year}`}
                </option>
              ))}
            </select>
          )}
          {activeTab === "synthese" && analytics && selectedContract && (
            <button
              type="button"
              onClick={async () => {
                if (exportingPdf) return;
                setExportingPdf(true);
                try {
                  const { exportSynthesisPdf } = await import("@/components/energy/pdf/SynthesisPdf");
                  await exportSynthesisPdf({
                    organizationName: user?.organization?.name ?? "",
                    contractRef: selectedContract.reference,
                    year: selectedYear,
                    yearLabel: isCivil
                      ? `Année ${selectedYear}`
                      : `Saison ${selectedYear - 1}/${selectedYear}`,
                    analytics,
                    activeAlerts,
                  });
                } catch (err) {
                  console.error("Erreur export PDF:", err);
                  alert("Erreur lors de la génération du PDF");
                } finally {
                  setExportingPdf(false);
                }
              }}
              disabled={exportingPdf}
              title="Exporter la synthèse en PDF"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exportingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Lazy-mount: un onglet ne se mount qu'à la 1re visite, puis reste
          mounted (display:none) pour éviter le re-fetch au tab-switch. */}
      <div style={{ display: activeTab === "synthese" ? "block" : "none" }}>
        {mountedTabs.has("synthese") && (
          analytics ? (
            <SyntheseContent
              analytics={analytics}
              activeAlerts={activeAlerts}
              setShowIdexImportModal={setShowIdexImportModal}
              setShowCreateModal={setShowCreateModal}
            />
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : null
        )}
      </div>

      <div style={{ display: activeTab === "sites" ? "block" : "none" }}>
        {mountedTabs.has("sites") && (
          <RelevesContent
            contractId={selectedContract?.id || null}
            setShowIdexImportModal={setShowIdexImportModal}
            setShowCreateModal={setShowCreateModal}
            refreshKey={readingsVersion}
          />
        )}
      </div>

      <div style={{ display: activeTab === "telereleve" ? "block" : "none" }}>
        {mountedTabs.has("telereleve") && (
          <TelereleveContent contractId={selectedContract?.id} yearType={selectedContract?.yearType ?? "HEATING_SEASON"} />
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateReadingModal
          sites={sites}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            // SWR key inclut readingsVersion → re-fetch auto
            setReadingsVersion((v) => v + 1);
          }}
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
  return (
    <div className="space-y-6">
      {contractId && (
        <TelereleveChartsSection
          contractId={contractId}
          yearType={yearType ?? "HEATING_SEASON"}
        />
      )}
    </div>
  );
}
