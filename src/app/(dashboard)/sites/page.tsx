"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Building2,
  Plus,
  Search,
  Loader2,
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  List,
  Map as MapIcon,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Zap,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DonutChart, CHART_COLORS } from "@/components/dashboard/donut-chart";

// Dynamic import for map to avoid SSR issues
const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((mod) => mod.SiteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-gray-50 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    ),
  }
);

type SiteType =
  | "LYCEE"
  | "COLLEGE"
  | "ECOLE"
  | "MAIRIE"
  | "HOPITAL"
  | "GYMNASE"
  | "PISCINE"
  | "MEDIATHEQUE"
  | "AUTRE";

type EnergyType =
  | "GAZ"
  | "ELECTRICITE"
  | "FIOUL"
  | "BOIS"
  | "RESEAU_CHALEUR"
  | "AUTRE";

interface ContractSite {
  id: string;
  contract: {
    id: string;
    reference: string;
    title: string;
    provider: string;
    status: string;
  };
}

interface Site {
  id: string;
  name: string;
  type: SiteType;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  energyType: EnergyType;
  annualBudget: number | null;
  latitude: number | null;
  longitude: number | null;
  contractSites: ContractSite[];
  _count?: {
    equipments: number;
    consumptions: number;
    alerts: number;
  };
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  linkedToContract: number;
  sites: Array<{ id: string; name: string }>;
  errors?: string[];
  skippedDuplicates?: string[];
}

interface PreviewSite {
  _index: number;
  name: string;
  type?: string;
  _type: string;
  address?: string;
  city?: string;
  postalCode?: string;
  surface?: number;
  energyType?: string;
  _energyType: string;
  contractType?: string;
  _contractType: string;
  hasP1?: boolean;
  hasP2?: boolean;
  hasP3?: boolean;
  hasP4?: boolean;
  amountP2?: number;
  amountP3?: number;
}

interface ContractGroup {
  contract: Contract | null;
  sites: Site[];
}

const contractTypeLabels: Record<string, string> = {
  MTI: "MTI - Marché Total Intéressement",
  MCI: "MCI - Marché Chauffage Intéressement",
  PFI: "PFI - Prestation Forfait Intéressement",
  CPI: "CPI - Contrat Prestation Intéressement",
  MT: "MT - Marché Total",
  CP: "CP - Contrat de Performance",
  PF: "PF - Prestations Forfaitisées",
  MC: "MC - Marché Chauffage",
  MF: "MF - Marché Forfait",
  AUTRE: "Autre",
};

const siteTypeLabels: Record<SiteType, string> = {
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

const energyTypeLabels: Record<EnergyType, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  AUTRE: "Autre",
};

