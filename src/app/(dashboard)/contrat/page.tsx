"use client";

import { useState, Suspense } from "react";
import useSWR, { preload } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import {
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { sortTabsAlpha } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/contexts/PermissionContext";
import { api, getErrorMessage } from "@/lib/api-client";

import ContractSitesTab from "@/components/administratif/ContractSitesTab";
import ContractContactsTab from "@/components/administratif/ContractContactsTab";
import ContractAvenantsTab from "@/components/administratif/ContractAvenantsTab";
import ContractRevisionTab from "@/components/administratif/ContractRevisionTab";
import ContractMontantsTab from "@/components/administratif/ContractMontantsTab";
import ContractRenewalPlanTab from "@/components/administratif/ContractRenewalPlanTab";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import type { Contract } from "@/components/administratif/types";
import { CiblesContent } from "@/components/contrat/tabs/CiblesTab";
import type { Site } from "@/components/energy/types";

type ContratTab = "sites" | "cibles" | "contacts" | "avenants" | "revision" | "montants" | "renouvellement";

const CONTRAT_TABS = sortTabsAlpha([
  { id: "sites" as ContratTab, label: "Sites" },
  { id: "cibles" as ContratTab, label: "Cibles" },
  { id: "contacts" as ContratTab, label: "Contacts" },
  { id: "avenants" as ContratTab, label: "Avenants" },
  { id: "revision" as ContratTab, label: "Révision" },
  { id: "montants" as ContratTab, label: "Montants" },
  { id: "renouvellement" as ContratTab, label: "Renouvellement" },
]);

function AdministratifContent() {
  const { selectedContract, isLoading: loadingContracts, clearContract } = useContract();
  const { canDelete } = usePermissions();
  const toast = useToast();
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

  const [activeTab, setActiveTab] = useState<ContratTab>(CONTRAT_TABS[0].id);
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteContract = async () => {
    if (!selectedContract) return;
    setDeleting(true);
    try {
      await api.del(`/api/contracts/${selectedContract.id}`);
      const clientId = selectedContract.client?.id;
      clearContract();
      // Retour à la fiche du client (ou à la liste) : le contexte de contrat n'existe plus
      window.location.assign(clientId ? `/clients/${clientId}` : "/clients");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
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
      <div className="space-y-4">
        <div className="border-b border-ink/10 pb-2">
          <h1 className="text-xl font-semibold text-ink">Contrat</h1>
          <p className="label-tech mt-1">Sélectionnez ou créez un contrat depuis le sélecteur en haut de page</p>
        </div>
      </div>
    );
  }

  const contractSites = contractDetail?.contractSites || [];

  return (
    <div className="space-y-4">
      {/* Tabs + actions */}
      <div className="border-b border-ink/10 flex items-end justify-between gap-2">
      <div className="flex gap-2 -mb-px overflow-x-auto">
        {CONTRAT_TABS.map((tab) => {
          const count =
            tab.id === "sites" ? contractSites.length
              : tab.id === "avenants" ? (contractDetail?.avenants?.length || 0)
              : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => {
                if (!selectedContract) return;
                if (tab.id === "cibles") {
                  preload(`/api/heating-seasons?contractId=${selectedContract.id}`, fetcher);
                } else if (tab.id === "revision") {
                  preload(`/api/contracts/${selectedContract.id}/revision-indices`, fetcher);
                  preload(`/api/contracts/${selectedContract.id}/revision-timeline`, fetcher);
                } else if (tab.id === "montants") {
                  preload(`/api/contracts/${selectedContract.id}/amounts-timeline`, fetcher);
                }
              }}
              className={`px-4 py-2 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "border-accent text-accent" : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              {tab.label}{count !== null ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setShowEditContractModal(true)}
            title="Modifier le contrat"
            className="h-9 w-9 flex items-center justify-center border border-ink/20 text-ink hover:border-accent hover:text-accent transition-colors"
          >
            <Pencil size={16} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Supprimer le contrat"
              className="h-9 w-9 flex items-center justify-center border border-ink/20 text-ink/60 hover:border-red-600/40 hover:text-red-600 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {confirmDelete && selectedContract && (
        <Modal
          title="Supprimer le contrat"
          subtitle={[selectedContract.client?.name, selectedContract.provider, selectedContract.reference].filter(Boolean).join(" · ")}
          size="sm"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Annuler</Button>
              <Button size="sm" onClick={deleteContract} disabled={deleting} className="bg-red-700 hover:bg-red-800">
                {deleting && <Loader2 size={14} className="mr-2 animate-spin" />}
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">Le contrat et ses sites seront supprimés. Action irréversible.</p>
        </Modal>
      )}

      {/* Tab Content */}
      {loadingDetail && !contractDetail ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* General Tab */}
          {/* Cibles Tab */}
          {activeTab === "cibles" && selectedContract && (!selectedContract.startDate || !selectedContract.endDate) && (
            <div className="panel p-8 text-center text-sm text-ink/50">
              Renseigne les dates de début et de fin du contrat pour définir les cibles.
            </div>
          )}
          {activeTab === "cibles" && selectedContract && selectedContract.startDate && selectedContract.endDate && (
            <CiblesContent
              contract={{ ...selectedContract, startDate: selectedContract.startDate, endDate: selectedContract.endDate }}
              selectedYear={new Date().getFullYear()}
              sites={energySites}
              onNbUpdate={fetchDetail}
            />
          )}

          {/* Contacts Tab */}
          {activeTab === "contacts" && selectedContract && (
            <ContractContactsTab contractId={selectedContract.id} />
          )}

          {/* Renouvellement Tab */}
          {activeTab === "renouvellement" && selectedContract && (
            <ContractRenewalPlanTab contractId={selectedContract.id} />
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
