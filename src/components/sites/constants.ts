import {
  Flame,
  Zap,
  Droplets,
  Thermometer,
} from "lucide-react";
import type { MeterType, MeterFluid, MeterDataSource } from "./types";

export const siteTypeLabels: Record<string, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

export const energyTypeLabels: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  AUTRE: "Autre",
};

export const meterTypeLabels: Record<MeterType, string> = {
  PRINCIPAL: "Principal (Distributeur)",
  DIVISIONNAIRE: "Divisionnaire (Sous-compteur)",
};

export const meterFluidLabels: Record<MeterFluid, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "Eau chaude (ECS)",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

export const meterFluidIcons: Record<MeterFluid, typeof Flame> = {
  GAZ: Flame,
  ELECTRICITE: Zap,
  EAU_CHAUDE: Droplets,
  EAU_FROIDE: Droplets,
  CHALEUR: Thermometer,
  FIOUL: Droplets,
};

export const meterFluidColors: Record<MeterFluid, { bg: string; border: string; text: string; icon: string }> = {
  GAZ: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", icon: "text-amber-500" },
  ELECTRICITE: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", icon: "text-yellow-500" },
  EAU_CHAUDE: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", icon: "text-red-500" },
  EAU_FROIDE: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", icon: "text-blue-500" },
  CHALEUR: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", icon: "text-orange-500" },
  FIOUL: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: "text-purple-500" },
};

export const dataSourceLabels: Record<MeterDataSource, string> = {
  API: "Télérelevé (API)",
  MANUEL: "Relevé manuel",
};

export const unitOptions = [
  { value: "m3", label: "m³" },
  { value: "kWh", label: "kWh" },
  { value: "MWh", label: "MWh" },
  { value: "L", label: "Litres" },
];
