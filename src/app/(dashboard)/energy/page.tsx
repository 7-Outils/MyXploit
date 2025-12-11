"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { TelereleveCard } from "@/components/energy/TelereleveCard";

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

type Tab = "synthese" | "sites" | "climat" | "telereleve";

function EnergyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "synthese";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [showIdexImportModal, setShowIdexImportModal] = useState(false);
  const [showHeatingSeasonModal, setShowHeatingSeasonModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingIdex, setImportingIdex] = useState(false);
  const [savingHeatingSeason, setSavingHeatingSeason] = useState(false);
  const [idexImportResult, setIdexImportResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors: number;
    siteMatches: Record<string, { matched: boolean; siteId?: string; siteName?: string }>;
  } | null>(null);

  // Heating season form
  const [heatingSeasonForm, setHeatingSeasonForm] = useState({
    siteId: "",
    siteName: "",
    season: `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
    startDate: "",
    endDate: "",
    notes: "",
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

  // Import state
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({
    site: "",
    period: "",
    quantity: "",
    cost: "",
    dju: "",
    energyType: "",
    usage: "",
    pce: "",
    pdl: "",
  });
  const [importOptions, setImportOptions] = useState({
    energyType: "GAZ",
    usage: "CHAUFFAGE",
    unit: "kWh",
  });
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors: number;
  } | null>(null);

  // Tab change handler
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    router.push(`/energy?tab=${tab}`, { scroll: false });
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

  // Fetch contracts on mount
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await fetch("/api/contracts");
        const data = await res.json();
        setContracts(Array.isArray(data) ? data.filter((c: Contract) => c.status === "ACTIF") : []);
      } catch (error) {
        console.error("Error fetching contracts:", error);
      } finally {
        setLoadingContracts(false);
      }
    };
    fetchContracts();
  }, []);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        alert("Le fichier CSV doit contenir au moins un en-tête et une ligne de données");
        return;
      }

      const separator = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ""));
      setCsvHeaders(headers);

      const data = lines.slice(1).map((line) => {
        const values = line.split(separator).map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return row;
      });

      setCsvData(data);

      const autoMapping = { ...mapping };
      headers.forEach((h) => {
        const lowerH = h.toLowerCase();
        if (lowerH.includes("site") || lowerH.includes("nom") || lowerH.includes("batiment")) {
          autoMapping.site = h;
        } else if (lowerH.includes("period") || lowerH.includes("mois") || lowerH.includes("date")) {
          autoMapping.period = h;
        } else if (lowerH.includes("quantit") || lowerH.includes("conso") || lowerH.includes("kwh") || lowerH.includes("volume")) {
          autoMapping.quantity = h;
        } else if (lowerH.includes("cout") || lowerH.includes("prix") || lowerH.includes("montant") || lowerH === "€") {
          autoMapping.cost = h;
        } else if (lowerH.includes("dju") || lowerH.includes("degr")) {
          autoMapping.dju = h;
        } else if (lowerH.includes("pce")) {
          autoMapping.pce = h;
        } else if (lowerH.includes("pdl") || lowerH.includes("prm")) {
          autoMapping.pdl = h;
        } else if (lowerH.includes("energie") || lowerH.includes("type")) {
          autoMapping.energyType = h;
        } else if (lowerH.includes("usage")) {
          autoMapping.usage = h;
        }
      });
      setMapping(autoMapping);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!mapping.site || !mapping.period || !mapping.quantity) {
      alert("Veuillez mapper au moins: Site, Période et Quantité");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/consumptions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: csvData,
          mapping,
          options: importOptions,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult(result);
        if (result.imported > 0 || result.updated > 0) {
          await fetchData();
        }
      } else {
        alert(result.error || "Erreur lors de l'import");
      }
    } catch (error) {
      console.error("Error importing:", error);
      alert("Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setCsvData([]);
    setCsvHeaders([]);
    setImportResult(null);
    setMapping({
      site: "",
      period: "",
      quantity: "",
      cost: "",
      dju: "",
      energyType: "",
      usage: "",
      pce: "",
      pdl: "",
    });
  };

  const handleIdexImport = async (file: File) => {
    if (!selectedContract) return;

    setImportingIdex(true);
    setIdexImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractId", selectedContract.id);

      const response = await fetch("/api/consumptions/import-idex", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setIdexImportResult(result);
        if (result.imported > 0 || result.updated > 0) {
          await fetchData();
        }
      } else {
        alert(result.error || "Erreur lors de l'import IDEX");
      }
    } catch (error) {
      console.error("Error importing IDEX:", error);
      alert("Erreur lors de l'import IDEX");
    } finally {
      setImportingIdex(false);
    }
  };

  const closeIdexImportModal = () => {
    setShowIdexImportModal(false);
    setIdexImportResult(null);
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
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Performance énergétique</h1>
          <p className="text-text-secondary">Sélectionnez un contrat pour analyser les consommations</p>
        </div>

        {contracts.length === 0 ? (
          <ChartCard title="Aucun contrat actif">
            <div className="flex flex-col items-center justify-center py-8">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary">Créez d&apos;abord un contrat</p>
            </div>
          </ChartCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <Flame size={24} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Actif</span>
                </div>
                <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {contract.provider}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {contract._count?.contractSites || 0} sites
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main content with tabs
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                setSelectedContract(null);
                setAnalytics(null);
                setDjuData(null);
                setConsumptions([]);
                setSites([]);
              }}
              className="text-text-secondary hover:text-primary-dark"
            >
              Suivi énergétique
            </button>
            <span className="text-text-secondary">/</span>
            <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.title}</h1>
          <p className="text-text-secondary">{selectedContract.provider}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedContract.id}
            onChange={(e) => {
              const contract = contracts.find((c) => c.id === e.target.value);
              if (contract) setSelectedContract(contract);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} - {c.title}
              </option>
            ))}
          </select>
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
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: "synthese" as Tab, label: "Synthèse", icon: BarChart3 },
            { id: "sites" as Tab, label: "Sites", icon: Building2 },
            { id: "climat" as Tab, label: "Climat & DJU", icon: Thermometer },
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
          setShowImportModal={setShowImportModal}
          setShowIdexImportModal={setShowIdexImportModal}
          setShowCreateModal={setShowCreateModal}
        />
      )}

      {!loading && activeTab === "sites" && (
        <SitesContent
          analytics={analytics}
          consumptions={consumptions}
          sites={sites}
          setShowImportModal={setShowImportModal}
          setShowIdexImportModal={setShowIdexImportModal}
          setShowCreateModal={setShowCreateModal}
        />
      )}

      {!loading && activeTab === "climat" && (
        <ClimatContent
          djuData={djuData}
          selectedYear={selectedYear}
          heatingSeasons={heatingSeasons}
          openHeatingSeasonModal={openHeatingSeasonModal}
        />
      )}

      {!loading && activeTab === "telereleve" && (
        <TelereleveContent />
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

      {showImportModal && (
        <ImportModal
          csvData={csvData}
          csvHeaders={csvHeaders}
          mapping={mapping}
          setMapping={setMapping}
          importOptions={importOptions}
          setImportOptions={setImportOptions}
          importResult={importResult}
          importing={importing}
          handleFileUpload={handleFileUpload}
          handleImport={handleImport}
          onClose={closeImportModal}
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

function SyntheseContent({
  analytics,
  chartData,
  activeAlerts,
  setShowImportModal,
  setShowIdexImportModal,
  setShowCreateModal,
}: {
  analytics: AnalyticsData | null;
  chartData: { label: string; value: number; target: number }[];
  activeAlerts: Alert[];
  setShowImportModal: (v: boolean) => void;
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
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
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload size={18} className="mr-2" />
              Importer CSV
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
  setShowImportModal,
  setShowIdexImportModal,
  setShowCreateModal,
}: {
  analytics: AnalyticsData | null;
  consumptions: Consumption[];
  sites: Site[];
  setShowImportModal: (v: boolean) => void;
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
}) {
  if (!analytics || analytics.sites.length === 0) {
    return (
      <>
        <div className="flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
            <Flame size={18} className="mr-2" />
            Import Exploitant
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload size={18} className="mr-2" />
            Importer CSV
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
        <Button variant="outline" onClick={() => setShowImportModal(true)}>
          <Upload size={18} className="mr-2" />
          Importer CSV
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
                  <td className="px-6 py-4 text-right text-gray-600">{(site.nbPrime / 1000).toFixed(1)}</td>
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

function ClimatContent({
  djuData,
  selectedYear,
  heatingSeasons,
  openHeatingSeasonModal,
}: {
  djuData: DJUData | null;
  selectedYear: number;
  heatingSeasons: HeatingSeason[];
  openHeatingSeasonModal: (siteId: string, siteName: string, startDate?: string, endDate?: string) => void;
}) {
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
      {/* DJU Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Snowflake size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">DJU Réels</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{djuData.summary.djuReelMoyen}</p>
          <p className="text-xs text-blue-600 mt-1">Cumul saison en cours</p>
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

      {/* DJU Monthly Chart */}
      {djuData.monthlyData.length > 0 && (
        <ChartCard title="DJU mensuels" subtitle={`Saison ${selectedYear - 1}/${selectedYear}`}>
          <div className="flex items-end gap-2 h-32">
            {djuData.monthlyData.map((m) => {
              const maxDju = Math.max(...djuData.monthlyData.map((d) => d.dju));
              const height = maxDju > 0 ? (m.dju / maxDju) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center">
                  <span className="text-xs font-medium text-primary-dark mb-1">{m.dju}</span>
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                    style={{ height: `${height}%`, minHeight: m.dju > 0 ? "4px" : "0" }}
                  />
                  <span className="text-xs text-text-secondary mt-1">{m.label}</span>
                </div>
              );
            })}
          </div>
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
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Période chauffe</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Réel</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Trent.</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {djuData.sites.map((site) => (
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
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                        }`}
                      >
                        <Calendar size={12} />
                        <span>
                          {new Date(site.heatingStartDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          {" → "}
                          {new Date(site.heatingEndDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </span>
                      </button>
                      {!site.hasHeatingSeason && (
                        <p className="text-xs text-orange-500 mt-0.5">Par défaut</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{site.djuReel}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{site.djuTrentenaireToDate}</td>
                    <td className={`px-3 py-2 text-right font-medium ${site.ecartTrentenaire > 0 ? "text-blue-600" : "text-orange-600"}`}>
                      {site.ecartTrentenaire > 0 ? "+" : ""}{site.ecartTrentenaire}
                      <span className="text-xs ml-1">({site.ecartPercent > 0 ? "+" : ""}{site.ecartPercent}%)</span>
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

function TelereleveContent() {
  return <TelereleveCard />;
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

function ImportModal({
  csvData,
  csvHeaders,
  mapping,
  setMapping,
  importOptions,
  setImportOptions,
  importResult,
  importing,
  handleFileUpload,
  handleImport,
  onClose,
}: {
  csvData: Record<string, string>[];
  csvHeaders: string[];
  mapping: { site: string; period: string; quantity: string; cost: string; dju: string; energyType: string; usage: string; pce: string; pdl: string };
  setMapping: (m: typeof mapping) => void;
  importOptions: { energyType: string; usage: string; unit: string };
  setImportOptions: (o: typeof importOptions) => void;
  importResult: { imported: number; updated: number; errors: { row: number; site: string; error: string }[]; totalErrors: number } | null;
  importing: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImport: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Importer des relevés CSV</h2>
            <p className="text-sm text-text-secondary mt-1">
              Importez les exports de votre exploitant (GRDF, Engie, etc.)
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload */}
          {csvData.length === 0 && (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-accent transition-colors">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-primary-dark mb-2">
                  Glissez votre fichier CSV ici
                </p>
                <p className="text-sm text-text-secondary mb-4">
                  ou cliquez pour sélectionner un fichier
                </p>
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          )}

          {/* Mapping */}
          {csvData.length > 0 && !importResult && (
            <>
              <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3">
                <Check size={20} />
                <span>{csvData.length} lignes détectées dans le fichier</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {["site", "period", "quantity", "cost", "dju", "pce"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      {field === "site" ? "Site / Bâtiment *" :
                       field === "period" ? "Période / Date *" :
                       field === "quantity" ? "Quantité *" :
                       field === "cost" ? "Coût (€)" :
                       field === "dju" ? "DJU Réels" : "PCE"}
                    </label>
                    <select
                      value={mapping[field as keyof typeof mapping]}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    >
                      <option value="">{field === "site" || field === "period" || field === "quantity" ? "-- Sélectionner --" : "-- Non mappé --"}</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;énergie</label>
                  <select
                    value={importOptions.energyType}
                    onChange={(e) => setImportOptions({ ...importOptions, energyType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="GAZ">Gaz</option>
                    <option value="ELECTRICITE">Électricité</option>
                    <option value="RESEAU_CHALEUR">RCU</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Usage</label>
                  <select
                    value={importOptions.usage}
                    onChange={(e) => setImportOptions({ ...importOptions, usage: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="CHAUFFAGE">Chauffage</option>
                    <option value="ECS">ECS</option>
                    <option value="MIXTE">Mixte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Unité</label>
                  <select
                    value={importOptions.unit}
                    onChange={(e) => setImportOptions({ ...importOptions, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="kWh">kWh</option>
                    <option value="MWh">MWh</option>
                    <option value="m³">m³</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Results */}
          {importResult && (
            <div className={`p-4 rounded-lg ${importResult.errors.length === 0 ? "bg-green-50" : "bg-yellow-50"}`}>
              <div className="flex items-center gap-3">
                {importResult.errors.length === 0 ? (
                  <Check className="text-green-600" size={24} />
                ) : (
                  <AlertTriangle className="text-yellow-600" size={24} />
                )}
                <div>
                  <p className="font-semibold text-primary-dark">Import terminé</p>
                  <p className="text-sm text-text-secondary">
                    {importResult.imported} créés, {importResult.updated} mis à jour
                    {importResult.totalErrors > 0 && `, ${importResult.totalErrors} erreurs`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {csvData.length === 0 ? (
              <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            ) : importResult ? (
              <Button className="flex-1" onClick={onClose}>Fermer</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1"
                  onClick={handleImport}
                  disabled={importing || !mapping.site || !mapping.period || !mapping.quantity}
                >
                  {importing ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="mr-2" />
                      Importer {csvData.length} lignes
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

function HeatingSeasonModal({
  form,
  setForm,
  saving,
  handleSave,
  onClose,
}: {
  form: { siteId: string; siteName: string; season: string; startDate: string; endDate: string; notes: string };
  setForm: (f: typeof form) => void;
  saving: boolean;
  handleSave: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
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

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              placeholder="Observations, index compteur..."
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
  onClose,
}: {
  importing: boolean;
  importResult: {
    imported: number;
    updated: number;
    skipped: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors: number;
    siteMatches: Record<string, { matched: boolean; siteId?: string; siteName?: string }>;
  } | null;
  onImport: (file: File) => void;
  onClose: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onImport(selectedFile);
    }
  };

  const unmatchedSites = importResult
    ? Object.entries(importResult.siteMatches).filter(([, v]) => !v.matched)
    : [];
  const matchedSites = importResult
    ? Object.entries(importResult.siteMatches).filter(([, v]) => v.matched)
    : [];

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

          {/* Results */}
          {importResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${
                importResult.totalErrors === 0 ? "bg-green-50" : "bg-yellow-50"
              }`}>
                <div className="flex items-center gap-3">
                  {importResult.totalErrors === 0 ? (
                    <Check className="text-green-600" size={24} />
                  ) : (
                    <AlertTriangle className="text-yellow-600" size={24} />
                  )}
                  <div>
                    <p className="font-semibold text-primary-dark">Import terminé</p>
                    <p className="text-sm text-text-secondary">
                      {importResult.imported} créés, {importResult.updated} mis à jour, {importResult.skipped} ignorés
                      {importResult.totalErrors > 0 && `, ${importResult.totalErrors} erreurs`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Site matching results */}
              {matchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Check size={16} />
                    Sites reconnus ({matchedSites.length})
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

              {unmatchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle size={16} />
                    Sites non reconnus ({unmatchedSites.length})
                  </p>
                  <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {unmatchedSites.map(([idexName]) => (
                        <p key={idexName} className="text-xs text-red-700">{idexName}</p>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Vérifiez que ces sites existent dans le contrat sélectionné avec un nom similaire.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {importResult ? (
              <Button className="flex-1" onClick={onClose}>Fermer</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={importing || !selectedFile}
                >
                  {importing ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="mr-2" />
                      Importer
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
