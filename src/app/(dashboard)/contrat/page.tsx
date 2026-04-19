"use client";

import { useState, Suspense } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import {
  Loader2,
  FileSpreadsheet,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import ContractSitesTab from "@/components/administratif/ContractSitesTab";
import ContractAvenantsTab from "@/components/administratif/ContractAvenantsTab";
import ContractRevisionTab from "@/components/administratif/ContractRevisionTab";
import ContractMontantsTab from "@/components/administratif/ContractMontantsTab";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import type { Contract } from "@/components/administratif/types";
import { CiblesContent } from "@/components/contrat/tabs/CiblesTab";
import type { Site } from "@/components/energy/types";

function AdministratifContent() {
  const { selectedContract, isLoading: loadingContracts } = useContract();
  const contractKey = selectedContract?.id;

  const { data: contractDetailData, isLoading: loadingDetail, mutate: mutateDetail } = useSWR<Contract>(
    contractKey ? `/api/contracts/${contractKey}` : null, fetcher
  );
  const { data: energySitesData, mutate: mutateSites } = useSWR<Site[]>(
    contractKey ? `/api/contracts/${contractKey}/sites` : null, fetcher
  );

  const contractDetail = contractDetailData ?? null;
  const energySites = energySitesData ?? [];
  const fetchDetail = async () => { await Promise.all([mutateDetail(), mutateSites()]); };

  const [activeTab, setActiveTab] = useState<"sites" | "cibles" | "avenants" | "revision" | "montants">("sites");
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [showAEImportModal, setShowAEImportModal] = useState(false);

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
          Sites ({contractSites.length})
        </button>
        <button
          onClick={() => setActiveTab("cibles")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cibles" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          Cibles
        </button>
        <button
          onClick={() => setActiveTab("avenants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "avenants" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          Avenants ({contractDetail?.avenants?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("revision")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "revision" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          Révision
        </button>
        <button
          onClick={() => setActiveTab("montants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "montants" ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          Montants
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

          {/* Révision Tab */}
          {activeTab === "revision" && selectedContract && (
            <ContractRevisionTab contractId={selectedContract.id} />
          )}

          {/* Montants Tab */}
          {activeTab === "montants" && selectedContract && (
            <ContractMontantsTab contractId={selectedContract.id} />
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
