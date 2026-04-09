/**
 * Shared label maps for the Énergie module.
 *
 * Extracted from the previous monolithic src/app/(dashboard)/energy/page.tsx
 * to make these constants importable from the per-tab files without dragging
 * the whole 3400-line file into context.
 */

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

export const ENERGY_TYPE_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "RCU",
  EAU: "Eau",
  AUTRE: "Autre",
};

export const USAGE_LABELS: Record<string, string> = {
  CHAUFFAGE: "Chauffage",
  ECS: "ECS",
  MIXTE: "Mixte",
  AUTRE: "Autre",
};
