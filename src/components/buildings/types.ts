export interface SiteDetail {
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
  rae: string | null;
  constructionYear: number | null;
  numberOfFloors: number | null;
  buildingHeight: number | null;
  volumeChauffee: number | null;
  insulationLevel: string | null;
  glazingType: string | null;
  ventilationType: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  contractSites: Array<{
    id: string;
    contractType: string;
    hasP1: boolean;
    hasP2: boolean;
    hasP3: boolean;
    contract: {
      id: string;
      reference: string;
      title: string;
      provider: string;
    };
  }>;
}

export interface ConsumptionRecord {
  id: string;
  energyType: string;
  usage: string;
  period: string;
  quantity: number;
  unit: string;
  cost: number | null;
  /**
   * Set when the record was imported from an exploitant Excel sheet
   * (IDEX, Engie, Dalkia…). Null when synced automatically from GRDF/Enedis.
   * The Energy tab on the building detail only shows exploitant data;
   * GRDF/Enedis raw data is shown in the Télérelève tab.
   */
  meterName: string | null;
}

export interface ActivityLog {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  activityDate: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export type TabKey = "general" | "energy" | "thermal" | "zones" | "meters" | "journal";
