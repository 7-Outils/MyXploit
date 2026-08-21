export interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  amountP21: number | null;
  amountP22: number | null;
  amountP23: number | null;
  amountP24: number | null;
  amountP25: number | null;
  amountP26: number | null;
  amountP31: number | null;
  amountP32: number | null;
  amountP33: number | null;
  amountP34: number | null;
  amountP35: number | null;
  amountP36: number | null;
  coefficientPCS: number | null;
  coefficientQ: number | null;
  p1Peg0: number | null;
  p1Ticgn0: number | null;
  p1Tvd0: number | null;
  p1Cee0: number | null;
  p1P0Unit: number | null;
  p1TvdTarif: string | null;
  integrationDate: string | null;
  exitDate: string | null;
  site: {
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
    pce: string | null;
    pdl: string | null;
    djuContractuel: number | null;
  };
}

export interface AvenantItem {
  id: string;
  type: string;
  effectiveDate: string;
  description: string | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  newAmountP1: number | null;
  newAmountP2: number | null;
  newAmountP3: number | null;
  contractSite: {
    id: string;
    site: { id: string; name: string; type: string };
  } | null;
  equipment: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface Avenant {
  id: string;
  reference: string;
  signatureDate: string | null;
  description: string | null;
  items: AvenantItem[];
  _totals: {
    deltaP1: number;
    deltaP2: number;
    deltaP3: number;
    total: number;
  };
}

export interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  providerEmail: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  yearType: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  yearStartMonth: number;
  yearStartDay: number;
  billingFrequency: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  djuContractuel: number | null;
  contractSites: ContractSite[];
  avenants: Avenant[];
  _count?: { contractSites: number };
}

export type YearType = "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
export type BillingFrequency = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
