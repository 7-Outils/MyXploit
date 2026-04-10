export type MeterType = "PRINCIPAL" | "DIVISIONNAIRE";
export type MeterFluid = "GAZ" | "ELECTRICITE" | "EAU_CHAUDE" | "EAU_FROIDE" | "CHALEUR" | "FIOUL";
export type MeterDataSource = "API" | "MANUEL";

export interface MeterReading {
  id: string;
  readingDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  indexValue: number | null;
  consumption: number | null;
  unit: string;
  consumptionConverted: number | null;
  unitConverted: string | null;
  source: MeterDataSource;
  isValidated: boolean;
  notes: string | null;
}

export interface Meter {
  id: string;
  name: string;
  reference: string | null;
  type: MeterType;
  fluid: MeterFluid;
  dataSource: MeterDataSource;
  unit: string;
  parentId: string | null;
  isDeductedFromParent: boolean;
  conversionCoefficient: number | null;
  conversionUnit: string | null;
  isActive: boolean;
  children?: Meter[];
  readings?: MeterReading[];
  _count?: {
    readings: number;
  };
}

export interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  surfaceChauffee: number | null;
  energyType: string;
  pce: string | null;
  pdl: string | null;
  meters?: Meter[];
  contractSites?: {
    id: string;
    contractType: string;
    hasP1: boolean;
    hasP2: boolean;
    hasP3: boolean;
    contract: {
      id: string;
      reference: string;
      title: string;
    };
  }[];
}
