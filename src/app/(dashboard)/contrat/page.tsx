"use client";

import { useState, useEffect, Suspense } from "react";
import { useContract } from "@/contexts/ContractContext";
import {
  Loader2,
  Building2,
  FileSpreadsheet,
  Pencil,
  Euro,
  GitBranch,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import ContractSitesTab from "@/components/administratif/ContractSitesTab";
import ContractAvenantsTab from "@/components/administratif/ContractAvenantsTab";
import ContractFinancierTab from "@/components/administratif/ContractFinancierTab";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import type { Contract } from "@/components/administratif/types";
import { CiblesContent } from "@/components/contrat/tabs/CiblesTab";
import type { Site } from "@/components/energy/types";

function AdministratifContent() {
  const { selectedContract, isLoading: loadingContracts } = useContract();

  // Contract detail state
  const [contractDetail, setContractDetail] = useState<Contract | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"sites" | "cibles" | "avenants" | "financier">("sites");
  const [energySites, setEnergySites] = useState<Site[]>([]);

  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showAEImportModal, setShowAEImportModal] = useState(false);

  // Fetch contract detail + energy sites
  const fetchDetail = async () => {
    if (!selectedContract) {
      setContractDetail(null);
      setEnergySites([]);
      return;
    }
    setLoadingDetail(true);
    try {
      const [contractRes, sitesRes] = await Promise.all([
        fetch(`/api/contracts/${selectedContract.id}`),
        fetch(`/api/contracts/${selectedContract.id}/sites`),
      ]);
      if (contractRes.ok) {
        setContractDetail(await contractRes.json());
      }
      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        setEnergySites(Array.isArray(sitesData) ? sitesData : []);
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
          <h1 className="text-2xl font-bold text-primary-dark">Contrat</h1>
          <p className="text-text-secondary">Sélectionnez ou créez un contrat depuis le sélecteur en haut de page</p>
        </div>
      </div>
    );
  }

  const contractSites = contractDetail?.contractSites || [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditContractModal(true)}>
            <Pencil size={18} className="mr-2" />
            Modifier
          </Button>
          <Button variant="outline" onClick={() => setShowAEImportModal(true)}>
            <FileSpreadsheet size={18} className="mr-2" />
            Importer AE
          </Button>
        </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
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
          onClick={() => setActiveTab("cibles")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cibles" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <Target size={16} className="inline mr-2" />
          Cibles
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
          {/* Cibles Tab */}
          {activeTab === "cibles" && selectedContract && (
            <CiblesContent
              contract={selectedContract}
              selectedYear={new Date().getFullYear()}
              sites={energySites}
              onNbUpdate={fetchDetail}
            />
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

      {showEditContractModal && contractDetail && (
        <EditContractModal
          contractId={selectedContract.id}
          contractDetail={contractDetail}
          onClose={() => setShowEditContractModal(false)}
          onUpdated={fetchDetail}
        />
      )}
      {showAEImportModal && <AEImportModal onClose={() => setShowAEImportModal(false)} contractId={selectedContract?.id} />}
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
