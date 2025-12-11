"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Plus,
  Calendar,
  Loader2,
  X,
  Building2,
  ChevronRight,
  Trash2,
  Search,
  MapPin,
  Flame,
  Zap,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

// Types
interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  energyType: string;
  surface: number | null;
  _count?: {
    equipments: number;
    alerts: number;
  };
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  site: Site;
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  startDate: string;
  endDate: string;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  contractSites: ContractSite[];
  _count?: {
    contractSites: number;
  };
}

type Tab = "contrats" | "sites";
type ContractStatus = "ACTIF" | "ALL" | "EXPIRE" | "RESILIE" | "EN_ATTENTE";

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

const energyIcons: Record<string, typeof Flame> = {
  GAZ: Flame,
  ELECTRICITE: Zap,
  FIOUL: Flame,
  RESEAU_CHALEUR: Flame,
  BOIS: Flame,
  AUTRE: Flame,
};

const energyLabels: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  RESEAU_CHALEUR: "Réseau chaleur",
  BOIS: "Bois",
  AUTRE: "Autre",
};

function AdministratifContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "contrats";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus>("ACTIF");
  const [showContractModal, setShowContractModal] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  // Sites state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Import sites modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "result">("upload");
  const [previewSites, setPreviewSites] = useState<Array<{
    name: string;
    type: string;
    address: string;
    city: string;
    postalCode: string;
    surface: string;
    energyType: string;
  }>>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    linkedToContract: number;
    sites: string[];
    errors: string[];
  } | null>(null);

  // Contract form
  const [contractFormData, setContractFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    startDate: "",
    endDate: "",
    yearType: "HEATING_SEASON" as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL",
    billingFrequency: "TRIMESTRIEL" as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
  });

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    router.push(`/administratif?tab=${tab}`, { scroll: false });
  };

  // Fetch contracts
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch sites when contract selected (for sites tab)
  useEffect(() => {
    if (activeTab === "sites" && selectedContract) {
      fetchSites(selectedContract.id);
    }
  }, [activeTab, selectedContract]);

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await fetch("/api/contracts");
      const data = await response.json();
      setContracts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchSites = async (contractId: string) => {
    try {
      setLoadingSites(true);
      const response = await fetch(`/api/contracts/${contractId}/sites`);
      const data = await response.json();
      setSites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoadingSites(false);
    }
  };

  // Import sites functions
  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setPreviewSites([]);
    setImportStep("upload");
    setShowImportModal(true);
  };

  const handleImportPreview = async () => {
    if (!importFile || !selectedContract) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("contractId", selectedContract.id);
      formData.append("preview", "true");

      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false, imported: 0, linkedToContract: 0, sites: [],
          errors: [result.error || "Erreur lors de l'analyse du fichier"],
        });
        setImportStep("result");
      } else {
        setPreviewSites(result.sites || []);
        setImportStep("preview");
      }
    } catch {
      setImportResult({
        success: false, imported: 0, linkedToContract: 0, sites: [],
        errors: ["Erreur lors de l'analyse du fichier"],
      });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || !selectedContract) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("contractId", selectedContract.id);

      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false, imported: 0, linkedToContract: 0, sites: [],
          errors: [result.error || "Erreur lors de l'import"],
        });
      } else {
        setImportResult(result);
        fetchSites(selectedContract.id);
      }
      setImportStep("result");
    } catch {
      setImportResult({
        success: false, imported: 0, linkedToContract: 0, sites: [],
        errors: ["Erreur lors de l'import"],
      });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const parseFrenchDate = (dateStr: string): string => {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return dateStr;
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingContract(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contractFormData,
          startDate: parseFrenchDate(contractFormData.startDate),
          endDate: parseFrenchDate(contractFormData.endDate),
        }),
      });
      if (response.ok) {
        await fetchContracts();
        setShowContractModal(false);
        setContractFormData({
          reference: "",
          title: "",
          provider: "",
          startDate: "",
          endDate: "",
          yearType: "HEATING_SEASON",
          billingFrequency: "TRIMESTRIEL",
        });
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    } finally {
      setCreatingContract(false);
    }
  };

  const handleDeleteContract = async (e: React.MouseEvent, contractId: string, contractTitle: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Supprimer le contrat "${contractTitle}" ? Cette action est irréversible.`)) {
      return;
    }

    setDeletingContractId(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchContracts();
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
    } finally {
      setDeletingContractId(null);
    }
  };

  // Filter contracts
  const filteredContracts = statusFilter === "ALL" ? contracts : contracts.filter((c) => c.status === statusFilter);

  // Contract stats
  const activeContracts = contracts.filter((c) => c.status === "ACTIF");
  const totalSites = activeContracts.reduce((sum, c) => sum + c.contractSites.length, 0);
  const countByStatus = {
    ACTIF: contracts.filter((c) => c.status === "ACTIF").length,
    EN_ATTENTE: contracts.filter((c) => c.status === "EN_ATTENTE").length,
    EXPIRE: contracts.filter((c) => c.status === "EXPIRE").length,
    RESILIE: contracts.filter((c) => c.status === "RESILIE").length,
  };

  // Filter sites
  const filteredSites = sites.filter((site) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      site.name.toLowerCase().includes(query) ||
      site.city.toLowerCase().includes(query) ||
      site.address.toLowerCase().includes(query)
    );
  });

  if (loadingContracts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Suivi administratif</h1>
          <p className="text-text-secondary">Gestion des contrats et du patrimoine</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: "contrats" as Tab, label: "Contrats", icon: FileText },
            { id: "sites" as Tab, label: "Sites & Patrimoine", icon: Building2 },
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

      {/* Tab Content */}
      {activeTab === "contrats" && (
        <>
          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Contrats actifs" value={countByStatus.ACTIF.toString()} icon={FileText} iconColor="text-accent" />
            <StatsCard title="Sites totaux" value={totalSites.toString()} icon={Building2} iconColor="text-blue-600" />
            <StatsCard title="En attente" value={countByStatus.EN_ATTENTE.toString()} icon={FileText} iconColor="text-yellow-600" />
            <StatsCard title="Expirés" value={countByStatus.EXPIRE.toString()} icon={FileText} iconColor="text-red-600" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-text-secondary mr-2">Filtrer :</span>
              {(["ACTIF", "EN_ATTENTE", "EXPIRE", "RESILIE", "ALL"] as ContractStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? status === "ALL"
                        ? "bg-accent text-white"
                        : status === "ACTIF"
                        ? "bg-green-100 text-green-700"
                        : status === "EN_ATTENTE"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {status === "ALL" ? `Tous (${contracts.length})` : `${statusLabels[status]} (${countByStatus[status]})`}
                </button>
              ))}
            </div>
            <Button onClick={() => setShowContractModal(true)}>
              <Plus size={18} className="mr-2" />
              Nouveau contrat
            </Button>
          </div>

          {/* Contracts list */}
          {filteredContracts.length === 0 ? (
            <ChartCard title="">
              <div className="flex flex-col items-center justify-center py-12">
                <FileText size={48} className="text-gray-300 mb-4" />
                <p className="text-text-secondary mb-4">{contracts.length === 0 ? "Aucun contrat" : "Aucun contrat avec ce statut"}</p>
                <Button onClick={() => setShowContractModal(true)}>
                  <Plus size={18} className="mr-2" />
                  Créer un contrat
                </Button>
              </div>
            </ChartCard>
          ) : (
            <div className="space-y-4">
              {filteredContracts.map((contract) => {
                const hasAnyP1 = contract.contractSites.some((cs) => cs.hasP1);
                const hasAnyP2 = contract.contractSites.some((cs) => cs.hasP2);
                const hasAnyP3 = contract.contractSites.some((cs) => cs.hasP3);
                const hasAnyP4 = contract.contractSites.some((cs) => cs.hasP4);
                const contractTypes = [...new Set(contract.contractSites.map((cs) => cs.contractType))];

                return (
                  <Link key={contract.id} href={`/contracts/${contract.id}`}>
                    <ChartCard title="" className="hover:shadow-soft transition-shadow cursor-pointer">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 -mt-2">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FileText size={24} className="text-accent" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-primary-dark">{contract.title}</h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  contract.status === "ACTIF"
                                    ? "bg-green-100 text-green-700"
                                    : contract.status === "EN_ATTENTE"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {statusLabels[contract.status]}
                              </span>
                            </div>
                            <p className="text-sm text-text-secondary">{contract.reference} - Titulaire : {contract.provider}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                              <span className="flex items-center gap-1">
                                <Calendar size={14} />
                                {new Date(contract.startDate).toLocaleDateString("fr-FR")} → {new Date(contract.endDate).toLocaleDateString("fr-FR")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 size={14} />
                                {contract.contractSites.length} site{contract.contractSites.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {contractTypes.map((type) => (
                              <span key={type} className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">
                                {type}
                              </span>
                            ))}
                            {hasAnyP1 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">P1</span>}
                            {hasAnyP2 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">P2</span>}
                            {hasAnyP3 && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">P3</span>}
                            {hasAnyP4 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">P4</span>}
                          </div>
                          <button
                            onClick={(e) => handleDeleteContract(e, contract.id, contract.title)}
                            disabled={deletingContractId === contract.id}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingContractId === contract.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          </button>
                          <ChevronRight size={20} className="text-text-secondary" />
                        </div>
                      </div>
                    </ChartCard>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "sites" && (
        <>
          {/* Contract selector */}
          {!selectedContract ? (
            <>
              <div>
                <p className="text-text-secondary mb-4">Sélectionnez un contrat pour voir ses sites</p>
              </div>
              {activeContracts.length === 0 ? (
                <ChartCard title="Aucun contrat actif">
                  <div className="flex flex-col items-center justify-center py-8">
                    <FileText size={48} className="text-gray-300 mb-4" />
                    <p className="text-text-secondary">Créez d&apos;abord un contrat</p>
                  </div>
                </ChartCard>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeContracts.map((contract) => (
                    <button
                      key={contract.id}
                      onClick={() => setSelectedContract(contract)}
                      className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                          <Building2 size={24} className="text-accent" />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Actif</span>
                      </div>
                      <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                      <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                      <p className="text-xs text-text-secondary">{contract.contractSites.length} sites</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Header with back button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedContract(null);
                      setSites([]);
                    }}
                    className="text-text-secondary hover:text-primary-dark"
                  >
                    Sites
                  </button>
                  <span className="text-text-secondary">/</span>
                  <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={openImportModal}>
                    <Upload size={18} className="mr-2" />
                    Importer
                  </Button>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un site..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 w-64"
                    />
                  </div>
                  <select
                    value={selectedContract.id}
                    onChange={(e) => {
                      const contract = activeContracts.find((c) => c.id === e.target.value);
                      if (contract) setSelectedContract(contract);
                    }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {activeContracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.reference}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sites stats */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard title="Sites" value={sites.length.toString()} icon={Building2} iconColor="text-accent" />
                <StatsCard
                  title="Surface totale"
                  value={`${sites.reduce((sum, s) => sum + (s.surface || 0), 0).toLocaleString("fr-FR")} m²`}
                  icon={Building2}
                  iconColor="text-blue-600"
                />
                <StatsCard
                  title="Équipements"
                  value={sites.reduce((sum, s) => sum + (s._count?.equipments || 0), 0).toString()}
                  icon={Building2}
                  iconColor="text-green-600"
                />
                <StatsCard
                  title="Alertes"
                  value={sites.reduce((sum, s) => sum + (s._count?.alerts || 0), 0).toString()}
                  icon={AlertCircle}
                  iconColor="text-red-600"
                />
              </div>

              {/* Sites list */}
              {loadingSites ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              ) : filteredSites.length === 0 ? (
                <ChartCard title="">
                  <div className="flex flex-col items-center justify-center py-12">
                    <Building2 size={48} className="text-gray-300 mb-4" />
                    <p className="text-text-secondary">{searchQuery ? "Aucun site trouvé" : "Aucun site pour ce contrat"}</p>
                  </div>
                </ChartCard>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Adresse</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Énergie</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Surface</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Équip.</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Alertes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSites.map((site) => {
                        const EnergyIcon = energyIcons[site.energyType] || Flame;
                        return (
                          <tr
                            key={site.id}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/sites/${site.id}`)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                                  <Building2 size={18} className="text-accent" />
                                </div>
                                <div>
                                  <p className="font-medium text-primary-dark">{site.name}</p>
                                  <p className="text-sm text-text-secondary">{site.type}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-primary-dark flex items-center gap-1">
                                <MapPin size={14} className="text-gray-400" />
                                {site.city}
                              </p>
                              <p className="text-xs text-text-secondary truncate max-w-[200px]">{site.address}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1 text-sm">
                                <EnergyIcon size={14} className="text-orange-500" />
                                {energyLabels[site.energyType] || site.energyType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-primary-dark">{site.surface ? `${site.surface.toLocaleString("fr-FR")} m²` : "-"}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{site._count?.equipments || 0}</span>
                            </td>
                            <td className="px-6 py-4">
                              {(site._count?.alerts || 0) > 0 ? (
                                <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">{site._count?.alerts}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Create Contract Modal */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouveau contrat</h2>
              <button onClick={() => setShowContractModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
                <input
                  type="text"
                  required
                  value={contractFormData.reference}
                  onChange={(e) => setContractFormData({ ...contractFormData, reference: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="MC-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titre *</label>
                <input
                  type="text"
                  required
                  value={contractFormData.title}
                  onChange={(e) => setContractFormData({ ...contractFormData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Marché exploitation CVC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire *</label>
                <input
                  type="text"
                  required
                  value={contractFormData.provider}
                  onChange={(e) => setContractFormData({ ...contractFormData, provider: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="ENGIE, Dalkia..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date début *</label>
                  <input
                    type="text"
                    required
                    placeholder="01/01/2024"
                    value={contractFormData.startDate}
                    onChange={(e) => setContractFormData({ ...contractFormData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date fin *</label>
                  <input
                    type="text"
                    required
                    placeholder="31/12/2035"
                    value={contractFormData.endDate}
                    onChange={(e) => setContractFormData({ ...contractFormData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type année</label>
                  <select
                    value={contractFormData.yearType}
                    onChange={(e) => setContractFormData({ ...contractFormData, yearType: e.target.value as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL" })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="HEATING_SEASON">Saison de chauffe</option>
                    <option value="CIVIL">Année civile</option>
                    <option value="CONTRACTUAL">Année contractuelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Facturation</label>
                  <select
                    value={contractFormData.billingFrequency}
                    onChange={(e) => setContractFormData({ ...contractFormData, billingFrequency: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL" })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="MENSUEL">Mensuel</option>
                    <option value="TRIMESTRIEL">Trimestriel</option>
                    <option value="SEMESTRIEL">Semestriel</option>
                    <option value="ANNUEL">Annuel</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowContractModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creatingContract}>
                  {creatingContract ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Sites Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto ${importStep === "preview" ? "max-w-4xl" : "max-w-lg"}`}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary-dark">Importer des sites</h2>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {importStep === "upload" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Importez un fichier Excel (.xlsx) contenant vos sites. Le fichier doit contenir les colonnes : Nom, Type, Adresse, Ville, Code postal, Surface, Énergie.
                  </p>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${importFile ? "border-accent bg-accent/5" : "border-gray-200 hover:border-gray-300"}`}>
                    {importFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet size={24} className="text-accent" />
                        <div className="text-left">
                          <p className="font-medium text-primary-dark">{importFile.name}</p>
                          <p className="text-sm text-text-secondary">{(importFile.size / 1024).toFixed(1)} Ko</p>
                        </div>
                        <button onClick={() => setImportFile(null)} className="p-1 hover:bg-gray-100 rounded">
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-primary-dark font-medium">Cliquez pour sélectionner un fichier</p>
                        <p className="text-sm text-text-secondary">ou glissez-déposez ici</p>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setImportFile(file); }} />
                      </label>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowImportModal(false)}>Annuler</Button>
                    <Button className="flex-1" disabled={!importFile || importing} onClick={handleImportPreview}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Analyse...</>) : "Suivant →"}
                    </Button>
                  </div>
                </div>
              )}

              {importStep === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    <strong>{previewSites.length} site{previewSites.length > 1 ? "s" : ""}</strong> à importer pour le contrat <strong>{selectedContract?.reference}</strong>.
                  </p>
                  <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Nom</th>
                          <th className="text-left px-3 py-2 font-medium">Type</th>
                          <th className="text-left px-3 py-2 font-medium">Ville</th>
                          <th className="text-left px-3 py-2 font-medium">Énergie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewSites.map((site, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{site.name}</td>
                            <td className="px-3 py-2">{site.type}</td>
                            <td className="px-3 py-2">{site.city}</td>
                            <td className="px-3 py-2">{site.energyType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setImportStep("upload")}>← Retour</Button>
                    <Button className="flex-1" disabled={previewSites.length === 0 || importing} onClick={handleImport}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Import...</>) : (<><CheckCircle size={18} className="mr-2" />Importer ({previewSites.length})</>)}
                    </Button>
                  </div>
                </div>
              )}

              {importStep === "result" && importResult && (
                <div className="text-center py-4">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">Import réussi !</h3>
                      <p className="text-text-secondary mb-4">{importResult.imported} site{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur</h3>
                      <div className="text-sm text-red-600 mb-4">
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

export default function AdministratifPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <AdministratifContent />
    </Suspense>
  );
}
