import type { HeatingWeather, SiteHeatingStatus } from "@/lib/heating-season";
import type { ContractRecipient } from "@/lib/contract-recipients";

export type HeatingSwitchType = "ALLUMAGE" | "ARRET";

export interface HeatingSite {
  id: string;
  name: string;
  city: string;
  status: SiteHeatingStatus;
  period: {
    id: string;
    startDate: string;
    endDate: string | null;
    startProvisional: boolean;
    endProvisional: boolean;
  } | null;
}

export interface HeatingPendingRequest {
  id: string;
  type: HeatingSwitchType;
  requestedDate: string;
  sentAt: string;
  sentTo: { to: string[]; cc: string[]; siteIds: string[] };
  total: number;
  confirmed: number;
  pendingSiteIds: string[];
}

export interface HeatingStatusResponse {
  season: string;
  today: string;
  weather: HeatingWeather | null;
  sites: HeatingSite[];
  counts: { total: number; enChauffe: number; arrete: number; allumagePrevu: number; arretPrevu: number };
  pendingRequest: HeatingPendingRequest | null;
  recipients: ContractRecipient[];
}

export const fmtTemp = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} °C`;

export const fmtDay = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
