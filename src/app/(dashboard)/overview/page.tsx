"use client";

import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useContract } from "@/contexts/ContractContext";
import InsightHero from "@/components/overview/InsightHero";
import WorkOrdersToClose from "@/components/overview/WorkOrdersToClose";
import UpcomingMeetings from "@/components/overview/UpcomingMeetings";

export default function OverviewPage() {
  const { isLoading: profileLoading } = useUserProfile();
  const { selectedContract } = useContract();

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="flex items-center justify-center py-20 text-ink/50">
        <p className="text-sm">Sélectionnez un contrat pour voir les KPI.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8">
        <InsightHero
          contractId={selectedContract.id}
          yearType={selectedContract.yearType ?? "HEATING_SEASON"}
        />
      </div>
      <aside className="lg:col-span-4 flex flex-col gap-3">
        <WorkOrdersToClose contractId={selectedContract.id} />
        <UpcomingMeetings contractId={selectedContract.id} />
      </aside>
    </div>
  );
}
