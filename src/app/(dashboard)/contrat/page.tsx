"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { P1Content } from "@/components/energy/tabs/P1Tab";
import type { Site } from "@/components/energy/types";

function ContratPageContent() {
  const { selectedContract, isLoading } = useContract();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => { fetchSites(); }, [fetchSites]);

  if (isLoading || loading) {
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
      <P1Content
        contract={selectedContract}
        selectedYear={new Date().getFullYear()}
        sites={sites}
        onNbUpdate={fetchSites}
      />
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
