"use client";

import {
  AlertTriangle,
  Building2,
  Calendar,
  Receipt,
  Wrench,
  ClipboardCheck,
  Target,
  Euro,
  FolderKanban,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { MissionStats, CurrentUser } from "./types";

interface StatsCardsProps {
  currentUser: CurrentUser | null;
  missionStats: MissionStats | null;
  profile: "CLIENT" | "AMO" | "EXPLOITANT" | null;
  operationalEquipments: number;
  equipmentInMaintenance: number;
  pendingQuotes: number;
  acceptedQuotes: number;
  uniqueSitesCount: number;
  activeContracts: number;
  activeAlerts: number;
  criticalAlerts: number;
  upcomingMeetings: number;
  pendingInvoices: number;
  totalPendingAmount: number;
}

export function StatsCards({
  currentUser,
  missionStats,
  profile,
  operationalEquipments,
  equipmentInMaintenance,
  pendingQuotes,
  acceptedQuotes,
  uniqueSitesCount,
  activeContracts,
  activeAlerts,
  criticalAlerts,
  upcomingMeetings,
  pendingInvoices,
  totalPendingAmount,
}: StatsCardsProps) {
  // ADMIN sees mission-centric stats
  if ((currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN") && missionStats) {
    const overdueCount = missionStats.overdueDeliverables?.length || 0;
    return (
      <>
        <StatsCard
          title="Missions actives"
          value={missionStats.activeMissions.total.toString()}
          change={missionStats.pipeline.missions.length > 0 ? `${missionStats.pipeline.missions.length} en pipeline` : undefined}
          changeType="neutral"
          icon={FolderKanban}
        />
        <StatsCard
          title="CA en cours"
          value={`${(missionStats.ca.active / 1000).toFixed(0)}k€`}
          change={missionStats.ca.terminated > 0 ? `${(missionStats.ca.terminated / 1000).toFixed(0)}k€ termine` : undefined}
          changeType="positive"
          icon={Euro}
        />
        <StatsCard
          title="Livrables ce mois"
          value={missionStats.deliverablesThisMonth.total.toString()}
          change={`${missionStats.deliverablesThisMonth.produit + missionStats.deliverablesThisMonth.transmis} produits`}
          changeType="positive"
          icon={ClipboardCheck}
        />
        <StatsCard
          title="En retard"
          value={overdueCount.toString()}
          change={overdueCount > 0 ? "A traiter" : "Tout est a jour"}
          changeType={overdueCount > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
      </>
    );
  }

  if (profile === "EXPLOITANT") {
    return (
      <>
        <StatsCard
          title="Équipements actifs"
          value={operationalEquipments.toString()}
          icon={Wrench}
        />
        <StatsCard
          title="En maintenance/panne"
          value={equipmentInMaintenance.toString()}
          change={equipmentInMaintenance > 0 ? "À traiter" : "Tout OK"}
          changeType={equipmentInMaintenance > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
        <StatsCard
          title="Devis en cours"
          value={pendingQuotes.toString()}
          change={`${acceptedQuotes} acceptés`}
          changeType="positive"
          icon={Receipt}
        />
        <StatsCard
          title="Sites gérés"
          value={uniqueSitesCount.toString()}
          icon={Building2}
        />
      </>
    );
  } else if (profile === "AMO") {
    return (
      <>
        <StatsCard
          title="Contrats pilotés"
          value={activeContracts.toString()}
          icon={ClipboardCheck}
        />
        <StatsCard
          title="Sites sous contrat"
          value={uniqueSitesCount.toString()}
          icon={Building2}
        />
        <StatsCard
          title="Alertes dérives"
          value={activeAlerts.toString()}
          change={criticalAlerts > 0 ? `${criticalAlerts} critiques` : "RAS"}
          changeType={criticalAlerts > 0 ? "negative" : "positive"}
          icon={Target}
        />
        <StatsCard
          title="Réunions à venir"
          value={upcomingMeetings.toString()}
          icon={Calendar}
        />
      </>
    );
  } else {
    // CLIENT (default)
    return (
      <>
        <StatsCard
          title="Alertes actives"
          value={activeAlerts.toString()}
          change={criticalAlerts > 0 ? `${criticalAlerts} critiques` : "Aucune critique"}
          changeType={criticalAlerts > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
        />
        <StatsCard
          title="Factures en attente"
          value={pendingInvoices.toString()}
          change={totalPendingAmount > 0 ? `${(totalPendingAmount / 1000).toFixed(0)}k€ à valider` : undefined}
          changeType="neutral"
          icon={Euro}
        />
        <StatsCard
          title="Réunions à venir"
          value={upcomingMeetings.toString()}
          icon={Calendar}
        />
        <StatsCard
          title="Équipements en panne"
          value={equipmentInMaintenance.toString()}
          change={equipmentInMaintenance > 0 ? "À traiter" : "Tout OK"}
          changeType={equipmentInMaintenance > 0 ? "negative" : "positive"}
          icon={Wrench}
        />
      </>
    );
  }
}
