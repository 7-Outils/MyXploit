/**
 * Types et fonctions utilitaires pour les audits techniques
 * Les checklists sont maintenant configurées via le panneau admin
 */

export type ChecklistItemResult = "CONFORME" | "NON_CONFORME" | "NA" | "NON_VERIFIE";

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  description?: string;
}

export interface TechnicalChecklist {
  types: string[];
  domain: string;
  name: string;
  items: ChecklistItem[];
}

// Labels des catégories pour l'affichage (fallback si non défini en BDD)
export const CATEGORY_LABELS: Record<string, string> = {
  DOSSIER_TECHNIQUE: "Dossier technique",
  CONFORMITE_REGLEMENTAIRE: "Conformité réglementaire",
  CONSIGNES: "Consignes d'exploitation",
  COMBUSTION: "Combustion",
  SECURITE: "Sécurité",
  EVACUATION: "Évacuation",
  HYDRAULIQUE: "Hydraulique",
  REGLEMENTAIRE: "Réglementaire",
  FLUIDE: "Fluide frigorigène",
  ECHANGEUR: "Échangeur",
  VENTILATION: "Ventilation",
  FILTRATION: "Filtration",
  ELECTRIQUE: "Électrique",
  AMONT: "En amont",
  AVAL: "En aval",
  INSTALLATION: "Installation",
  PRECAUTION: "Précautions",
  TEMPERATURE: "Température",
  LEGIONELLE: "Légionelle",
  ANODE: "Anode",
  ISOLATION: "Isolation",
  REGLAGE: "Réglage",
  VENTILATEUR: "Ventilateur",
  BATTERIE: "Batterie",
  REGISTRES: "Registres",
  HUMIDIFICATEUR: "Humidificateur",
  HYGIENE: "Hygiène",
  GAINES: "Gaines",
  BOUCHES: "Bouches",
  BYPASS: "Bypass",
  COURROIE: "Courroie",
  COMPRESSEUR: "Compresseur",
  CONDENSEUR: "Condenseur",
  EVAPORATEUR: "Évaporateur",
  PRESSOSTAT: "Pressostat",
  FILTRES: "Filtres",
  TELECOMMANDE: "Télécommande",
  FIXATION: "Fixation",
  RESERVOIR: "Réservoir",
  POMPE: "Pompe",
  FLOTTEUR: "Flotteur",
  ALARME: "Alarme",
  BACHE: "Bâche",
  SEL: "Sel",
  RESINE: "Résine",
  REGENERATION: "Régénération",
  DURETE: "Dureté",
  COMPTEUR: "Compteur",
  TEST: "Test",
  VISUEL: "Visuel",
  SERRAGE: "Serrage",
  THERMIQUE: "Thermique",
  PROTECTION: "Protection",
  TERRE: "Terre",
  BATTERIE_ELEC: "Batterie",
  AUTONOMIE: "Autonomie",
  ALARMES: "Alarmes",
  AFFICHAGE: "Affichage",
  COMMUNICATION: "Communication",
  ETALONNAGE: "Étalonnage",
  SONDES: "Sondes",
  PRESSION: "Pression",
  MANOMETRE: "Manomètre",
  CONTRELAVAGE: "Contre-lavage",
  MEDIA: "Média filtrant",
  AMORCAGE: "Amorçage",
  PANIER: "Panier",
  INTENSITE: "Intensité",
  GARNITURE: "Garniture",
  CONSOMMATION: "Consommation",
  DOSAGE: "Dosage",
  SONDE: "Sonde",
  CELLULE: "Cellule",
  PRESSION_GONFLAGE: "Pression",
  ETAT: "État",
  DIMENSIONNEMENT: "Dimensionnement",
  ETANCHEITE: "Étanchéité",
};

/**
 * Type pour les résultats d'un item de checklist sauvegardé
 */
export interface SavedChecklistItem {
  equipmentType: string;
  itemId: string;
  label: string;
  category: string;
  result: ChecklistItemResult;
  notes?: string;
}

/**
 * Calcule le résultat global d'un audit technique
 */
export function calculateGlobalResult(
  items: SavedChecklistItem[]
): "CONFORME" | "NON_CONFORME" | "PARTIEL" | "NON_VERIFIE" {
  const evaluated = items.filter((item) => item.result !== "NON_VERIFIE" && item.result !== "NA");

  if (evaluated.length === 0) {
    return "NON_VERIFIE";
  }

  const nonConforme = evaluated.filter((item) => item.result === "NON_CONFORME");
  const conforme = evaluated.filter((item) => item.result === "CONFORME");

  if (nonConforme.length === 0) {
    return "CONFORME";
  }

  if (conforme.length === 0) {
    return "NON_CONFORME";
  }

  return "PARTIEL";
}
