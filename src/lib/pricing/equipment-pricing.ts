/**
 * Logique de tarification et dimensionnement des marchés CVC
 *
 * P1 = Combustible/Énergie (basé sur NB et prix énergie)
 * P2 = Petit entretien (maintenance préventive, heures technicien)
 * P3 = Gros entretien (GE) + Renouvellement (R)
 *   - P3 GE = Maintenance lourde annuelle (basée sur puissance et type)
 *   - P3 R = Renouvellement d'équipements sur la durée du marché
 */

import { EquipmentType, EquipmentDomain, AuditRating } from "@/generated/prisma/client";

// Taux horaire technicien (€/h)
export const HOURLY_RATES = {
  TECHNICIEN: 45,
  TECHNICIEN_SPECIALISE: 55,
  INGENIEUR: 75,
};

// Heures de maintenance P2 annuelles par type d'équipement
export const P2_HOURS_BY_TYPE: Record<string, { hours: number; frequency: number; level: keyof typeof HOURLY_RATES }> = {
  // === CHAUFFAGE ===
  CHAUDIERE: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" }, // 2 visites/an x 4h
  CHAUDIERE_CONDENSATION: { hours: 5, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  PAC: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  PAC_AIR_EAU: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  PAC_EAU_EAU: { hours: 5, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  PAC_AIR_AIR: { hours: 3, frequency: 2, level: "TECHNICIEN" },
  BRULEUR: { hours: 2, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  RADIATEUR: { hours: 0.25, frequency: 1, level: "TECHNICIEN" }, // 15 min par radiateur
  PLANCHER_CHAUFFANT: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  CONVECTEUR: { hours: 0.15, frequency: 1, level: "TECHNICIEN" },
  AEROTERME: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  RADIANT_GAZ: { hours: 2, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  VANNE_3_VOIES: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  VANNE_MOTORISEE: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  POMPE_CHAUFFAGE: { hours: 0.5, frequency: 2, level: "TECHNICIEN" },
  CIRCULATEUR: { hours: 0.5, frequency: 2, level: "TECHNICIEN" },
  VASE_EXPANSION: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  ECHANGEUR_THERMIQUE: { hours: 2, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  REGULATEUR: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  SONDE_TEMPERATURE: { hours: 0.25, frequency: 1, level: "TECHNICIEN" },
  SONDE_EXTERIEURE: { hours: 0.25, frequency: 1, level: "TECHNICIEN" },

  // === ECS ===
  BALLON_ECS: { hours: 2, frequency: 1, level: "TECHNICIEN" },
  BALLON_THERMODYNAMIQUE: { hours: 3, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  PREPARATEUR_ECS_GAZ: { hours: 3, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  ECHANGEUR_ECS: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  POMPE_BOUCLAGE: { hours: 0.5, frequency: 2, level: "TECHNICIEN" },
  MITIGEUR_THERMOSTATIQUE: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  RESISTANCE_ELECTRIQUE: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },

  // === VENTILATION ===
  VMC: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  VMC_SIMPLE_FLUX: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  VMC_DOUBLE_FLUX: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  CTA: { hours: 6, frequency: 4, level: "TECHNICIEN_SPECIALISE" }, // 4 visites/an
  CAISSON_EXTRACTION: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  CAISSON_SOUFFLAGE: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  VENTILATEUR: { hours: 0.5, frequency: 2, level: "TECHNICIEN" },
  REGISTRE: { hours: 0.25, frequency: 1, level: "TECHNICIEN" },
  BATTERIE_CHAUDE: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  BATTERIE_FROIDE: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  RECUPERATEUR_CHALEUR: { hours: 2, frequency: 2, level: "TECHNICIEN_SPECIALISE" },

  // === CLIMATISATION ===
  GROUPE_FROID: { hours: 6, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  CLIMATISATION: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  CLIMATISEUR: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  SPLIT: { hours: 1.5, frequency: 2, level: "TECHNICIEN" },
  MULTI_SPLIT: { hours: 3, frequency: 2, level: "TECHNICIEN" },
  CASSETTE: { hours: 1.5, frequency: 2, level: "TECHNICIEN" },
  GAINABLE: { hours: 2, frequency: 2, level: "TECHNICIEN" },
  ROOFTOP: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" },

  // === TRAITEMENT EAU ===
  ADOUCISSEUR: { hours: 2, frequency: 4, level: "TECHNICIEN" },
  DISCONNECTEUR: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  FILTRE: { hours: 0.5, frequency: 4, level: "TECHNICIEN" },
  POT_BOUE: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  DEGAZEUR: { hours: 0.5, frequency: 2, level: "TECHNICIEN" },
  DOSEUR: { hours: 1, frequency: 4, level: "TECHNICIEN" },

  // === COMPTAGE ===
  COMPTEUR_ENERGIE: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  COMPTEUR_CALORIES: { hours: 0.5, frequency: 1, level: "TECHNICIEN" },
  COMPTEUR_GAZ: { hours: 0.25, frequency: 1, level: "TECHNICIEN" },
  COMPTEUR_EAU: { hours: 0.25, frequency: 1, level: "TECHNICIEN" },

  // === PISCINE ===
  FILTRE_PISCINE: { hours: 2, frequency: 12, level: "TECHNICIEN" }, // Contrôle hebdo + rétrolavages
  POMPE_FILTRATION: { hours: 1, frequency: 4, level: "TECHNICIEN" },
  PAC_PISCINE: { hours: 4, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  ECHANGEUR_PISCINE: { hours: 2, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  CHAUDIERE_PISCINE: { hours: 5, frequency: 2, level: "TECHNICIEN_SPECIALISE" },
  ELECTROLYSEUR_SEL: { hours: 2, frequency: 4, level: "TECHNICIEN_SPECIALISE" }, // Contrôle électrodes
  TRAITEMENT_CHLORE: { hours: 1, frequency: 12, level: "TECHNICIEN" }, // Vérification hebdo
  TRAITEMENT_UV: { hours: 1, frequency: 4, level: "TECHNICIEN_SPECIALISE" },
  TRAITEMENT_OZONE: { hours: 2, frequency: 4, level: "TECHNICIEN_SPECIALISE" },
  REGULATEUR_PH: { hours: 1, frequency: 12, level: "TECHNICIEN" }, // Étalonnage régulier
  REGULATEUR_CHLORE: { hours: 1, frequency: 12, level: "TECHNICIEN" },
  POMPE_DOSEUSE: { hours: 0.5, frequency: 12, level: "TECHNICIEN" },
  SONDE_PH: { hours: 0.5, frequency: 12, level: "TECHNICIEN" }, // Étalonnage mensuel
  SONDE_REDOX: { hours: 0.5, frequency: 12, level: "TECHNICIEN" },
  SONDE_TEMPERATURE_EAU: { hours: 0.25, frequency: 4, level: "TECHNICIEN" },
  DESHUMIDIFICATEUR: { hours: 4, frequency: 4, level: "TECHNICIEN_SPECIALISE" }, // Maintenance importante
  CTA_PISCINE: { hours: 8, frequency: 4, level: "TECHNICIEN_SPECIALISE" }, // Spécifique ambiance piscine
  BACHE_TAMPON: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  NAGE_CONTRE_COURANT: { hours: 1, frequency: 2, level: "TECHNICIEN" },
  ROBOT_NETTOYAGE: { hours: 0.5, frequency: 4, level: "TECHNICIEN" },

  // === AUTRE ===
  AUTRE: { hours: 1, frequency: 1, level: "TECHNICIEN" },
};

// Durée de vie théorique par type d'équipement (années)
export const LIFESPAN_BY_TYPE: Record<string, number> = {
  CHAUDIERE: 20,
  CHAUDIERE_CONDENSATION: 20,
  PAC: 15,
  PAC_AIR_EAU: 15,
  PAC_EAU_EAU: 20,
  PAC_AIR_AIR: 12,
  BRULEUR: 15,
  RADIATEUR: 30,
  PLANCHER_CHAUFFANT: 50,
  CONVECTEUR: 20,
  AEROTERME: 15,
  RADIANT_GAZ: 15,
  VANNE_3_VOIES: 15,
  VANNE_MOTORISEE: 12,
  POMPE_CHAUFFAGE: 15,
  CIRCULATEUR: 15,
  VASE_EXPANSION: 15,
  ECHANGEUR_THERMIQUE: 20,
  REGULATEUR: 15,
  BALLON_ECS: 15,
  BALLON_THERMODYNAMIQUE: 12,
  PREPARATEUR_ECS_GAZ: 15,
  VMC: 15,
  VMC_SIMPLE_FLUX: 15,
  VMC_DOUBLE_FLUX: 15,
  CTA: 20,
  GROUPE_FROID: 15,
  CLIMATISEUR: 12,
  SPLIT: 12,
  ROOFTOP: 15,
  ADOUCISSEUR: 10,
  // PISCINE
  FILTRE_PISCINE: 15,
  POMPE_FILTRATION: 10,
  PAC_PISCINE: 12,
  ECHANGEUR_PISCINE: 15,
  CHAUDIERE_PISCINE: 20,
  ELECTROLYSEUR_SEL: 5, // Électrodes à remplacer régulièrement
  TRAITEMENT_CHLORE: 10,
  TRAITEMENT_UV: 8, // Lampes à changer
  TRAITEMENT_OZONE: 10,
  REGULATEUR_PH: 8,
  REGULATEUR_CHLORE: 8,
  POMPE_DOSEUSE: 8,
  SONDE_PH: 2, // Sondes pH à changer fréquemment
  SONDE_REDOX: 2,
  SONDE_TEMPERATURE_EAU: 10,
  DESHUMIDIFICATEUR: 15,
  CTA_PISCINE: 20,
  BACHE_TAMPON: 25,
  NAGE_CONTRE_COURANT: 15,
  ROBOT_NETTOYAGE: 5,
  AUTRE: 15,
};

// Coût de remplacement estimé par type (€)
// Ces valeurs sont des moyennes, à ajuster selon puissance
export const REPLACEMENT_COST_BY_TYPE: Record<string, { base: number; perKw?: number }> = {
  CHAUDIERE: { base: 8000, perKw: 50 },
  CHAUDIERE_CONDENSATION: { base: 12000, perKw: 60 },
  PAC: { base: 15000, perKw: 150 },
  PAC_AIR_EAU: { base: 12000, perKw: 120 },
  PAC_EAU_EAU: { base: 20000, perKw: 180 },
  PAC_AIR_AIR: { base: 3000, perKw: 100 },
  BRULEUR: { base: 3000, perKw: 20 },
  RADIATEUR: { base: 300 },
  PLANCHER_CHAUFFANT: { base: 80 }, // par m²
  CONVECTEUR: { base: 200 },
  AEROTERME: { base: 2000, perKw: 30 },
  RADIANT_GAZ: { base: 1500, perKw: 40 },
  VANNE_3_VOIES: { base: 500 },
  VANNE_MOTORISEE: { base: 800 },
  POMPE_CHAUFFAGE: { base: 1200, perKw: 50 },
  CIRCULATEUR: { base: 600 },
  VASE_EXPANSION: { base: 400 },
  ECHANGEUR_THERMIQUE: { base: 3000, perKw: 30 },
  REGULATEUR: { base: 2000 },
  SONDE_TEMPERATURE: { base: 150 },
  SONDE_EXTERIEURE: { base: 200 },
  BALLON_ECS: { base: 2000 },
  BALLON_THERMODYNAMIQUE: { base: 4000 },
  PREPARATEUR_ECS_GAZ: { base: 5000 },
  ECHANGEUR_ECS: { base: 2500 },
  POMPE_BOUCLAGE: { base: 800 },
  MITIGEUR_THERMOSTATIQUE: { base: 300 },
  RESISTANCE_ELECTRIQUE: { base: 200 },
  VMC: { base: 1500 },
  VMC_SIMPLE_FLUX: { base: 1200 },
  VMC_DOUBLE_FLUX: { base: 5000 },
  CTA: { base: 15000, perKw: 100 },
  CAISSON_EXTRACTION: { base: 1500 },
  CAISSON_SOUFFLAGE: { base: 1500 },
  VENTILATEUR: { base: 500 },
  BATTERIE_CHAUDE: { base: 2000 },
  BATTERIE_FROIDE: { base: 2500 },
  RECUPERATEUR_CHALEUR: { base: 3000 },
  GROUPE_FROID: { base: 10000, perKw: 150 },
  CLIMATISEUR: { base: 2000, perKw: 100 },
  SPLIT: { base: 1500, perKw: 100 },
  MULTI_SPLIT: { base: 4000 },
  CASSETTE: { base: 2000 },
  GAINABLE: { base: 3500 },
  ROOFTOP: { base: 20000, perKw: 100 },
  ADOUCISSEUR: { base: 2000 },
  DISCONNECTEUR: { base: 500 },
  FILTRE: { base: 200 },
  POT_BOUE: { base: 500 },
  DEGAZEUR: { base: 1000 },
  DOSEUR: { base: 800 },
  COMPTEUR_ENERGIE: { base: 1500 },
  COMPTEUR_CALORIES: { base: 1500 },
  COMPTEUR_GAZ: { base: 800 },
  COMPTEUR_EAU: { base: 400 },
  // PISCINE
  FILTRE_PISCINE: { base: 8000 }, // Filtre à sable industriel
  POMPE_FILTRATION: { base: 3000, perKw: 200 },
  PAC_PISCINE: { base: 15000, perKw: 150 },
  ECHANGEUR_PISCINE: { base: 5000, perKw: 50 },
  CHAUDIERE_PISCINE: { base: 12000, perKw: 60 },
  ELECTROLYSEUR_SEL: { base: 4000 },
  TRAITEMENT_CHLORE: { base: 3000 },
  TRAITEMENT_UV: { base: 8000 },
  TRAITEMENT_OZONE: { base: 15000 },
  REGULATEUR_PH: { base: 2500 },
  REGULATEUR_CHLORE: { base: 2500 },
  POMPE_DOSEUSE: { base: 800 },
  SONDE_PH: { base: 300 },
  SONDE_REDOX: { base: 350 },
  SONDE_TEMPERATURE_EAU: { base: 200 },
  DESHUMIDIFICATEUR: { base: 25000, perKw: 100 }, // Gros équipement piscine couverte
  CTA_PISCINE: { base: 40000, perKw: 150 }, // CTA spécifique piscine (corrosion, humidité)
  BACHE_TAMPON: { base: 5000 },
  NAGE_CONTRE_COURANT: { base: 6000, perKw: 300 },
  ROBOT_NETTOYAGE: { base: 8000 },
  AUTRE: { base: 1000 },
};

// Coefficient de majoration P3 GE selon l'état (audit)
export const AUDIT_RATING_COEFFICIENT: Record<string, number> = {
  NON_EVALUE: 1.0,
  EXCELLENT: 0.7,   // Équipement neuf, moins de maintenance
  BON: 0.85,
  MOYEN: 1.0,
  MAUVAIS: 1.3,     // Plus de maintenance nécessaire
  CRITIQUE: 1.5,    // Risque de panne, maintenance accrue
};

// Interface pour un équipement à chiffrer
export interface EquipmentForPricing {
  id: string;
  type: EquipmentType;
  domain?: EquipmentDomain;
  power?: number | null; // kW
  quantity?: number | null;
  year?: number | null; // Année de fabrication
  installDate?: Date | null;
  theoreticalLifespan?: number | null;
  status?: string;
  // Audit data
  auditRating?: AuditRating | string;
  auditVisualState?: AuditRating | string;
  auditPerformance?: AuditRating | string;
}

// Résultat du calcul P2
export interface P2Estimate {
  equipmentId: string;
  equipmentType: string;
  hoursPerYear: number;
  visitsPerYear: number;
  technicianLevel: string;
  hourlyRate: number;
  annualCost: number;
}

// Résultat du calcul P3 GE
export interface P3GEEstimate {
  equipmentId: string;
  equipmentType: string;
  baseCost: number;
  auditCoefficient: number;
  ageCoefficient: number;
  annualCost: number;
  notes: string[];
}

// Résultat du calcul P3 R
export interface P3REstimate {
  equipmentId: string;
  equipmentType: string;
  replacementCost: number;
  remainingLifeYears: number;
  yearsInContract: number;
  renewalNeeded: boolean;
  urgency: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  renewalYear?: number; // Année de remplacement recommandée
  annualProvision: number; // Provision annuelle sur la durée du marché
  notes: string[];
}

/**
 * Calcule le P2 (petit entretien) pour un équipement
 */
export function calculateP2(equipment: EquipmentForPricing): P2Estimate {
  const typeKey = equipment.type as string;
  const config = P2_HOURS_BY_TYPE[typeKey] || P2_HOURS_BY_TYPE.AUTRE;

  const quantity = equipment.quantity || 1;
  const hoursPerYear = config.hours * config.frequency * quantity;
  const hourlyRate = HOURLY_RATES[config.level];
  const annualCost = hoursPerYear * hourlyRate;

  return {
    equipmentId: equipment.id,
    equipmentType: typeKey,
    hoursPerYear,
    visitsPerYear: config.frequency,
    technicianLevel: config.level,
    hourlyRate,
    annualCost: Math.round(annualCost * 100) / 100,
  };
}

/**
 * Calcule le P3 GE (Gros Entretien annuel) pour un équipement
 */
export function calculateP3GE(equipment: EquipmentForPricing): P3GEEstimate {
  const typeKey = equipment.type as string;
  const notes: string[] = [];

  // Coût de base = ~5% du coût de remplacement par an pour GE
  const replacementConfig = REPLACEMENT_COST_BY_TYPE[typeKey] || REPLACEMENT_COST_BY_TYPE.AUTRE;
  let replacementCost = replacementConfig.base;
  if (replacementConfig.perKw && equipment.power) {
    replacementCost += replacementConfig.perKw * equipment.power;
  }

  const quantity = equipment.quantity || 1;
  const baseCost = replacementCost * 0.05 * quantity; // 5% du coût de remplacement

  // Coefficient selon l'état (audit)
  const auditRating = (equipment.auditRating || equipment.auditVisualState || "NON_EVALUE") as string;
  const auditCoefficient = AUDIT_RATING_COEFFICIENT[auditRating] || 1.0;

  if (auditCoefficient > 1) {
    notes.push(`Majoration ${Math.round((auditCoefficient - 1) * 100)}% (état ${auditRating})`);
  }

  // Coefficient selon l'âge
  const currentYear = new Date().getFullYear();
  const equipmentYear = equipment.year || (equipment.installDate ? equipment.installDate.getFullYear() : currentYear);
  const age = currentYear - equipmentYear;
  const lifespan = equipment.theoreticalLifespan || LIFESPAN_BY_TYPE[typeKey] || 15;

  let ageCoefficient = 1.0;
  const ageRatio = age / lifespan;
  if (ageRatio > 0.8) {
    ageCoefficient = 1.4; // Équipement en fin de vie
    notes.push(`Équipement en fin de vie (${age} ans / ${lifespan} ans)`);
  } else if (ageRatio > 0.6) {
    ageCoefficient = 1.2;
    notes.push(`Équipement vieillissant (${age} ans)`);
  } else if (ageRatio < 0.2) {
    ageCoefficient = 0.8;
    notes.push(`Équipement récent (${age} ans)`);
  }

  const annualCost = baseCost * auditCoefficient * ageCoefficient;

  return {
    equipmentId: equipment.id,
    equipmentType: typeKey,
    baseCost: Math.round(baseCost),
    auditCoefficient,
    ageCoefficient,
    annualCost: Math.round(annualCost),
    notes,
  };
}

/**
 * Calcule le P3 R (Renouvellement) pour un équipement sur la durée du marché
 */
export function calculateP3R(
  equipment: EquipmentForPricing,
  contractDurationYears: number,
  contractStartYear: number = new Date().getFullYear()
): P3REstimate {
  const typeKey = equipment.type as string;
  const notes: string[] = [];

  // Coût de remplacement
  const replacementConfig = REPLACEMENT_COST_BY_TYPE[typeKey] || REPLACEMENT_COST_BY_TYPE.AUTRE;
  let replacementCost = replacementConfig.base;
  if (replacementConfig.perKw && equipment.power) {
    replacementCost += replacementConfig.perKw * equipment.power;
  }
  const quantity = equipment.quantity || 1;
  replacementCost *= quantity;

  // Calcul de la durée de vie restante
  const currentYear = new Date().getFullYear();
  const equipmentYear = equipment.year || (equipment.installDate ? equipment.installDate.getFullYear() : currentYear);
  const age = currentYear - equipmentYear;
  const lifespan = equipment.theoreticalLifespan || LIFESPAN_BY_TYPE[typeKey] || 15;

  // Ajustement selon l'état
  const auditRating = (equipment.auditRating || equipment.auditVisualState || "NON_EVALUE") as string;
  let lifespanAdjustment = 0;
  if (auditRating === "CRITIQUE") lifespanAdjustment = -5;
  else if (auditRating === "MAUVAIS") lifespanAdjustment = -3;
  else if (auditRating === "EXCELLENT") lifespanAdjustment = 2;
  else if (auditRating === "BON") lifespanAdjustment = 1;

  const adjustedLifespan = Math.max(5, lifespan + lifespanAdjustment);
  const remainingLifeYears = Math.max(0, adjustedLifespan - age);

  // Année de remplacement prévue
  const renewalYear = currentYear + remainingLifeYears;
  const contractEndYear = contractStartYear + contractDurationYears;

  // Est-ce que le remplacement tombe pendant le contrat ?
  const renewalNeeded = renewalYear <= contractEndYear;
  const yearsInContract = renewalNeeded ? Math.max(0, contractEndYear - renewalYear) : 0;

  // Urgence
  let urgency: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "NONE";
  if (remainingLifeYears <= 0) {
    urgency = "CRITICAL";
    notes.push("Remplacement immédiat recommandé");
  } else if (remainingLifeYears <= 2) {
    urgency = "HIGH";
    notes.push(`Remplacement dans ${remainingLifeYears} an(s)`);
  } else if (remainingLifeYears <= 5) {
    urgency = "MEDIUM";
  } else if (renewalNeeded) {
    urgency = "LOW";
  }

  // Provision annuelle = coût / durée du marché (si remplacement prévu)
  const annualProvision = renewalNeeded ? Math.round(replacementCost / contractDurationYears) : 0;

  if (renewalNeeded) {
    notes.push(`Remplacement prévu en ${renewalYear} (année ${renewalYear - contractStartYear + 1} du marché)`);
  }

  return {
    equipmentId: equipment.id,
    equipmentType: typeKey,
    replacementCost: Math.round(replacementCost),
    remainingLifeYears,
    yearsInContract,
    renewalNeeded,
    urgency,
    renewalYear: renewalNeeded ? renewalYear : undefined,
    annualProvision,
    notes,
  };
}

/**
 * Calcule le dimensionnement complet d'un marché
 */
export interface MarketDimensioning {
  // Totaux annuels
  totalP2Annual: number;
  totalP3GEAnnual: number;
  totalP3RAnnual: number;
  totalP3Annual: number; // P3 GE + P3 R
  totalAnnual: number; // P2 + P3

  // Heures
  totalHoursP2: number;

  // Détails par équipement
  p2Details: P2Estimate[];
  p3GEDetails: P3GEEstimate[];
  p3RDetails: P3REstimate[];

  // Équipements à renouveler
  renewalsNeeded: Array<{
    equipment: EquipmentForPricing;
    estimate: P3REstimate;
  }>;

  // Travaux obligatoires (urgence HIGH ou CRITICAL)
  mandatoryWorks: Array<{
    equipment: EquipmentForPricing;
    estimate: P3REstimate;
  }>;
}

export function calculateMarketDimensioning(
  equipments: EquipmentForPricing[],
  contractDurationYears: number,
  contractStartYear: number = new Date().getFullYear()
): MarketDimensioning {
  const p2Details: P2Estimate[] = [];
  const p3GEDetails: P3GEEstimate[] = [];
  const p3RDetails: P3REstimate[] = [];
  const renewalsNeeded: MarketDimensioning["renewalsNeeded"] = [];
  const mandatoryWorks: MarketDimensioning["mandatoryWorks"] = [];

  for (const equipment of equipments) {
    // P2
    const p2 = calculateP2(equipment);
    p2Details.push(p2);

    // P3 GE
    const p3GE = calculateP3GE(equipment);
    p3GEDetails.push(p3GE);

    // P3 R
    const p3R = calculateP3R(equipment, contractDurationYears, contractStartYear);
    p3RDetails.push(p3R);

    if (p3R.renewalNeeded) {
      renewalsNeeded.push({ equipment, estimate: p3R });

      if (p3R.urgency === "HIGH" || p3R.urgency === "CRITICAL") {
        mandatoryWorks.push({ equipment, estimate: p3R });
      }
    }
  }

  const totalP2Annual = p2Details.reduce((sum, p) => sum + p.annualCost, 0);
  const totalP3GEAnnual = p3GEDetails.reduce((sum, p) => sum + p.annualCost, 0);

  // P3 R annuel = uniquement les renouvellements NON urgents (LOW, MEDIUM, NONE)
  // Les travaux obligatoires (HIGH, CRITICAL) sont comptés séparément
  const mandatoryEquipmentIds = new Set(mandatoryWorks.map(m => m.equipment.id));
  const totalP3RAnnual = p3RDetails
    .filter(p => !mandatoryEquipmentIds.has(p.equipmentId))
    .reduce((sum, p) => sum + p.annualProvision, 0);

  const totalHoursP2 = p2Details.reduce((sum, p) => sum + p.hoursPerYear, 0);

  return {
    totalP2Annual: Math.round(totalP2Annual),
    totalP3GEAnnual: Math.round(totalP3GEAnnual),
    totalP3RAnnual: Math.round(totalP3RAnnual),
    totalP3Annual: Math.round(totalP3GEAnnual + totalP3RAnnual),
    totalAnnual: Math.round(totalP2Annual + totalP3GEAnnual + totalP3RAnnual),
    totalHoursP2: Math.round(totalHoursP2 * 10) / 10,
    p2Details,
    p3GEDetails,
    p3RDetails,
    renewalsNeeded,
    mandatoryWorks,
  };
}

// ============================================
// ANALYSE EAU PISCINE
// ============================================

/**
 * Configuration des analyses d'eau piscine pour un site
 */
export interface PoolAnalysisConfig {
  enabled: boolean;
  perDay: number;       // Nombre d'analyses par jour (1, 2, 3...)
  daysPerWeek: number;  // Jours par semaine (7=quotidien, 5=semaine, etc.)
  weeksPerYear: number; // Semaines par an (ex: 40 si piscine fermée 12 semaines)
  minutesPerVisit: number; // Durée par passage en minutes
}

/**
 * Résultat du calcul d'analyse eau piscine
 */
export interface PoolAnalysisEstimate {
  enabled: boolean;
  visitsPerYear: number;
  hoursPerYear: number;
  hourlyRate: number;
  annualCost: number;
  details: {
    perDay: number;
    daysPerWeek: number;
    weeksPerYear: number;
    minutesPerVisit: number;
  };
}

/**
 * Calcule le coût annuel des analyses d'eau piscine pour un site
 */
export function calculatePoolAnalysis(config: PoolAnalysisConfig): PoolAnalysisEstimate {
  if (!config.enabled) {
    return {
      enabled: false,
      visitsPerYear: 0,
      hoursPerYear: 0,
      hourlyRate: HOURLY_RATES.TECHNICIEN,
      annualCost: 0,
      details: {
        perDay: 0,
        daysPerWeek: 0,
        weeksPerYear: 0,
        minutesPerVisit: 0,
      },
    };
  }

  const visitsPerYear = config.perDay * config.daysPerWeek * config.weeksPerYear;
  const hoursPerYear = (visitsPerYear * config.minutesPerVisit) / 60;
  const hourlyRate = HOURLY_RATES.TECHNICIEN; // Niveau technicien pour les analyses
  const annualCost = hoursPerYear * hourlyRate;

  return {
    enabled: true,
    visitsPerYear,
    hoursPerYear: Math.round(hoursPerYear * 10) / 10,
    hourlyRate,
    annualCost: Math.round(annualCost),
    details: {
      perDay: config.perDay,
      daysPerWeek: config.daysPerWeek,
      weeksPerYear: config.weeksPerYear,
      minutesPerVisit: config.minutesPerVisit,
    },
  };
}

/**
 * Exemples de configurations type pour les analyses d'eau piscine
 * Chaque contrat/site peut définir sa propre configuration
 */
export const POOL_ANALYSIS_PRESETS = {
  // Piscine ouverte toute l'année 365j/365j - 1 analyse/jour
  ANNUEL_365: {
    enabled: true,
    perDay: 1,
    daysPerWeek: 7,
    weeksPerYear: 52, // 364 jours ~= 365
    minutesPerVisit: 30,
    label: "Toute l'année (365j) - 1x/jour",
  },
  // Piscine ouverte toute l'année - 2 analyses/jour
  ANNUEL_365_2X: {
    enabled: true,
    perDay: 2,
    daysPerWeek: 7,
    weeksPerYear: 52,
    minutesPerVisit: 30,
    label: "Toute l'année (365j) - 2x/jour",
  },
  // Piscine ouverte toute l'année - 3 analyses/jour
  ANNUEL_365_3X: {
    enabled: true,
    perDay: 3,
    daysPerWeek: 7,
    weeksPerYear: 52,
    minutesPerVisit: 30,
    label: "Toute l'année (365j) - 3x/jour",
  },
  // Piscine publique - 1 analyse/jour, 7j/7, 40 semaines (fermeture été/hiver)
  STANDARD_40SEM: {
    enabled: true,
    perDay: 1,
    daysPerWeek: 7,
    weeksPerYear: 40,
    minutesPerVisit: 30,
    label: "40 semaines - 1x/jour",
  },
  // Piscine publique - 2 analyses/jour (matin/soir), 40 semaines
  INTENSIVE_40SEM: {
    enabled: true,
    perDay: 2,
    daysPerWeek: 7,
    weeksPerYear: 40,
    minutesPerVisit: 30,
    label: "40 semaines - 2x/jour",
  },
  // Piscine scolaire - 5j/semaine, période scolaire
  SCOLAIRE: {
    enabled: true,
    perDay: 1,
    daysPerWeek: 5,
    weeksPerYear: 36, // ~36 semaines scolaires
    minutesPerVisit: 30,
    label: "Scolaire (36 sem, 5j/sem)",
  },
  // Piscine saisonnière (été uniquement)
  SAISONNIER_ETE: {
    enabled: true,
    perDay: 1,
    daysPerWeek: 7,
    weeksPerYear: 16, // ~4 mois d'été
    minutesPerVisit: 30,
    label: "Saisonnier été (16 sem)",
  },
  // Ponctuel / sur demande
  PONCTUEL: {
    enabled: true,
    perDay: 1,
    daysPerWeek: 2, // 2 fois par semaine
    weeksPerYear: 40,
    minutesPerVisit: 30,
    label: "Ponctuel (2x/sem)",
  },
} as const;

// Labels français pour les types d'équipements
export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  CHAUDIERE: "Chaudière",
  CHAUDIERE_CONDENSATION: "Chaudière condensation",
  PAC: "Pompe à chaleur",
  PAC_AIR_EAU: "PAC Air/Eau",
  PAC_EAU_EAU: "PAC Eau/Eau",
  PAC_AIR_AIR: "PAC Air/Air",
  BRULEUR: "Brûleur",
  RADIATEUR: "Radiateur",
  PLANCHER_CHAUFFANT: "Plancher chauffant",
  CONVECTEUR: "Convecteur",
  AEROTERME: "Aérotherme",
  RADIANT_GAZ: "Radiant gaz",
  VANNE_3_VOIES: "Vanne 3 voies",
  VANNE_MOTORISEE: "Vanne motorisée",
  POMPE_CHAUFFAGE: "Pompe chauffage",
  CIRCULATEUR: "Circulateur",
  VASE_EXPANSION: "Vase d'expansion",
  ECHANGEUR_THERMIQUE: "Échangeur thermique",
  REGULATEUR: "Régulateur",
  SONDE_TEMPERATURE: "Sonde température",
  SONDE_EXTERIEURE: "Sonde extérieure",
  BALLON_ECS: "Ballon ECS",
  BALLON_THERMODYNAMIQUE: "Ballon thermodynamique",
  PREPARATEUR_ECS_GAZ: "Préparateur ECS gaz",
  ECHANGEUR_ECS: "Échangeur ECS",
  POMPE_BOUCLAGE: "Pompe bouclage",
  MITIGEUR_THERMOSTATIQUE: "Mitigeur thermostatique",
  RESISTANCE_ELECTRIQUE: "Résistance électrique",
  VMC: "VMC",
  VMC_SIMPLE_FLUX: "VMC Simple flux",
  VMC_DOUBLE_FLUX: "VMC Double flux",
  CTA: "CTA",
  CAISSON_EXTRACTION: "Caisson extraction",
  CAISSON_SOUFFLAGE: "Caisson soufflage",
  VENTILATEUR: "Ventilateur",
  BATTERIE_CHAUDE: "Batterie chaude",
  BATTERIE_FROIDE: "Batterie froide",
  RECUPERATEUR_CHALEUR: "Récupérateur chaleur",
  GROUPE_FROID: "Groupe froid",
  CLIMATISEUR: "Climatiseur",
  SPLIT: "Split",
  MULTI_SPLIT: "Multi-split",
  CASSETTE: "Cassette",
  GAINABLE: "Gainable",
  ROOFTOP: "Rooftop",
  ADOUCISSEUR: "Adoucisseur",
  DISCONNECTEUR: "Disconnecteur",
  FILTRE: "Filtre",
  POT_BOUE: "Pot à boue",
  DEGAZEUR: "Dégazeur",
  DOSEUR: "Doseur",
  COMPTEUR_ENERGIE: "Compteur énergie",
  COMPTEUR_CALORIES: "Compteur calories",
  COMPTEUR_GAZ: "Compteur gaz",
  COMPTEUR_EAU: "Compteur eau",
  // PISCINE
  FILTRE_PISCINE: "Filtre piscine",
  POMPE_FILTRATION: "Pompe filtration",
  PAC_PISCINE: "PAC piscine",
  ECHANGEUR_PISCINE: "Échangeur piscine",
  CHAUDIERE_PISCINE: "Chaudière piscine",
  ELECTROLYSEUR_SEL: "Électrolyseur sel",
  TRAITEMENT_CHLORE: "Traitement chlore",
  TRAITEMENT_UV: "Traitement UV",
  TRAITEMENT_OZONE: "Traitement ozone",
  REGULATEUR_PH: "Régulateur pH",
  REGULATEUR_CHLORE: "Régulateur chlore",
  POMPE_DOSEUSE: "Pompe doseuse",
  SONDE_PH: "Sonde pH",
  SONDE_REDOX: "Sonde redox",
  SONDE_TEMPERATURE_EAU: "Sonde température eau",
  DESHUMIDIFICATEUR: "Déshumidificateur",
  CTA_PISCINE: "CTA piscine",
  BACHE_TAMPON: "Bâche tampon",
  NAGE_CONTRE_COURANT: "Nage contre-courant",
  ROBOT_NETTOYAGE: "Robot nettoyage",
  AUTRE: "Autre",
};
