"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useContract } from "@/contexts/ContractContext";
import {
  FileText,
  Plus,
  Calendar,
  Loader2,
  X,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Pencil,
  Trash2,
  Euro,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import ContractSitesTab from "@/components/administratif/ContractSitesTab";
import ContractAvenantsTab from "@/components/administratif/ContractAvenantsTab";
import ContractFinancierTab from "@/components/administratif/ContractFinancierTab";

// Types
interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  amountP21: number | null;
  amountP22: number | null;
  amountP23: number | null;
  amountP24: number | null;
  amountP25: number | null;
  amountP26: number | null;
  amountP31: number | null;
  amountP32: number | null;
  amountP33: number | null;
  amountP34: number | null;
  amountP35: number | null;
  amountP36: number | null;
  coefficientPCS: number | null;
  integrationDate: string | null;
  exitDate: string | null;
  site: {
    id: string;
    name: string;
    type: string;
    address: string;
    city: string;
    postalCode: string;
    surface: number | null;
    surfaceChauffee: number | null;
    energyType: string;
    nb: number | null;
    nbUnit: string | null;
    pce: string | null;
    pdl: string | null;
  };
}

interface AvenantItem {
  id: string;
  type: string;
  effectiveDate: string;
  description: string | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  newAmountP1: number | null;
  newAmountP2: number | null;
  newAmountP3: number | null;
  contractSite: {
    id: string;
    site: { id: string; name: string; type: string };
  } | null;
  equipment: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface Avenant {
  id: string;
  reference: string;
  signatureDate: string | null;
  description: string | null;
  items: AvenantItem[];
  _totals: {
    deltaP1: number;
    deltaP2: number;
    deltaP3: number;
    total: number;
  };
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  yearType: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  yearStartMonth: number;
  yearStartDay: number;
  billingFrequency: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  contractSites: ContractSite[];
  avenants: Avenant[];
  _count?: { contractSites: number };
}

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

function AdministratifContent() {
  const router = useRouter();
  const { selectedContract, isLoading: loadingContracts } = useContract();

  // Contract detail state
  const [contractDetail, setContractDetail] = useState<Contract | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "sites" | "avenants" | "financier">("general");

  // Create contract modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractFormData, setContractFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    startDate: "",
    endDate: "",
    yearType: "HEATING_SEASON" as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL",
    billingFrequency: "TRIMESTRIEL" as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
  });

  // Edit contract modal
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [updatingContract, setUpdatingContract] = useState(false);
  const [deletingContract, setDeletingContract] = useState(false);
  const [editContractFormData, setEditContractFormData] = useState({
    reference: "", title: "", provider: "", description: "",
    startDate: "", endDate: "", status: "ACTIF",
    yearType: "HEATING_SEASON" as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL",
    billingFrequency: "TRIMESTRIEL" as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
  });

  // AE Import state
  const [showAEImportModal, setShowAEImportModal] = useState(false);
  const [importingAE, setImportingAE] = useState(false);
  const [aeImportFile, setAEImportFile] = useState<File | null>(null);
  const [aeImportPreview, setAEImportPreview] = useState<{
    total: number;
    newSites: number;
    existingSites: number;
    dataSheetName?: string;
    detectedMetadata?: {
      reference?: string; title?: string; provider?: string;
      startDate?: string; endDate?: string;
      yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
      billingFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
    };
    results: Array<{
      row: number; siteName: string; contractType: string; isNew: boolean;
      existingSiteId?: string; nbValues?: Record<string, number>;
      p1Total?: number; p2Total?: number; p3Total?: number;
    }>;
  } | null>(null);
  const [aeImportError, setAEImportError] = useState<string | null>(null);
  const aeFileInputRef = useRef<HTMLInputElement>(null);
  const [aeContractForm, setAEContractForm] = useState({
    reference: "", title: "", provider: "", startDate: "", endDate: "",
    yearType: "HEATING_SEASON" as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL",
    billingFrequency: "TRIMESTRIEL" as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
  });

  // Fetch contract detail
  const fetchDetail = async () => {
    if (!selectedContract) {
      setContractDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}`);
      if (response.ok) {
        const data = await response.json();
        setContractDetail(data);
      }
    } catch (error) {
      console.error("Error fetching contract detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [selectedContract]);

  const parseFrenchDate = (dateStr: string): string => {
    const parts = dateStr.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    return dateStr;
  };

  const formatToFrench = (isoDate: string): string => {
    const date = isoDate.split("T")[0];
    const parts = date.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return date;
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
        setShowContractModal(false);
        setContractFormData({ reference: "", title: "", provider: "", startDate: "", endDate: "", yearType: "HEATING_SEASON", billingFrequency: "TRIMESTRIEL" });
        // Reload page to pick up new contract in context
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    } finally {
      setCreatingContract(false);
    }
  };

  // Edit contract
  const openEditContractModal = () => {
    if (!contractDetail) return;
    setEditContractFormData({
      reference: contractDetail.reference,
      title: contractDetail.title,
      provider: contractDetail.provider,
      description: contractDetail.description || "",
      startDate: formatToFrench(contractDetail.startDate),
      endDate: formatToFrench(contractDetail.endDate),
      status: contractDetail.status,
      yearType: contractDetail.yearType || "HEATING_SEASON",
      billingFrequency: contractDetail.billingFrequency || "TRIMESTRIEL",
    });
    setShowEditContractModal(true);
  };

  const handleUpdateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    setUpdatingContract(true);
    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: editContractFormData.reference,
          title: editContractFormData.title,
          provider: editContractFormData.provider,
          description: editContractFormData.description || null,
          startDate: parseFrenchDate(editContractFormData.startDate),
          endDate: parseFrenchDate(editContractFormData.endDate),
          status: editContractFormData.status,
          yearType: editContractFormData.yearType,
          billingFrequency: editContractFormData.billingFrequency,
        }),
      });
      if (response.ok) {
        await fetchDetail();
        setShowEditContractModal(false);
      }
    } catch (error) {
      console.error("Error updating contract:", error);
    } finally {
      setUpdatingContract(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!selectedContract) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce contrat ? Cette action est irréversible et supprimera tous les avenants, sites associés et historiques de prix.")) return;
    setDeletingContract(true);
    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}`, { method: "DELETE" });
      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la suppression du contrat");
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
      alert("Erreur lors de la suppression du contrat");
    } finally {
      setDeletingContract(false);
    }
  };

  // AE Import handlers
  const openAEImportModal = () => {
    setShowAEImportModal(true);
    setAEImportFile(null);
    setAEImportPreview(null);
    setAEImportError(null);
    setAEContractForm({ reference: "", title: "", provider: "", startDate: "", endDate: "", yearType: "HEATING_SEASON", billingFrequency: "TRIMESTRIEL" });
  };

  const handleAEFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAEImportFile(file);
    setAEImportError(null);
    setAEImportPreview(null);
    setImportingAE(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "true");
      const response = await fetch("/api/contracts/create-from-ae", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) { setAEImportError(result.error || "Erreur lors de l'analyse"); return; }
      setAEImportPreview(result);
      if (result.detectedMetadata) {
        const meta = result.detectedMetadata;
        setAEContractForm((prev) => ({
          ...prev,
          reference: meta.reference || prev.reference, title: meta.title || prev.title,
          provider: meta.provider || prev.provider, startDate: meta.startDate || prev.startDate,
          endDate: meta.endDate || prev.endDate, yearType: meta.yearType || prev.yearType,
          billingFrequency: meta.billingFrequency || prev.billingFrequency,
        }));
      }
    } catch (error) {
      console.error("Error parsing AE file:", error);
      setAEImportError("Erreur lors de la lecture du fichier");
    } finally {
      setImportingAE(false);
    }
  };

  const handleAEImportSubmit = async () => {
    if (!aeImportFile || !aeImportPreview) return;
    if (!aeContractForm.reference || !aeContractForm.title || !aeContractForm.provider || !aeContractForm.startDate || !aeContractForm.endDate) {
      setAEImportError("Veuillez remplir tous les champs obligatoires du contrat");
      return;
    }
    setImportingAE(true);
    try {
      const formData = new FormData();
      formData.append("file", aeImportFile);
      formData.append("preview", "false");
      formData.append("reference", aeContractForm.reference);
      formData.append("title", aeContractForm.title);
      formData.append("provider", aeContractForm.provider);
      formData.append("startDate", parseFrenchDate(aeContractForm.startDate));
      formData.append("endDate", parseFrenchDate(aeContractForm.endDate));
      formData.append("yearType", aeContractForm.yearType);
      formData.append("billingFrequency", aeContractForm.billingFrequency);
      const response = await fetch("/api/contracts/create-from-ae", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) { setAEImportError(result.error || "Erreur lors de la création"); return; }
      setShowAEImportModal(false);
      setAEImportFile(null);
      setAEImportPreview(null);
      setAEImportError(null);
      window.location.reload();
    } catch (error) {
      console.error("Error creating contract from AE:", error);
      setAEImportError("Erreur lors de la création du contrat");
    } finally {
      setImportingAE(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Suivi administratif</h1>
            <p className="text-text-secondary">Sélectionnez un contrat dans la barre supérieure</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openAEImportModal}>
              <FileSpreadsheet size={18} className="mr-2" />
              Créer depuis AE
            </Button>
            <Button onClick={() => setShowContractModal(true)}>
              <Plus size={18} className="mr-2" />
              Nouveau contrat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const contractSites = contractDetail?.contractSites || [];
  const hasAnyP1 = contractSites.some((cs) => cs.hasP1);
  const hasAnyP2 = contractSites.some((cs) => cs.hasP2);
  const hasAnyP3 = contractSites.some((cs) => cs.hasP3);
  const hasAnyP4 = contractSites.some((cs) => cs.hasP4);
  const uniqueContractTypes = [...new Set(contractSites.map((cs) => cs.contractType).filter(Boolean))];
  const contractStatus = (contractDetail?.status || selectedContract.status || "ACTIF") as keyof typeof statusLabels;

  const endDate = new Date(selectedContract.endDate);
  const now = new Date();
  const remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Suivi administratif</h1>
          <p className="text-text-secondary">{selectedContract.reference} - {selectedContract.title}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditContractModal}>
            <Pencil size={18} className="mr-2" />
            Modifier
          </Button>
          <Button variant="outline" onClick={openAEImportModal}>
            <FileSpreadsheet size={18} className="mr-2" />
            Créer depuis AE
          </Button>
          <Button onClick={() => setShowContractModal(true)}>
            <Plus size={18} className="mr-2" />
            Nouveau contrat
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Statut"
          value={statusLabels[contractStatus] || contractStatus}
          icon={FileText}
          iconColor={contractStatus === "ACTIF" ? "text-green-600" : contractStatus === "EN_ATTENTE" ? "text-yellow-600" : "text-red-600"}
        />
        <StatsCard title="Sites" value={contractSites.length.toString()} icon={Building2} iconColor="text-blue-600" />
        <StatsCard
          title="Période"
          value={`${new Date(selectedContract.startDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })} - ${new Date(selectedContract.endDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`}
          icon={Calendar}
          iconColor="text-accent"
        />
        <StatsCard
          title={remainingDays > 0 ? "Jours restants" : "Expiré depuis"}
          value={`${Math.abs(remainingDays)} j`}
          icon={Calendar}
          iconColor={remainingDays > 365 ? "text-green-600" : remainingDays > 90 ? "text-yellow-600" : "text-red-600"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "general" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <FileText size={16} className="inline mr-2" />
          Général
        </button>
        <button
          onClick={() => setActiveTab("sites")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sites" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <Building2 size={16} className="inline mr-2" />
          Sites ({contractSites.length})
        </button>
        <button
          onClick={() => setActiveTab("avenants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "avenants" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <GitBranch size={16} className="inline mr-2" />
          Avenants ({contractDetail?.avenants?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("financier")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "financier" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <Euro size={16} className="inline mr-2" />
          Financier
        </button>
      </div>

      {/* Tab Content */}
      {loadingDetail && !contractDetail ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* General Tab */}
          {activeTab === "general" && (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                <ChartCard title="Informations générales">
                  <div className="space-y-3 -mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Titulaire</span>
                      <span className="text-sm font-medium">{selectedContract.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Référence</span>
                      <span className="text-sm font-medium">{selectedContract.reference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Début</span>
                      <span className="text-sm font-medium">{new Date(selectedContract.startDate).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Fin</span>
                      <span className="text-sm font-medium">{new Date(selectedContract.endDate).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Statut</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        contractStatus === "ACTIF" ? "bg-green-100 text-green-700"
                        : contractStatus === "EN_ATTENTE" ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {statusLabels[contractStatus] || contractStatus}
                      </span>
                    </div>
                    {contractDetail?.description && (
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-sm text-text-secondary">Description</span>
                        <p className="text-sm mt-1">{contractDetail.description}</p>
                      </div>
                    )}
                  </div>
                </ChartCard>

                <ChartCard title="Prestations">
                  <div className="space-y-3 -mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {uniqueContractTypes.length > 0 ? uniqueContractTypes.map((type) => (
                        <span key={type} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm font-medium">{type}</span>
                      )) : (
                        <span className="text-sm text-text-secondary">Aucun type défini</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${hasAnyP1 ? "bg-yellow-100 text-yellow-700" : "bg-gray-50 text-gray-400"}`}>P1 {hasAnyP1 ? "inclus" : "-"}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${hasAnyP2 ? "bg-blue-100 text-blue-700" : "bg-gray-50 text-gray-400"}`}>P2 {hasAnyP2 ? "inclus" : "-"}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${hasAnyP3 ? "bg-green-100 text-green-700" : "bg-gray-50 text-gray-400"}`}>P3 {hasAnyP3 ? "inclus" : "-"}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${hasAnyP4 ? "bg-purple-100 text-purple-700" : "bg-gray-50 text-gray-400"}`}>P4 {hasAnyP4 ? "inclus" : "-"}</span>
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* Simple sites table in general tab */}
              {contractSites.length > 0 && (
                <ChartCard title={`Sites du contrat (${contractSites.length})`}>
                  <div className="overflow-x-auto -mt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary uppercase">Site</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary uppercase">Type contrat</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-text-secondary uppercase">P1</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-text-secondary uppercase">P2</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-text-secondary uppercase">P3</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-text-secondary uppercase">P4</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {contractSites.map((cs) => (
                          <tr key={cs.id} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3">
                              <Link href={`/buildings/${cs.site.id}`} className="font-medium text-primary-dark hover:text-accent">
                                {cs.site.name}{cs.site.city ? ` - ${cs.site.city}` : ""}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3">
                              {cs.contractType ? <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{cs.contractType}</span> : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center">{cs.hasP1 ? <Check size={16} className="text-yellow-600 mx-auto" /> : "-"}</td>
                            <td className="py-2.5 px-3 text-center">{cs.hasP2 ? <Check size={16} className="text-blue-600 mx-auto" /> : "-"}</td>
                            <td className="py-2.5 px-3 text-center">{cs.hasP3 ? <Check size={16} className="text-green-600 mx-auto" /> : "-"}</td>
                            <td className="py-2.5 px-3 text-center">{cs.hasP4 ? <Check size={16} className="text-purple-600 mx-auto" /> : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}

              {/* Delete contract action */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleDeleteContract}
                  disabled={deletingContract}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {deletingContract ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Trash2 size={18} className="mr-2" />}
                  Supprimer le contrat
                </Button>
              </div>
            </>
          )}

          {/* Sites Tab */}
          {activeTab === "sites" && contractDetail && (
            <ContractSitesTab
              contractId={selectedContract.id}
              contract={contractDetail}
              onContractUpdate={fetchDetail}
            />
          )}

          {/* Avenants Tab */}
          {activeTab === "avenants" && contractDetail && (
            <ContractAvenantsTab
              contractId={selectedContract.id}
              contract={contractDetail}
              onContractUpdate={fetchDetail}
            />
          )}

          {/* Financier Tab */}
          {activeTab === "financier" && contractDetail && (
            <ContractFinancierTab
              contractId={selectedContract.id}
              contract={contractDetail}
            />
          )}
        </>
      )}

      {/* Create Contract Modal */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouveau contrat</h2>
              <button onClick={() => setShowContractModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
                <input type="text" required value={contractFormData.reference} onChange={(e) => setContractFormData({ ...contractFormData, reference: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="MC-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titre *</label>
                <input type="text" required value={contractFormData.title} onChange={(e) => setContractFormData({ ...contractFormData, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Marché exploitation CVC" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire *</label>
                <input type="text" required value={contractFormData.provider} onChange={(e) => setContractFormData({ ...contractFormData, provider: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="ENGIE, Dalkia..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date début *</label>
                  <input type="text" required placeholder="01/01/2024" value={contractFormData.startDate} onChange={(e) => setContractFormData({ ...contractFormData, startDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date fin *</label>
                  <input type="text" required placeholder="31/12/2035" value={contractFormData.endDate} onChange={(e) => setContractFormData({ ...contractFormData, endDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type année</label>
                  <select value={contractFormData.yearType} onChange={(e) => setContractFormData({ ...contractFormData, yearType: e.target.value as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL" })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="HEATING_SEASON">Saison de chauffe</option>
                    <option value="CIVIL">Année civile</option>
                    <option value="CONTRACTUAL">Année contractuelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Facturation</label>
                  <select value={contractFormData.billingFrequency} onChange={(e) => setContractFormData({ ...contractFormData, billingFrequency: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL" })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="MENSUEL">Mensuel</option>
                    <option value="TRIMESTRIEL">Trimestriel</option>
                    <option value="SEMESTRIEL">Semestriel</option>
                    <option value="ANNUEL">Annuel</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowContractModal(false)}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={creatingContract}>
                  {creatingContract ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contract Modal */}
      {showEditContractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Modifier le contrat</h2>
              <button onClick={() => setShowEditContractModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateContract} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
                <input type="text" required value={editContractFormData.reference} onChange={(e) => setEditContractFormData({ ...editContractFormData, reference: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titre du contrat *</label>
                <input type="text" required value={editContractFormData.title} onChange={(e) => setEditContractFormData({ ...editContractFormData, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire (exploitant) *</label>
                <input type="text" required value={editContractFormData.provider} onChange={(e) => setEditContractFormData({ ...editContractFormData, provider: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Description</label>
                <textarea value={editContractFormData.description} onChange={(e) => setEditContractFormData({ ...editContractFormData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date de début *</label>
                  <input type="text" required placeholder="01/01/2024" value={editContractFormData.startDate} onChange={(e) => setEditContractFormData({ ...editContractFormData, startDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date de fin *</label>
                  <input type="text" required placeholder="31/12/2035" value={editContractFormData.endDate} onChange={(e) => setEditContractFormData({ ...editContractFormData, endDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;année</label>
                  <select value={editContractFormData.yearType} onChange={(e) => setEditContractFormData({ ...editContractFormData, yearType: e.target.value as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL" })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="HEATING_SEASON">Saison de chauffe (juil. → juin)</option>
                    <option value="CIVIL">Année civile (janv. → déc.)</option>
                    <option value="CONTRACTUAL">Année contractuelle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Fréquence de facturation</label>
                  <select value={editContractFormData.billingFrequency} onChange={(e) => setEditContractFormData({ ...editContractFormData, billingFrequency: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL" })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="MENSUEL">Mensuel (12 éch./an)</option>
                    <option value="TRIMESTRIEL">Trimestriel (4 éch./an)</option>
                    <option value="SEMESTRIEL">Semestriel (2 éch./an)</option>
                    <option value="ANNUEL">Annuel (1 éch./an)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Statut</label>
                <select value={editContractFormData.status} onChange={(e) => setEditContractFormData({ ...editContractFormData, status: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                  <option value="ACTIF">Actif</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="EXPIRE">Expiré</option>
                  <option value="RESILIE">Résilié</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditContractModal(false)}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={updatingContract}>
                  {updatingContract ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AE Import Modal */}
      {showAEImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Créer un contrat depuis l&apos;Acte d&apos;Engagement</h2>
                <p className="text-sm text-text-secondary mt-1">Import des sites, types de contrat, NB et montants P2/P3</p>
              </div>
              <button onClick={() => { setShowAEImportModal(false); setAEImportFile(null); setAEImportPreview(null); setAEImportError(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-medium text-primary-dark mb-3">1. Sélectionner le fichier AE</h3>
                <div
                  onClick={() => aeFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${importingAE ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"}`}
                >
                  <input ref={aeFileInputRef} type="file" accept=".xlsx,.xls" onChange={handleAEFileSelect} className="hidden" disabled={importingAE} />
                  {importingAE ? (
                    <><Loader2 size={32} className="mx-auto text-accent animate-spin mb-2" /><p className="text-text-secondary">Analyse du fichier en cours...</p></>
                  ) : aeImportFile ? (
                    <><FileSpreadsheet size={32} className="mx-auto text-accent mb-2" /><p className="font-medium text-primary-dark">{aeImportFile.name}</p><p className="text-xs text-text-secondary mt-1">Cliquez pour changer de fichier</p></>
                  ) : (
                    <><FileSpreadsheet size={32} className="mx-auto text-gray-400 mb-2" /><p className="font-medium text-primary-dark">Cliquez pour sélectionner le fichier AE (Excel)</p><p className="text-sm text-text-secondary mt-1">Feuilles supportées : &quot;Contrat&quot; (métadonnées) + &quot;P2P3&quot;/&quot;Sites&quot; (données)</p></>
                  )}
                </div>
              </div>

              {aeImportError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" /><p>{aeImportError}</p>
                </div>
              )}

              {aeImportPreview && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-primary-dark">2. Informations du contrat</h3>
                      {aeImportPreview.detectedMetadata && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1"><Check size={12} />Pré-rempli depuis feuille &quot;Contrat&quot;</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
                        <input type="text" value={aeContractForm.reference} onChange={(e) => setAEContractForm({ ...aeContractForm, reference: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="MC-2024-001" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">Titre *</label>
                        <input type="text" value={aeContractForm.title} onChange={(e) => setAEContractForm({ ...aeContractForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Marché exploitation CVC" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire *</label>
                        <input type="text" value={aeContractForm.provider} onChange={(e) => setAEContractForm({ ...aeContractForm, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="ENGIE, Dalkia..." />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">Date début *</label>
                          <input type="text" value={aeContractForm.startDate} onChange={(e) => setAEContractForm({ ...aeContractForm, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="01/01/2024" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">Date fin *</label>
                          <input type="text" value={aeContractForm.endDate} onChange={(e) => setAEContractForm({ ...aeContractForm, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="31/12/2035" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">Type année</label>
                        <select value={aeContractForm.yearType} onChange={(e) => setAEContractForm({ ...aeContractForm, yearType: e.target.value as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL" })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                          <option value="HEATING_SEASON">Saison de chauffe</option>
                          <option value="CIVIL">Année civile</option>
                          <option value="CONTRACTUAL">Année contractuelle</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">Facturation</label>
                        <select value={aeContractForm.billingFrequency} onChange={(e) => setAEContractForm({ ...aeContractForm, billingFrequency: e.target.value as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL" })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                          <option value="MENSUEL">Mensuel</option>
                          <option value="TRIMESTRIEL">Trimestriel</option>
                          <option value="SEMESTRIEL">Semestriel</option>
                          <option value="ANNUEL">Annuel</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-primary-dark mb-3">3. Sites détectés dans l&apos;AE</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary-dark">{aeImportPreview.total}</p>
                        <p className="text-xs text-text-secondary">Sites total</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">{aeImportPreview.newSites}</p>
                        <p className="text-xs text-green-700">Nouveaux sites</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{aeImportPreview.existingSites}</p>
                        <p className="text-xs text-blue-700">Sites existants</p>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">#</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">Site</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">NB</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">P1</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">P2</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">P3</th>
                            <th className="px-3 py-2 text-left font-medium text-text-secondary">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aeImportPreview.results.map((result) => (
                            <tr key={result.row} className={result.isNew ? "" : "bg-blue-50/50"}>
                              <td className="px-3 py-2">{result.row}</td>
                              <td className="px-3 py-2 max-w-[200px] truncate" title={result.siteName}>{result.siteName}</td>
                              <td className="px-3 py-2"><span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{result.contractType}</span></td>
                              <td className="px-3 py-2 text-xs" title={result.nbValues ? Object.entries(result.nbValues).map(([y, v]) => `A${y}: ${v?.toLocaleString("fr-FR")}`).join(", ") : ""}>
                                {result.nbValues && Object.keys(result.nbValues).length > 0 ? `${Object.values(result.nbValues).reduce((sum, v) => sum + (v || 0), 0).toLocaleString("fr-FR")} MWh` : "-"}
                              </td>
                              <td className="px-3 py-2 text-xs">{result.p1Total ? `${result.p1Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                              <td className="px-3 py-2 text-xs">{result.p2Total ? `${result.p2Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                              <td className="px-3 py-2 text-xs">{result.p3Total ? `${result.p3Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                              <td className="px-3 py-2">
                                {result.isNew ? (
                                  <span className="text-xs text-green-600 flex items-center gap-1"><Plus size={12} /> Nouveau</span>
                                ) : (
                                  <span className="text-xs text-blue-600 flex items-center gap-1"><Check size={12} /> Existant</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg mt-4">
                      <h4 className="font-medium text-blue-800 mb-2">Le contrat sera créé avec :</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• {aeImportPreview.newSites} nouveau(x) site(s) créé(s)</li>
                        <li>• {aeImportPreview.existingSites} site(s) existant(s) lié(s)</li>
                        <li>• Types de contrat par site (PFI, PF, MTI, etc.) déterminant les prestations P1/P2/P3</li>
                        <li>• NB (Niveau de Base) par année de contrat</li>
                        <li>• Montants P1 HT (calculés à l&apos;instant T de l&apos;AE)</li>
                        <li>• Montants P2/P3 détaillés par catégorie (10 sous-composantes)</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button variant="outline" className="flex-1" onClick={() => { setShowAEImportModal(false); setAEImportFile(null); setAEImportPreview(null); setAEImportError(null); }}>Annuler</Button>
                {aeImportPreview && aeImportPreview.total > 0 && (
                  <Button className="flex-1" onClick={handleAEImportSubmit} disabled={importingAE}>
                    {importingAE ? <Loader2 className="w-4 h-4 animate-spin" /> : `Créer le contrat avec ${aeImportPreview.total} site${aeImportPreview.total > 1 ? "s" : ""}`}
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
