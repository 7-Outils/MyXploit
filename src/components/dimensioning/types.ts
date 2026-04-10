export interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  type: string;
}

export interface DimensioningResult {
  params: {
    contractId: string | null;
    siteIds: string[] | null;
    duration: number;
    startYear: number;
  };
  summary: {
    equipmentCount: number;
    siteCount: number;
    totalP2Annual: number;
    totalP3GEAnnual: number;
    totalP3RAnnual: number;
    totalP3Annual: number;
    totalAnnual: number;
    totalHoursP2: number;
    totalP2Contract: number;
    totalP3GEContract: number;
    totalP3RContract: number;
    totalP3Contract: number;
    totalContract: number;
    renewalsCount: number;
    mandatoryWorksCount: number;
    totalRenewalCost: number;
    totalMandatoryWorksCost: number;
  };
  bySite: Array<{
    siteId: string;
    siteName: string;
    equipmentCount: number;
    p2Annual: number;
    p3GEAnnual: number;
    p3RAnnual: number;
    hoursP2: number;
    renewalsCount: number;
  }>;
  renewals: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    renewalNeeded: boolean;
    urgency: string;
    renewalYear?: number;
    annualProvision: number;
    notes: string[];
  }>;
  mandatoryWorks: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    urgency: string;
    renewalYear?: number;
    notes: string[];
  }>;
}