type ViewType = "list" | "map" | "analytics";

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewType>("list");
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set(["all"]));

  // Create/Import modal states
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewSites, setPreviewSites] = useState<PreviewSite[]>([]);
  const [previewDuplicates, setPreviewDuplicates] = useState<string[]>([]);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "result">("upload");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "LYCEE" as SiteType,
    address: "",
    city: "",
    postalCode: "",
    surface: "",
    energyType: "GAZ" as EnergyType,
    annualBudget: "",
  });

  // Fetch sites
  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/sites");
      if (!response.ok) throw new Error("Erreur lors du chargement");
      const data = await response.json();
      setSites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Fetch contracts for import modal
  const fetchContracts = async () => {
    try {
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
      }
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // Filter sites by search query
  const filteredSites = useMemo(() => {
    return sites.filter(
      (site) =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sites, searchQuery]);

  // Group sites by contract
  const groupedSites = useMemo(() => {
    const groups: ContractGroup[] = [];
    const sitesInContracts = new Set<string>();
    const contractMap = new Map<string, ContractGroup>();

    // Group sites that have contracts
    for (const site of filteredSites) {
      for (const cs of site.contractSites) {
        if (cs.contract.status === "ACTIF") {
          sitesInContracts.add(site.id);
          const contractId = cs.contract.id;
          if (!contractMap.has(contractId)) {
            contractMap.set(contractId, {
              contract: cs.contract,
              sites: [],
            });
          }
          contractMap.get(contractId)!.sites.push(site);
        }
      }
    }

    // Add contract groups
    contractMap.forEach((group) => groups.push(group));

    // Sort by contract reference
    groups.sort((a, b) => (a.contract?.reference || "").localeCompare(b.contract?.reference || ""));

    // Add sites without contracts
    const sitesWithoutContract = filteredSites.filter(
      (site) => !sitesInContracts.has(site.id)
    );
    if (sitesWithoutContract.length > 0) {
      groups.push({ contract: null, sites: sitesWithoutContract });
    }

    return groups;
  }, [filteredSites]);

  // Statistics
  const stats = useMemo(() => {
    const totalSites = sites.length;
    const sitesWithCoords = sites.filter((s) => s.latitude && s.longitude).length;
    const totalEquipments = sites.reduce((sum, s) => sum + (s._count?.equipments || 0), 0);
    const totalAlerts = sites.reduce((sum, s) => sum + (s._count?.alerts || 0), 0);
    const sitesUnderContract = new Set(
      sites.flatMap((s) => s.contractSites.filter((cs) => cs.contract.status === "ACTIF").map(() => s.id))
    ).size;

    return { totalSites, sitesWithCoords, totalEquipments, totalAlerts, sitesUnderContract };
  }, [sites]);

  // Chart data
  const chartData = useMemo(() => {
    // Sites by type
    const typeCount: Record<string, number> = {};
    for (const site of sites) {
      typeCount[site.type] = (typeCount[site.type] || 0) + 1;
    }
    const byType = Object.entries(typeCount).map(([type, count]) => ({
      label: siteTypeLabels[type as SiteType] || type,
      value: count,
      color: CHART_COLORS.siteTypes[type as keyof typeof CHART_COLORS.siteTypes] || "#6b7280",
    }));

    // Sites by energy
    const energyCount: Record<string, number> = {};
    for (const site of sites) {
      energyCount[site.energyType] = (energyCount[site.energyType] || 0) + 1;
    }
    const byEnergy = Object.entries(energyCount).map(([energy, count]) => ({
      label: energyTypeLabels[energy as EnergyType] || energy,
      value: count,
      color: CHART_COLORS.energyTypes[energy as keyof typeof CHART_COLORS.energyTypes] || "#6b7280",
    }));

    return { byType, byEnergy };
  }, [sites]);

  // Toggle contract expansion
  const toggleContract = (contractId: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  // Modal handlers
  const openImportModal = () => {
    setImportFile(null);
    setSelectedContractId("");
    setImportResult(null);
    setPreviewSites([]);
    setPreviewDuplicates([]);
    setImportStep("upload");
    fetchContracts();
    setShowImportModal(true);
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("preview", "true");
      if (selectedContractId) formData.append("contractId", selectedContractId);

      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false, imported: 0, linkedToContract: 0, sites: [],
          errors: [result.error || "Erreur lors de la lecture du fichier"],
          skippedDuplicates: result.duplicates,
        });
        setImportStep("result");
      } else if (result.preview) {
        setPreviewSites(result.sites);
        setPreviewDuplicates(result.duplicates || []);
        setImportStep("preview");
      }
    } catch (err) {
      setImportResult({
        success: false, imported: 0, linkedToContract: 0, sites: [],
        errors: [err instanceof Error ? err.message : "Erreur inconnue"],
      });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const updatePreviewSite = (index: number, field: keyof PreviewSite, value: unknown) => {
    setPreviewSites((prev) => prev.map((site, i) => (i === index ? { ...site, [field]: value } : site)));
  };

  const removePreviewSite = (index: number) => {
    setPreviewSites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (previewSites.length === 0) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile!);
      formData.append("sitesData", JSON.stringify(previewSites));
      if (selectedContractId) formData.append("contractId", selectedContractId);

      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false, imported: 0, linkedToContract: 0, sites: [],
          errors: [result.error || "Erreur lors de l'import"],
        });
      } else {
        setImportResult(result);
        if (result.success) await fetchSites();
      }
      setImportStep("result");
    } catch (err) {
      setImportResult({
        success: false, imported: 0, linkedToContract: 0, sites: [],
        errors: [err instanceof Error ? err.message : "Erreur inconnue"],
      });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      await fetchSites();
      setShowModal(false);
      setFormData({
        name: "", type: "LYCEE", address: "", city: "",
        postalCode: "", surface: "", energyType: "GAZ", annualBudget: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Sites & Patrimoine</h1>
          <p className="text-text-secondary">Gérez l&apos;ensemble de vos sites et équipements CVC</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openImportModal}>
            <Upload size={18} className="mr-2" />
            Importer
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Ajouter un site
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Sites total" value={stats.totalSites.toString()} icon={Building2} iconColor="text-accent" />
        <StatsCard title="Sous contrat" value={stats.sitesUnderContract.toString()} icon={CheckCircle} iconColor="text-green-600" />
        <StatsCard title="Équipements" value={stats.totalEquipments.toString()} icon={Zap} iconColor="text-blue-600" />
        <StatsCard
          title="Alertes actives"
          value={stats.totalAlerts.toString()}
          icon={AlertCircle}
          iconColor={stats.totalAlerts > 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      {/* View Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* View Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === "list" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <List size={16} />
            Liste
          </button>
          <button
            onClick={() => setActiveView("map")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === "map" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <MapIcon size={16} />
            Carte
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === "analytics" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <BarChart3 size={16} />
            Analyse
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
          />
        </div>
      </div>

      {/* Loading / Error states */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : (
        <>
          {/* LIST VIEW */}
          {activeView === "list" && (
            <div className="space-y-4">
              {groupedSites.length === 0 ? (
                <ChartCard title="Aucun site" className="flex flex-col items-center justify-center py-12">
                  <Building2 size={48} className="text-gray-300 mb-4" />
                  <p className="text-text-secondary mb-4">
                    {searchQuery ? "Aucun site ne correspond à votre recherche" : "Commencez par ajouter votre premier site"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowModal(true)}>
                      <Plus size={18} className="mr-2" />
                      Ajouter un site
                    </Button>
                  )}
                </ChartCard>
              ) : (
                groupedSites.map((group) => {
                  const groupId = group.contract?.id || "no-contract";
                  const isExpanded = expandedContracts.has(groupId) || expandedContracts.has("all");

                  return (
                    <ChartCard key={groupId} className="overflow-hidden">
                      {/* Contract Header */}
                      <button
                        onClick={() => toggleContract(groupId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors -m-6 mb-0"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                          <div className="text-left">
                            <h3 className="font-semibold text-primary-dark">
                              {group.contract ? (
                                <>
                                  {group.contract.reference} - {group.contract.title}
                                  <span className="font-normal text-text-secondary ml-2">({group.contract.provider})</span>
                                </>
                              ) : (
                                "Sites hors contrat"
                              )}
                            </h3>
                            <p className="text-sm text-text-secondary">
                              {group.sites.length} site{group.sites.length > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        {group.contract && (
                          <Link
                            href={`/contracts/${group.contract.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-accent hover:underline"
                          >
                            Voir le contrat
                          </Link>
                        )}
                      </button>

                      {/* Sites List */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 mt-4 -mx-6 -mb-6">
                          <table className="w-full">
                            <thead className="bg-background-secondary border-b border-gray-100">
                              <tr>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Type</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Énergie</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Surface</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Équip.</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Alertes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.sites.map((site) => (
                                <tr key={site.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                                        <Building2 size={18} className="text-accent" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-primary-dark">{site.name}</p>
                                        <p className="text-sm text-text-secondary truncate max-w-[200px]">
                                          {site.address}, {site.postalCode} {site.city}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">{siteTypeLabels[site.type]}</td>
                                  <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                                      {site.energyType === "GAZ" ? <Flame size={14} className="text-amber-500" /> : <Zap size={14} className="text-blue-500" />}
                                      {energyTypeLabels[site.energyType]}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">
                                    {site.surface ? `${site.surface.toLocaleString()} m²` : "-"}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">{site._count?.equipments || 0}</td>
                                  <td className="px-6 py-4">
                                    {(site._count?.alerts || 0) > 0 ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                        {site._count?.alerts} alerte{(site._count?.alerts || 0) > 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                        OK
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </ChartCard>
                  );
                })
              )}
            </div>
          )}

          {/* MAP VIEW */}
          {activeView === "map" && (
            <ChartCard title="Carte des sites" subtitle={`${stats.sitesWithCoords} sites géolocalisés sur ${stats.totalSites}`}>
              <SiteMap
                sites={filteredSites.map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  address: s.address,
                  city: s.city,
                  postalCode: s.postalCode,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  energyType: s.energyType,
                  contractName: s.contractSites[0]?.contract?.reference,
                }))}
                height="500px"
              />
            </ChartCard>
          )}

          {/* ANALYTICS VIEW */}
          {activeView === "analytics" && (
            <div className="grid md:grid-cols-2 gap-6">
              <ChartCard title="Répartition par type de site" subtitle={`${sites.length} sites`}>
                <DonutChart data={chartData.byType} centerValue={sites.length} centerLabel="sites" />
              </ChartCard>

              <ChartCard title="Répartition par énergie" subtitle="Source d'énergie principale">
                <DonutChart data={chartData.byEnergy} centerValue={sites.length} centerLabel="sites" />
              </ChartCard>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouveau site</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Nom du site *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: Lycée Jean Moulin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type de bâtiment *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as SiteType })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(siteTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;énergie *</label>
                  <select
                    required
                    value={formData.energyType}
                    onChange={(e) => setFormData({ ...formData, energyType: e.target.value as EnergyType })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(energyTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Adresse *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: 12 rue de la République"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Code postal *</label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="75001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Ville *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Surface (m²)</label>
                  <input
                    type="number"
                    value={formData.surface}
                    onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Budget annuel (€)</label>
                  <input
                    type="number"
                    value={formData.annualBudget}
                    onChange={(e) => setFormData({ ...formData, annualBudget: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer le site"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto ${importStep === "preview" ? "max-w-4xl" : "max-w-lg"}`}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Importer des sites</h2>
                {importStep === "preview" && <p className="text-sm text-text-secondary mt-1">Vérifiez et modifiez les données avant validation</p>}
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Upload */}
              {importStep === "upload" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-2">Fichier Excel (.xlsx, .xls)</label>
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${importFile ? "border-accent bg-accent/5" : "border-gray-200 hover:border-gray-300"}`}>
                      {importFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileSpreadsheet size={24} className="text-accent" />
                          <div className="text-left">
                            <p className="font-medium text-primary-dark">{importFile.name}</p>
                            <p className="text-sm text-text-secondary">{(importFile.size / 1024).toFixed(1)} Ko</p>
                          </div>
                          <button onClick={() => setImportFile(null)} className="p-1 hover:bg-gray-100 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-text-secondary">Cliquez ou glissez un fichier Excel</p>
                          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setImportFile(file); }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-2">Rattacher à un contrat (optionnel)</label>
                    <select value={selectedContractId} onChange={(e) => setSelectedContractId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                      <option value="">Aucun contrat</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>{contract.reference} - {contract.title} ({contract.provider})</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-primary-dark mb-2">Colonnes attendues :</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                      <div><span className="font-medium">Obligatoire :</span> Nom</div>
                      <div><span className="font-medium">Optionnel :</span> Type, Adresse, Ville, CP</div>
                      <div>Surface, Énergie, PCE, PDL</div>
                      <div>Type contrat, P1, P2, P3, P4, Montant P2/P3</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setShowImportModal(false)}>Annuler</Button>
                    <Button className="flex-1" disabled={!importFile || importing} onClick={handlePreview}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Analyse...</>) : "Suivant →"}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Preview */}
              {importStep === "preview" && (
                <>
                  <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm mb-4">
                    <strong>{previewSites.length} site{previewSites.length > 1 ? "s" : ""}</strong> à importer.
                  </div>
                  {previewDuplicates.length > 0 && (
                    <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm mb-4">
                      <strong>{previewDuplicates.length}</strong> ignoré{previewDuplicates.length > 1 ? "s" : ""} (doublon{previewDuplicates.length > 1 ? "s" : ""})
                    </div>
                  )}

                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-text-secondary">Nom</th>
                          <th className="text-left px-4 py-2 font-medium text-text-secondary">Type</th>
                          <th className="text-left px-4 py-2 font-medium text-text-secondary">Ville</th>
                          <th className="text-left px-4 py-2 font-medium text-text-secondary">Énergie</th>
                          {selectedContractId && (
                            <>
                              <th className="text-left px-4 py-2 font-medium text-text-secondary">Type contrat</th>
                              <th className="text-center px-4 py-2 font-medium text-text-secondary">P1</th>
                              <th className="text-center px-4 py-2 font-medium text-text-secondary">P2</th>
                              <th className="text-center px-4 py-2 font-medium text-text-secondary">P3</th>
                            </>
                          )}
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewSites.map((site, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <input type="text" value={site.name} onChange={(e) => updatePreviewSite(index, "name", e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
                            </td>
                            <td className="px-4 py-2">
                              <select value={site._type} onChange={(e) => updatePreviewSite(index, "_type", e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-sm">
                                {Object.entries(siteTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={site.city || ""} onChange={(e) => updatePreviewSite(index, "city", e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-sm" />
                            </td>
                            <td className="px-4 py-2">
                              <select value={site._energyType} onChange={(e) => updatePreviewSite(index, "_energyType", e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-sm">
                                {Object.entries(energyTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            {selectedContractId && (
                              <>
                                <td className="px-4 py-2">
                                  <select value={site._contractType} onChange={(e) => updatePreviewSite(index, "_contractType", e.target.value)} className="w-full px-2 py-1 border border-gray-200 rounded text-sm">
                                    {Object.entries(contractTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                                  </select>
                                </td>
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={site.hasP1 || false} onChange={(e) => updatePreviewSite(index, "hasP1", e.target.checked)} className="w-4 h-4" /></td>
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={site.hasP2 || false} onChange={(e) => updatePreviewSite(index, "hasP2", e.target.checked)} className="w-4 h-4" /></td>
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={site.hasP3 || false} onChange={(e) => updatePreviewSite(index, "hasP3", e.target.checked)} className="w-4 h-4" /></td>
                              </>
                            )}
                            <td className="px-4 py-2">
                              <button onClick={() => removePreviewSite(index)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Supprimer"><X size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={() => setImportStep("upload")}>← Retour</Button>
                    <Button className="flex-1" disabled={previewSites.length === 0 || importing} onClick={handleImport}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Import...</>) : (<><CheckCircle size={18} className="mr-2" />Valider ({previewSites.length})</>)}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Result */}
              {importStep === "result" && importResult && (
                <div className="text-center">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">Import réussi !</h3>
                      <p className="text-text-secondary mb-4">{importResult.imported} site{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">Erreur</h3>
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-left mb-4">
                        {importResult.errors?.map((err, i) => (<p key={i}>{err}</p>))}
                      </div>
                    </>
                  )}
                  <Button onClick={() => setShowImportModal(false)} className="w-full">Fermer</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
