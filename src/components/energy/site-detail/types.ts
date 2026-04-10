/**
 * Types specific to the site detail/energy page.
 * Separate from src/components/energy/types.ts which covers the main energy module.
 */

export interface SiteDetailData {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  surfaceChauffee: number | null;
  energyType: string;
  nb: number | null;
  nbUnit: string | null;
  djuContractuel: number | null;
  stationMeteo: string | null;
  pce: string | null;
  pdl: string | null;
  contractSites: Array<{
    contract: {
      id: string;
      reference: string;
      title: string;
    };
  }>;
  consumptions: Array<{
    id: string;
    period: string;
    quantity: number;
    energyType: string;
    usage: string;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

export interface SiteAnalyticsData {
  year: number;
  period: { start: string; end: string };
  summary: {
    totalNc: number;
    totalNbPrime: number;
    totalDelta: number;
    deltaPercent: number;
    status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
  };
  monthlyData: Array<{
    month: string;
    label: string;
    nc: number;
    nbPrime: number;
    djr: number;
    ecs: number;
  }>;
  sites: Array<{
    siteId: string;
    siteName: string;
    nc: number;
    nbPrime: number;
    delta: number;
    deltaPercent: number;
    status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
    monthlyData: Array<{
      month: string;
      nc: number;
      nbPrime: number;
      djr: number;
      ecs: number;
    }>;
  }>;
}

export interface SiteDJUData {
  year: number;
  period: { start: string; end: string };
  sites: Array<{
    siteId: string;
    siteName: string;
    station: string;
    djuReel: number;
    djuTrentenaire: number;
    djuTrentenaireToDate: number;
    ecartPercent: number;
    heatingStartDate: string;
    heatingEndDate: string;
    hasHeatingSeason: boolean;
    monthlyData: Array<{
      month: string;
      dju: number;
      avgTemp: number;
    }>;
    dailyData: Array<{
      date: string;
      dju: number;
      tMoy: number;
    }>;
  }>;
}

export interface SiteHeatingSeason {
  id: string;
  season: string;
  startDate: string;
  endDate: string | null;
  startIndex: number | null;
  endIndex: number | null;
  notes: string | null;
}

export interface MultiSeasonData {
  season: string;
  nc: number;
  nbPrime: number;
  deltaPercent: number;
  djuReel: number;
  djuTrentenaire: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
}

export interface ActionItem {
  id: string;
  type: "warning" | "info" | "success" | "action";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
