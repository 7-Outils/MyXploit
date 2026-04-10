import {
  FileText,
  Receipt,
  BarChart3,
  Calendar,
  Wrench,
  Bell,
  Target,
  Building2,
} from "lucide-react";
import type { SiteType, EnergyType } from "./types";

export const siteTypeLabels: Record<SiteType, string> = {
  LYCEE: "Lycée", COLLEGE: "Collège", ECOLE: "École", MAIRIE: "Mairie",
  HOPITAL: "Hôpital", GYMNASE: "Gymnase", PISCINE: "Piscine", MEDIATHEQUE: "Médiathèque", AUTRE: "Autre",
};

export const energyTypeLabels: Record<EnergyType, string> = {
  GAZ: "Gaz", ELECTRICITE: "Électricité", FIOUL: "Fioul", BOIS: "Bois", RESEAU_CHALEUR: "Réseau de chaleur", AUTRE: "Autre",
};

export const consumptionData = [
  { label: "Jan", value: 850, target: 900 },
  { label: "Fév", value: 920, target: 880 },
  { label: "Mar", value: 780, target: 800 },
  { label: "Avr", value: 650, target: 700 },
  { label: "Mai", value: 520, target: 550 },
  { label: "Jun", value: 480, target: 500 },
  { label: "Jul", value: 420, target: 450 },
  { label: "Aoû", value: 410, target: 440 },
  { label: "Sep", value: 550, target: 580 },
  { label: "Oct", value: 720, target: 750 },
  { label: "Nov", value: 880, target: 850 },
  { label: "Déc", value: 950, target: 920 },
];

// Profile-specific welcome messages
export const WELCOME_MESSAGES = {
  CLIENT: "Voici le résumé de votre patrimoine et vos contrats.",
  AMO: "Voici le tableau de bord de pilotage de vos marchés.",
  EXPLOITANT: "Voici le résumé de vos interventions et équipements.",
};

// Profile-specific quick actions
export const QUICK_ACTIONS = {
  CLIENT: [
    { href: "/contracts", icon: FileText, label: "Voir contrats" },
    { href: "/invoices", icon: Receipt, label: "Factures" },
    { href: "/energy", icon: BarChart3, label: "Performance" },
    { href: "/meetings", icon: Calendar, label: "Réunions" },
  ],
  AMO: [
    { href: "/energy", icon: Target, label: "Performance NC/N'B" },
    { href: "/contracts", icon: FileText, label: "Auditer contrats" },
    { href: "/sites", icon: Building2, label: "Patrimoine" },
    { href: "/meetings", icon: Calendar, label: "Planifier visite" },
  ],
  EXPLOITANT: [
    { href: "/renewals", icon: Bell, label: "Renouvellements" },
    { href: "/equipments", icon: Wrench, label: "Équipements" },
    { href: "/quotes", icon: Receipt, label: "Mes devis" },
    { href: "/pricing", icon: FileText, label: "Chiffrage AO" },
  ],
};
