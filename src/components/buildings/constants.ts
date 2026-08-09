import {
  Building2,
  Flame,
  Zap,
  Droplets,
  Thermometer,
  TreePine,
  Gauge,
  Calendar,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import type { TabKey } from "./types";

export const SITE_TYPE_LABELS: Record<string, string> = {
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

export const ENERGY_CONFIG: Record<
  string,
  { label: string; icon: typeof Flame; color: string }
> = {
  GAZ: { label: "Gaz", icon: Flame, color: "text-orange-500" },
  ELECTRICITE: { label: "Électricité", icon: Zap, color: "text-yellow-500" },
  FIOUL: { label: "Fioul", icon: Droplets, color: "text-gray-600" },
  BOIS: { label: "Bois", icon: TreePine, color: "text-green-600" },
  RESEAU_CHALEUR: { label: "Réseau de chaleur", icon: Thermometer, color: "text-red-500" },
  EAU: { label: "Eau", icon: Droplets, color: "text-blue-500" },
  AUTRE: { label: "Autre", icon: Flame, color: "text-gray-400" },
};

export const INSULATION_LABELS: Record<string, string> = {
  AUCUNE: "Aucune isolation",
  PARTIELLE: "Isolation partielle",
  RT1974: "RT 1974",
  RT1988: "RT 1988",
  RT2000: "RT 2000",
  RT2005: "RT 2005",
  RT2012: "RT 2012",
  RE2020: "RE 2020",
};

export const GLAZING_LABELS: Record<string, string> = {
  SIMPLE: "Simple vitrage",
  DOUBLE: "Double vitrage",
  DOUBLE_FE: "Double vitrage FE",
  TRIPLE: "Triple vitrage",
};

export const VENTILATION_LABELS: Record<string, string> = {
  NATURELLE: "Ventilation naturelle",
  SIMPLE_FLUX: "Simple flux",
  HYGRO_B: "Hygro B",
  DOUBLE_FLUX: "Double flux",
};

export const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: "general", label: "Général", icon: Building2 },
  { key: "energy", label: "Énergie", icon: BarChart3 },
  { key: "thermal", label: "Profil thermique", icon: Thermometer },
  { key: "zones", label: "Zones", icon: Calendar },
  { key: "meters", label: "Compteurs", icon: Gauge },
  { key: "journal", label: "Journal", icon: ClipboardList },
];

export const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#3b82f6",
  FIOUL: "#78716c",
  BOIS: "#84cc16",
  RESEAU_CHALEUR: "#ef4444",
  EAU: "#06b6d4",
  AUTRE: "#9ca3af",
};

export const ENERGY_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  EAU: "Eau",
  AUTRE: "Autre",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  PANNE_CHAUFFAGE: "Panne chauffage",
  PANNE_ECS: "Panne ECS",
  PANNE_VENTILATION: "Panne ventilation",
  FUITE: "Fuite",
  DYSFONCTIONNEMENT: "Dysfonctionnement",
  COUPURE: "Coupure énergie",
  PLAINTE_USAGER: "Plainte usager",
  INTERVENTION: "Intervention",
  INCIDENT: "Incident",
  ASSIGNATION: "Assignation",
  NOTE: "Note",
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  PANNE_CHAUFFAGE: "bg-red-50 text-red-700 border border-red-600/20",
  PANNE_ECS: "bg-red-50 text-red-700 border border-red-600/20",
  PANNE_VENTILATION: "bg-red-50 text-red-700 border border-red-600/20",
  FUITE: "bg-orange-50 text-orange-700 border border-orange-600/20",
  DYSFONCTIONNEMENT: "bg-amber-50 text-amber-700 border border-amber-600/20",
  COUPURE: "bg-red-50 text-red-700 border border-red-600/20",
  PLAINTE_USAGER: "bg-amber-50 text-amber-700 border border-amber-600/20",
  INTERVENTION: "bg-accent/5 text-accent border border-accent/20",
  INCIDENT: "bg-orange-50 text-orange-700 border border-orange-600/20",
  ASSIGNATION: "bg-white text-ink/60 border border-ink/15",
  NOTE: "bg-white text-ink/60 border border-ink/15",
};
