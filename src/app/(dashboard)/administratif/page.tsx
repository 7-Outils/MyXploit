"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
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
  FileSpreadsheet,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

// Types
interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
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

type ContractStatus = "ACTIF" | "ALL" | "EXPIRE" | "RESILIE" | "EN_ATTENTE";

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

function AdministratifContent() {
  const router = useRouter();

  // Contracts state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus>("ACTIF");
  const [showContractModal, setShowContractModal] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

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

  // AE Import state
  const [showAEImportModal, setShowAEImportModal] = useState(false);
  const [selectedContractForImport, setSelectedContractForImport] = useState<Contract | null>(null);
  const [importingAE, setImportingAE] = useState(false);
  const [aeImportFile, setAEImportFile] = useState<File | null>(null);
  const [aeImportPreview, setAEImportPreview] = useState<{
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      siteName?: string;
      siteId?: string;
      contractType?: string;
      nbValues?: Record<string, number>;
      p2Values?: Record<string, number>;
      p3Values?: Record<string, number>;
      message?: string;
    }>;
  } | null>(null);
  const [aeImportError, setAEImportError] = useState<string | null>(null);
  const aeFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch contracts
  useEffect(() => {
    fetchContracts();
  }, []);

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
        const newContract = await response.json();
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
        // Redirect to the new contract
        router.push(`/contracts/${newContract.id}`);
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

  // AE Import handlers
  const openAEImportModal = (contract: Contract) => {
    setSelectedContractForImport(contract);
    setShowAEImportModal(true);
    setAEImportFile(null);
    setAEImportPreview(null);
    setAEImportError(null);
  };

  const handleAEFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContractForImport) return;

    setAEImportFile(file);
    setAEImportError(null);
    setAEImportPreview(null);
    setImportingAE(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractId", selectedContractForImport.id);
      formData.append("preview", "true");

      const response = await fetch("/api/contracts/import-ae", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setAEImportError(result.error || "Erreur lors de l'analyse");
        return;
      }

      setAEImportPreview(result);
    } catch (error) {
      console.error("Error parsing AE file:", error);
      setAEImportError("Erreur lors de la lecture du fichier");
    } finally {
      setImportingAE(false);
    }
  };

  const handleAEImportSubmit = async () => {
    if (!aeImportFile || !selectedContractForImport) return;

    setImportingAE(true);
    try {
      const formData = new FormData();
      formData.append("file", aeImportFile);
      formData.append("contractId", selectedContractForImport.id);
      formData.append("preview", "false");

      const response = await fetch("/api/contracts/import-ae", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setAEImportError(result.error || "Erreur lors de l'import");
        return;
      }

      // Success - close modal and reset
      setShowAEImportModal(false);
      setSelectedContractForImport(null);
      setAEImportFile(null);
      setAEImportPreview(null);
      setAEImportError(null);
    } catch (error) {
      console.error("Error importing AE:", error);
      setAEImportError("Erreur lors de l'import");
    } finally {
      setImportingAE(false);
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
          <p className="text-text-secondary">Gestion des contrats d&apos;exploitation</p>
        </div>
        <Button onClick={() => setShowContractModal(true)}>
          <Plus size={18} className="mr-2" />
          Nouveau contrat
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Contrats actifs" value={countByStatus.ACTIF.toString()} icon={FileText} iconColor="text-accent" />
        <StatsCard title="Sites totaux" value={totalSites.toString()} icon={Building2} iconColor="text-blue-600" />
        <StatsCard title="En attente" value={countByStatus.EN_ATTENTE.toString()} icon={FileText} iconColor="text-yellow-600" />
        <StatsCard title="Expirés" value={countByStatus.EXPIRE.toString()} icon={FileText} iconColor="text-red-600" />
      </div>

      {/* Filters */}
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAEImportModal(contract);
                        }}
                        className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        title="Importer Acte d'Engagement"
                      >
                        <FileSpreadsheet size={18} />
                      </button>
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

      {/* AE Import Modal */}
      {showAEImportModal && selectedContractForImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Importer Acte d&apos;Engagement</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {selectedContractForImport.title} - Import NB, P2/P3 et type de contrat
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAEImportModal(false);
                  setSelectedContractForImport(null);
                  setAEImportFile(null);
                  setAEImportPreview(null);
                  setAEImportError(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* File upload zone */}
              <div
                onClick={() => aeFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  importingAE ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"
                }`}
              >
                <input
                  ref={aeFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleAEFileSelect}
                  className="hidden"
                  disabled={importingAE}
                />
                {importingAE ? (
                  <>
                    <Loader2 size={40} className="mx-auto text-accent animate-spin mb-3" />
                    <p className="text-text-secondary">Analyse du fichier en cours...</p>
                  </>
                ) : aeImportFile ? (
                  <>
                    <FileSpreadsheet size={40} className="mx-auto text-accent mb-3" />
                    <p className="font-medium text-primary-dark">{aeImportFile.name}</p>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
                    <p className="font-medium text-primary-dark">Cliquez pour sélectionner le fichier AE (Excel)</p>
                    <p className="text-sm text-text-secondary mt-1">
                      Format attendu : feuille &quot;P2P3&quot; avec colonnes Libellé, Contrat, NB, P2x, P3x
                    </p>
                  </>
                )}
              </div>

              {/* Error message */}
              {aeImportError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <p>{aeImportError}</p>
                </div>
              )}

              {/* Preview results */}
              {aeImportPreview && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary-dark">{aeImportPreview.total}</p>
                      <p className="text-xs text-text-secondary">Sites</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{aeImportPreview.valid}</p>
                      <p className="text-xs text-green-700">Matchés</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-600">{aeImportPreview.warnings}</p>
                      <p className="text-xs text-yellow-700">Avertissements</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-600">{aeImportPreview.errors}</p>
                      <p className="text-xs text-red-700">Non trouvés</p>
                    </div>
                  </div>

                  {/* Results table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">#</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">Statut</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">Site</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">Contrat</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">NB</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">P2</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">P3</th>
                          <th className="px-3 py-2 text-left font-medium text-text-secondary">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aeImportPreview.results.map((result) => (
                          <tr
                            key={result.row}
                            className={
                              result.status === "error"
                                ? "bg-red-50"
                                : result.status === "warning"
                                ? "bg-yellow-50"
                                : ""
                            }
                          >
                            <td className="px-3 py-2">{result.row}</td>
                            <td className="px-3 py-2">
                              {result.status === "ok" && <Check size={16} className="text-green-600" />}
                              {result.status === "warning" && <AlertCircle size={16} className="text-yellow-600" />}
                              {result.status === "error" && <X size={16} className="text-red-600" />}
                            </td>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={result.siteName}>
                              {result.siteName || "-"}
                            </td>
                            <td className="px-3 py-2">{result.contractType || "-"}</td>
                            <td className="px-3 py-2">
                              {result.nbValues ? Object.keys(result.nbValues).length : 0} an(s)
                            </td>
                            <td className="px-3 py-2">
                              {result.p2Values ? (
                                <span className="text-xs">
                                  {Object.values(result.p2Values).filter(v => v !== undefined).reduce((a, b) => (a || 0) + (b || 0), 0).toLocaleString("fr-FR")} €
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {result.p3Values ? (
                                <span className="text-xs">
                                  {Object.values(result.p3Values).filter(v => v !== undefined).reduce((a, b) => (a || 0) + (b || 0), 0).toLocaleString("fr-FR")} €
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-3 py-2 text-xs max-w-[150px] truncate" title={result.message}>
                              {result.message || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Info box */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Données qui seront importées :</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• NB (Niveau de Base) par année de contrat</li>
                      <li>• P2 détaillé : Chauffage, Ventilation, Climatisation, ECS, Traitement eau, MDE</li>
                      <li>• P3 détaillé : Chauffage, Ventilation, Climatisation, ECS/traitement, Prestations, APE</li>
                      <li>• Type de contrat par site (PFI, PF, MTI, etc.)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAEImportModal(false);
                    setSelectedContractForImport(null);
                    setAEImportFile(null);
                    setAEImportPreview(null);
                    setAEImportError(null);
                  }}
                >
                  Annuler
                </Button>
                {aeImportPreview && aeImportPreview.valid > 0 && (
                  <Button className="flex-1" onClick={handleAEImportSubmit} disabled={importingAE}>
                    {importingAE ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      `Importer ${aeImportPreview.valid} site${aeImportPreview.valid > 1 ? "s" : ""}`
                    )}
                  </Button>
                )}
              </div>
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
