/**
 * Familles de bâtiments pour le signal allumage/arrêt : un type de site
 * (enum Prisma SiteType) → un profil → des seuils météo. Valeurs d'usage
 * exploitant, sans norme derrière : à ajuster si le marché fixe autre chose.
 */
import { DEFAULT_THRESHOLDS, type HeatingThresholds } from "@/lib/heating-season";

export type HeatingProfile = "SENSIBLE" | "STANDARD" | "SPORTIF" | "HORS_SIGNAL";

export const HEATING_PROFILE_LABELS: Record<HeatingProfile, string> = {
  SENSIBLE: "Petite enfance et santé",
  STANDARD: "Enseignement et administratif",
  SPORTIF: "Sport",
  HORS_SIGNAL: "Chauffé toute l'année",
};

export const HEATING_PROFILE_THRESHOLDS: Record<Exclude<HeatingProfile, "HORS_SIGNAL">, HeatingThresholds> = {
  // Publics fragiles (crèche, hôpital, EHPAD) : on allume deux degrés plus tôt,
  // on arrête plus tard.
  SENSIBLE: { start: 16, startForecastMax: 17, stop: 18, stopForecastMin: 15 },
  STANDARD: DEFAULT_THRESHOLDS,
  // Gymnase : activité physique, grand volume, consigne basse → on attend.
  SPORTIF: { start: 12, startForecastMax: 13, stop: 14, stopForecastMin: 11 },
};

// Mappé sur les valeurs de l'enum Prisma SiteType (typé en string pour ne pas
// dépendre du client généré côté navigateur).
const PROFILE_BY_TYPE: Record<string, HeatingProfile> = {
  CRECHE: "SENSIBLE",
  HOPITAL: "SENSIBLE",
  EHPAD: "SENSIBLE",
  ECOLE: "STANDARD",
  COLLEGE: "STANDARD",
  LYCEE: "STANDARD",
  MAIRIE: "STANDARD",
  MEDIATHEQUE: "STANDARD",
  AUTRE: "STANDARD",
  GYMNASE: "SPORTIF",
  PISCINE: "HORS_SIGNAL",
};

export function heatingProfileOf(siteType: string): HeatingProfile {
  return PROFILE_BY_TYPE[siteType] ?? "STANDARD";
}

/** Types soumis au calendrier scolaire (allumage calé sur la rentrée). */
export const SCHOOL_TYPES = new Set(["ECOLE", "COLLEGE", "LYCEE"]);

export const PROFILE_ORDER: HeatingProfile[] = ["SENSIBLE", "STANDARD", "SPORTIF", "HORS_SIGNAL"];
