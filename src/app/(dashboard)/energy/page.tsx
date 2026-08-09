"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
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
  Gauge,
} from "lucide-react";
import { TelereleveChartsSection } from "@/components/energy/TelereleveChartsSection";
import { CreateReadingModal } from "@/components/energy/modals/CreateReadingModal";
import { SyntheseContent } from "@/components/energy/tabs/SyntheseTab";
// RelevesTab embarque echarts (core + charts + renderer). L'onglet n'étant
// monté qu'à la demande, on le sort du bundle initial.
const RelevesContent = dynamic(
  () => import("@/components/energy/tabs/RelevesTab").then((m) => m.RelevesContent),
  { ssr: false }
);
import { CoefficientsContent } from "@/components/energy/tabs/CoefficientsTab";
import { sortTabsAlpha } from "@/lib/utils";

// Types and constants live in their own files now — see
// src/components/energy/types.ts and src/components/energy/constants.ts
import type {
  Site,
  AnalyticsData,
  Alert,
  EnergyTab as Tab,
} from "@/components/energy/types";

const ENERGY_TABS = sortTabsAlpha([
  { id: "coefficients" as Tab, label: "Coefficients", icon: Gauge },
  { id: "synthese" as Tab, label: "Synthèse", icon: BarChart3 },
  { id: "sites" as Tab, label: "Relevés", icon: Building2 },
  { id: "telereleve" as Tab, label: "Télérelève", icon: Flame },
]);

function EnergyPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || ENERGY_TABS[0].id;

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

  // Modals — l'import exploitant a sa propre page (/energy/import, moteur universel)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [readingsVersion, setReadingsVersion] = useState(0);

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
      <div className="border-b border-ink/10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-0">
        <nav className="flex gap-6 sm:gap-8 overflow-x-auto -mb-px">
          {ENERGY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 pb-2 px-0">
          {activeTab !== "telereleve" && activeTab !== "sites" && activeTab !== "coefficients" && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border border-ink/20 bg-white px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
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
              className="flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
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

      <div style={{ display: activeTab === "coefficients" ? "block" : "none" }}>
        {mountedTabs.has("coefficients") && (
          <CoefficientsContent contractId={selectedContract?.id || null} />
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
