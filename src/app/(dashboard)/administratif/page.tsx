"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useContract } from "@/contexts/ContractContext";
import {
  FileText,
  Plus,
  Calendar,
  Loader2,
  Building2,
  FileSpreadsheet,
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
import CreateContractModal from "@/components/administratif/modals/CreateContractModal";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import { statusLabels } from "@/components/administratif/constants";
import type { Contract } from "@/components/administratif/types";

function AdministratifContent() {
  const { selectedContract, isLoading: loadingContracts } = useContract();

  // Contract detail state
  const [contractDetail, setContractDetail] = useState<Contract | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "sites" | "avenants" | "financier">("general");

  // Modal visibility
  const [showContractModal, setShowContractModal] = useState(false);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showAEImportModal, setShowAEImportModal] = useState(false);

  // Delete state
  const [deletingContract, setDeletingContract] = useState(false);

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
            <Button variant="outline" onClick={() => setShowAEImportModal(true)}>
              <FileSpreadsheet size={18} className="mr-2" />
              Créer depuis AE
            </Button>
            <Button onClick={() => setShowContractModal(true)}>
              <Plus size={18} className="mr-2" />
              Nouveau contrat
            </Button>
          </div>
        </div>

        {/* Modals */}
        {showContractModal && <CreateContractModal onClose={() => setShowContractModal(false)} />}
        {showAEImportModal && <AEImportModal onClose={() => setShowAEImportModal(false)} />}
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
      <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditContractModal(true)}>
            <Pencil size={18} className="mr-2" />
            Modifier
          </Button>
          <Button variant="outline" onClick={() => setShowAEImportModal(true)}>
            <FileSpreadsheet size={18} className="mr-2" />
            Créer depuis AE
          </Button>
          <Button onClick={() => setShowContractModal(true)}>
            <Plus size={18} className="mr-2" />
            Nouveau contrat
          </Button>
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

      {/* Modals */}
      {showContractModal && <CreateContractModal onClose={() => setShowContractModal(false)} />}
      {showEditContractModal && contractDetail && (
        <EditContractModal
          contractId={selectedContract.id}
          contractDetail={contractDetail}
          onClose={() => setShowEditContractModal(false)}
          onUpdated={fetchDetail}
        />
      )}
      {showAEImportModal && <AEImportModal onClose={() => setShowAEImportModal(false)} />}
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
