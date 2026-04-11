"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2, Settings, Target } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { CiblesContent } from "@/components/contrat/tabs/CiblesTab";
import { ParamsContent } from "@/components/contrat/tabs/ParamsTab";
import type { Site } from "@/components/energy/types";

type ContratTab = "cibles" | "params";

function ContratPageContent() {
  const { selectedContract, isLoading } = useContract();
  const [activeTab, setActiveTab] = useState<ContratTab>("cibles");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [contractDetail, setContractDetail] = useState<{ djuContractuel: number | null } | null>(null);

  const fetchSites = useCallback(async () => {
    if (!selectedContract) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${selectedContract.id}/sites`);
      const data = await res.json();
      setSites(Array.isArray(data) ? data : []);
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [selectedContract]);

  const fetchContractDetail = useCallback(async () => {
    if (!selectedContract) return;
    try {
      const res = await fetch(`/api/contracts/${selectedContract.id}`);
      if (res.ok) {
        const data = await res.json();
        setContractDetail({ djuContractuel: data.djuContractuel ?? null });
      }
    } catch {
      setContractDetail(null);
    }
  }, [selectedContract]);

  useEffect(() => { fetchSites(); fetchContractDetail(); }, [fetchSites, fetchContractDetail]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <p className="text-text-secondary">
        Sélectionnez un contrat dans la barre supérieure.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: "cibles" as ContratTab, label: "Cibles énergétiques", icon: Target },
            { id: "params" as ContratTab, label: "Paramètres", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {activeTab === "cibles" && (
            <CiblesContent
              contract={selectedContract}
              selectedYear={new Date().getFullYear()}
              sites={sites}
              onNbUpdate={fetchSites}
            />
          )}
          {activeTab === "params" && (
            <ParamsContent
              contractId={selectedContract.id}
              djuContractuel={contractDetail?.djuContractuel ?? null}
              onUpdated={fetchContractDetail}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function ContratPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <ContratPageContent />
    </Suspense>
  );
}
