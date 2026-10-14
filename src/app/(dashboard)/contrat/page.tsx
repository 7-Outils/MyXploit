"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { preload } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import {
  Loader2,
} from "lucide-react";
import { sortTabsAlpha } from "@/lib/utils";

import ContractSitesTab from "@/components/administratif/ContractSitesTab";
import ContractContactsTab from "@/components/administratif/ContractContactsTab";
import ContractAvenantsTab from "@/components/administratif/ContractAvenantsTab";
import ContractRevisionTab from "@/components/administratif/ContractRevisionTab";
import ContractMontantsTab from "@/components/administratif/ContractMontantsTab";
import ContractRenewalPlanTab from "@/components/administratif/ContractRenewalPlanTab";
import ContractBillingTab from "@/components/administratif/ContractBillingTab";
import type { Contract } from "@/components/administratif/types";
import { CiblesContent } from "@/components/contrat/tabs/CiblesTab";
import type { Site } from "@/components/energy/types";

type ContratTab = "sites" | "cibles" | "contacts" | "avenants" | "facturation" | "revision" | "montants" | "renouvellement";

const CONTRAT_TABS = sortTabsAlpha([
  { id: "sites" as ContratTab, label: "Sites" },
  { id: "cibles" as ContratTab, label: "Cibles" },
  { id: "contacts" as ContratTab, label: "Contacts" },
  { id: "avenants" as ContratTab, label: "Avenants" },
  { id: "facturation" as ContratTab, label: "Facturation" },
  { id: "revision" as ContratTab, label: "Révision" },
  { id: "montants" as ContratTab, label: "Montants" },
  { id: "renouvellement" as ContratTab, label: "Renouvellement" },
]);

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

  // ?tab=facturation (lien depuis Finances) ouvre directement l'onglet demandé
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ContratTab>(
    CONTRAT_TABS.find((t) => t.id === requestedTab)?.id ?? CONTRAT_TABS[0].id
  );
  // L'onglet reste dans l'URL : un rechargement rouvre le même
  const changeTab = (tab: ContratTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `/contrat?${params.toString()}`);
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
              onClick={() => changeTab(tab.id)}
              onMouseEnter={() => {
                if (!selectedContract) return;
                if (tab.id === "cibles") {
                  preload(`/api/heating-seasons?contractId=${selectedContract.id}`, fetcher);
                } else if (tab.id === "revision") {
                  preload(`/api/contracts/${selectedContract.id}/revision-indices`, fetcher);
                  preload(`/api/contracts/${selectedContract.id}/revision-timeline`, fetcher);
                } else if (tab.id === "montants") {
                  preload(`/api/contracts/${selectedContract.id}/amounts-timeline`, fetcher);
                } else if (tab.id === "facturation") {
                  preload(`/api/contracts/${selectedContract.id}/billing-lines`, fetcher);
                  preload(`/api/contracts/${selectedContract.id}/billing-schedule`, fetcher);
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

          {/* Facturation Tab */}
          {activeTab === "facturation" && selectedContract && (
            <ContractBillingTab key={selectedContract.id} contractId={selectedContract.id} />
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
