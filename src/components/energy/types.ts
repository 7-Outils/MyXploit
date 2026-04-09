/**
 * Shared types for the Énergie module — page tabs, modals and components.
 *
 * Extracted from the previous monolithic src/app/(dashboard)/energy/page.tsx
 * (~3400 lines) to make individual files load faster, easier to grep, and
 * cheaper to keep in context during edits.
 */

export interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: {
    contractSites: number;
  };
}

export interface Site {
  id: string;
  name: string;
  type: string;
  nb: number | null;
  djuContractuel: number | null;
}

export interface MonthlyData {
  month: string;
  label: string;
  nc: number;
  nbPrime: number;
  djr: number;
  ecs: number;
}

export interface SitePerformance {
  siteId: string;
  siteName: string;
  siteType: string;
  city: string;
  energyType: string;
  nb: number | null;
  nbUnit: string | null;
  djuContractuel: number | null;
  stationMeteo: string | null;
  nc: number;
  nbPrime: number;
  djrTotal: number;
  ecsTotal: number;
  mixteTotal: number;
  delta: number;
  deltaPercent: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
  monthlyData: { month: string; nc: number; nbPrime: number; djr: number; ecs: number }[];
  _debug?: {
    heatingSeasonNb: number | null;
    heatingSeasonDjuc: number | null;
    siteDjuc: number | null;
    usedDjuc: number | null;
    djrTotal: number;
    nbKwh: number;
    calculationApplied: boolean;
  };
}

export interface AnalyticsData {
  year: number;
  period: { start: string; end: string };
  summary: {
    totalSites: number;
    totalNc: number;
    totalNbPrime: number;
    totalDelta: number;
    deltaPercent: number;
    status: string;
    sitesEnEconomie: number;
    sitesEnDepassement: number;
    sitesObjectifAtteint: number;
  };
  monthlyData: MonthlyData[];
  performanceByType: { type: string; nc: number; nbPrime: number; count: number; deltaPercent: number }[];
  sites: SitePerformance[];
}

export interface Alert {
  id: string;
  type: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  title: string;
  message: string;
  site: { id: string; name: string } | null;
  createdAt: string;
  isRead: boolean;
}

export interface DJUData {
  year: number;
  period: { start: string; end: string };
  summary: {
    djuReelMoyen: number;
    djuTrentenaireMoyen: number;
    djuTrentenaireToDate: number;
    ecart: number;
    ecartPercent: number;
    interpretation: string;
  };
  monthlyData: { month: string; label: string; dju: number }[];
  sites: {
    siteId: string;
    siteName: string;
    city: string;
    postalCode: string;
    station: string;
    stationCode: string;
    djuTrentenaire: number;
    djuReel: number;
    djuTrentenaireToDate: number;
    ecartTrentenaire: number;
    ecartPercent: number;
    heatingStartDate: string;
    heatingEndDate: string;
    hasHeatingSeason: boolean;
    monthlyData: { month: string; dju: number; avgTemp: number }[];
  }[];
}

export interface HeatingSeason {
  id: string;
  siteId: string;
  season: string;
  startDate: string;
  endDate: string | null;
  startIndex: number | null;
  endIndex: number | null;
  notes: string | null;
  nb: number | null;
  nbUnit: "PCS" | "UTILE" | null;
  djuContractuel: number | null;
  site?: { id: string; name: string; city: string };
}

export interface Consumption {
  id: string;
  energyType: string;
  usage: string;
  quantity: number;
  unit: string;
  period: string;
  djuReel: number | null;
  cost: number | null;
  site: { id: string; name: string };
}

export type EnergyTab =
  | "synthese"
  | "sites"
  | "p1"
  | "climat"
  | "ecs"
  | "telereleve";
