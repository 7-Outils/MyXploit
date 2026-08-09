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

// Thème « bureau d'études » : le cadre reste neutre (papier + hairline encre),
// seule l'icône garde la teinte du fluide — repère métier, jamais décoratif.
export const meterFluidColors: Record<MeterFluid, { bg: string; border: string; text: string; icon: string }> = {
  GAZ: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-amber-600" },
  ELECTRICITE: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-yellow-600" },
  EAU_CHAUDE: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-red-600" },
  EAU_FROIDE: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-accent" },
  CHALEUR: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-orange-600" },
  FIOUL: { bg: "bg-white", border: "border-ink/15", text: "text-ink", icon: "text-ink/50" },
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
