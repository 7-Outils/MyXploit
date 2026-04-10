export interface ContractSite {
  id: string;
  site: {
    id: string;
    name: string;
  };
}

export type SiteType = "LYCEE" | "COLLEGE" | "ECOLE" | "MAIRIE" | "HOPITAL" | "GYMNASE" | "PISCINE" | "MEDIATHEQUE" | "AUTRE";
export type EnergyType = "GAZ" | "ELECTRICITE" | "FIOUL" | "BOIS" | "RESEAU_CHALEUR" | "AUTRE";

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  address: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  energyType: EnergyType;
  contractSites: Array<{
    contract: { reference: string };
  }>;
}

export interface Contract {
  id: string;
  title: string;
  provider: string;
  endDate: string;
  status: string;
  contractSites: ContractSite[];
}

export interface Invoice {
  id: string;
  reference: string;
  amount: number;
  status: string;
  contract: { provider: string } | null;
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  type: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  site: { id: string; name: string } | null;
  createdAt: string;
  isRead: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: string;
  site: { name: string };
}

export interface Quote {
  id: string;
  reference: string;
  title: string;
  amountHT: number;
  status: string;
}

export interface ExpiringContract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  endDate: string;
  daysUntilExpiry: number;
  urgency: "EXPIRED" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  siteCount: number;
}

export interface MissionStats {
  activeMissions: {
    total: number;
    byType: Array<{ type: string; count: number }>;
  };
  ca: { active: number; terminated: number; pipeline: number };
  deliverablesThisMonth: {
    total: number;
    aFaire: number;
    enCours: number;
    produit: number;
    transmis: number;
  };
  overdueDeliverables: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
    mission: { id: string; title: string; reference: string; client: { name: string } };
  }>;
  expiringMissions: Array<{
    id: string;
    reference: string;
    title: string;
    endDate: string;
    client: { name: string };
    missionType: { name: string };
  }>;
  pipeline: {
    missions: Array<{
      id: string;
      reference: string;
      title: string;
      amountHT: number | null;
      client: { name: string };
      missionType: { name: string };
    }>;
    totalAmount: number;
  };
  engineerWorkload: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    activeMissions: number;
    pendingDeliverables: number;
  }>;
}

export interface CurrentUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

export interface WorkloadEntry {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  contractCount: number;
  siteCount: number;
  upcomingMeetings: number;
  activeAlerts: number;
}

import type { LucideIcon } from "lucide-react";

export interface RecentActivity {
  id: string;
  type: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}

export interface SiteChartData {
  byType: Array<{ label: string; value: number; color: string }>;
  byEnergy: Array<{ label: string; value: number; color: string }>;
}
