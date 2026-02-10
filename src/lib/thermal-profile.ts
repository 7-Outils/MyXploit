/**
 * Profil thermique des bâtiments
 *
 * Coefficient G (W/m³.°C) : déperditions thermiques volumiques
 * - G estimé : basé sur les caractéristiques du bâtiment (année, isolation, vitrage, ventilation)
 * - G réel : calculé depuis les consommations réelles et les DJU
 *
 * Formules :
 *   G réel = Qchauffage / (V × DJU × 24 / 1000)
 *   P nécessaire = G × V × ΔT (en W)
 *   Conso théorique = G × V × DJU × 24 / 1000 (en kWh)
 */

// ============================================================
// Tables de référence G (W/m³.°C) par niveau d'isolation
// Sources : COSTIC, ADEME, retours terrain exploitation
// ============================================================

type InsulationLevel =
  | "AUCUNE"
  | "PARTIELLE"
  | "RT1974"
  | "RT1988"
  | "RT2000"
  | "RT2005"
  | "RT2012"
  | "RE2020";

type GlazingType = "SIMPLE" | "DOUBLE" | "DOUBLE_FE" | "TRIPLE";
type VentilationType = "NATURELLE" | "SIMPLE_FLUX" | "HYGRO_B" | "DOUBLE_FLUX";
type SiteType =
  | "LYCEE"
  | "COLLEGE"
  | "ECOLE"
  | "MAIRIE"
  | "HOPITAL"
  | "GYMNASE"
  | "PISCINE"
  | "MEDIATHEQUE"
  | "AUTRE";

// G de base par niveau d'isolation (W/m³.°C)
const G_BASE: Record<InsulationLevel, { min: number; max: number; typical: number }> = {
  AUCUNE:    { min: 1.2, max: 1.8, typical: 1.5 },
  PARTIELLE: { min: 1.0, max: 1.4, typical: 1.2 },
  RT1974:    { min: 0.9, max: 1.2, typical: 1.05 },
  RT1988:    { min: 0.7, max: 0.9, typical: 0.8 },
  RT2000:    { min: 0.5, max: 0.7, typical: 0.6 },
  RT2005:    { min: 0.4, max: 0.6, typical: 0.5 },
  RT2012:    { min: 0.3, max: 0.5, typical: 0.4 },
  RE2020:    { min: 0.2, max: 0.35, typical: 0.28 },
};

// Correction vitrage (facteur multiplicatif sur G)
const GLAZING_FACTOR: Record<GlazingType, number> = {
  SIMPLE:    1.15, // +15% déperditions
  DOUBLE:    1.0,  // référence
  DOUBLE_FE: 0.92, // -8%
  TRIPLE:    0.85, // -15%
};

// Correction ventilation (facteur multiplicatif sur G)
const VENTILATION_FACTOR: Record<VentilationType, number> = {
  NATURELLE:    1.10, // +10% (pas de contrôle du débit)
  SIMPLE_FLUX:  1.0,  // référence
  HYGRO_B:      0.92, // -8% (débit adapté à l'humidité)
  DOUBLE_FLUX:  0.80, // -20% (récupération de chaleur)
};

// Correction type de bâtiment (facteur multiplicatif)
// Certains bâtiments ont des besoins spécifiques
const BUILDING_TYPE_FACTOR: Record<SiteType, number> = {
  LYCEE:        1.0,
  COLLEGE:      1.0,
  ECOLE:        1.0,
  MAIRIE:       0.95, // Bureaux, moins de renouvellement d'air
  HOPITAL:      1.20, // Fort renouvellement d'air, 24/7
  GYMNASE:      1.10, // Grand volume, hauteur
  PISCINE:      1.30, // Évaporation, déshumidification
  MEDIATHEQUE:  0.95,
  AUTRE:        1.0,
};

// ============================================================
// Estimation du niveau d'isolation depuis l'année de construction
// ============================================================

export function estimateInsulationFromYear(year: number): InsulationLevel {
  if (year < 1974) return "AUCUNE";
  if (year < 1982) return "RT1974";
  if (year < 2000) return "RT1988";
  if (year < 2006) return "RT2000";
  if (year < 2013) return "RT2005";
  if (year < 2022) return "RT2012";
  return "RE2020";
}

// ============================================================
// Calcul du G estimé
// ============================================================

export interface BuildingCharacteristics {
  insulationLevel?: InsulationLevel | null;
  constructionYear?: number | null;
  glazingType?: GlazingType | null;
  ventilationType?: VentilationType | null;
  siteType?: SiteType | null;
}

export interface GEstimation {
  gMin: number;
  gMax: number;
  gTypical: number;
  insulationUsed: InsulationLevel;
  factors: {
    glazing: number;
    ventilation: number;
    buildingType: number;
  };
}

export function estimateG(characteristics: BuildingCharacteristics): GEstimation {
  // Déterminer le niveau d'isolation
  const insulationUsed =
    characteristics.insulationLevel ||
    (characteristics.constructionYear
      ? estimateInsulationFromYear(characteristics.constructionYear)
      : "AUCUNE");

  const base = G_BASE[insulationUsed];
  const glazingFactor = characteristics.glazingType
    ? GLAZING_FACTOR[characteristics.glazingType]
    : 1.0;
  const ventilationFactor = characteristics.ventilationType
    ? VENTILATION_FACTOR[characteristics.ventilationType]
    : 1.0;
  const buildingFactor = characteristics.siteType
    ? BUILDING_TYPE_FACTOR[characteristics.siteType]
    : 1.0;

  const totalFactor = glazingFactor * ventilationFactor * buildingFactor;

  return {
    gMin: Math.round(base.min * totalFactor * 100) / 100,
    gMax: Math.round(base.max * totalFactor * 100) / 100,
    gTypical: Math.round(base.typical * totalFactor * 100) / 100,
    insulationUsed,
    factors: {
      glazing: glazingFactor,
      ventilation: ventilationFactor,
      buildingType: buildingFactor,
    },
  };
}

// ============================================================
// Calcul du G réel depuis les consommations
// ============================================================

export interface ConsumptionData {
  /** Consommation chauffage totale saison en kWh */
  heatingConsumptionKwh: number;
  /** Volume chauffé en m³ */
  heatedVolume: number;
  /** DJU réels cumulés de la saison */
  djuReal: number;
  /** Rendement chaudière (0 à 1) */
  boilerEfficiency?: number;
}

export interface GReal {
  /** G réel calculé (W/m³.°C) */
  value: number;
  /** Saison utilisée pour le calcul */
  season?: string;
  /** Fiabilité du calcul */
  reliability: "HIGH" | "MEDIUM" | "LOW";
  /** Raison si fiabilité basse */
  reliabilityReason?: string;
}

export function calculateRealG(data: ConsumptionData): GReal {
  const { heatingConsumptionKwh, heatedVolume, djuReal, boilerEfficiency = 0.9 } = data;

  // Validations
  if (heatedVolume <= 0 || djuReal <= 0) {
    return {
      value: 0,
      reliability: "LOW",
      reliabilityReason: "Volume chauffé ou DJU invalides",
    };
  }

  // G = Qchauffage / (V × DJU × 24 / 1000)
  // On divise par le rendement pour obtenir les besoins réels du bâtiment
  const gReal = (heatingConsumptionKwh / boilerEfficiency) / (heatedVolume * djuReal * 24 / 1000);

  // Évaluer la fiabilité
  let reliability: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  let reliabilityReason: string | undefined;

  if (djuReal < 1500) {
    reliability = "MEDIUM";
    reliabilityReason = "Saison de chauffe courte (DJU < 1500)";
  }
  if (djuReal < 800) {
    reliability = "LOW";
    reliabilityReason = "Données insuffisantes (DJU < 800)";
  }
  if (gReal > 3.0 || gReal < 0.1) {
    reliability = "LOW";
    reliabilityReason = `G calculé hors limites réalistes (${gReal.toFixed(2)})`;
  }

  return {
    value: Math.round(gReal * 100) / 100,
    reliability,
    reliabilityReason,
  };
}

// ============================================================
// Comparaison G estimé vs G réel → Diagnostic
// ============================================================

export type DiagnosticLevel = "PERFORMANT" | "CONFORME" | "ATTENTION" | "CRITIQUE";

export interface ThermalDiagnostic {
  level: DiagnosticLevel;
  ecartPercent: number; // Écart en % (positif = réel > estimé)
  message: string;
  recommendation: string;
  auditRecommended: boolean;
}

export function comparerG(gEstime: number, gReel: number): ThermalDiagnostic {
  if (gEstime <= 0) {
    return {
      level: "ATTENTION",
      ecartPercent: 0,
      message: "G estimé non disponible",
      recommendation: "Renseigner les caractéristiques du bâtiment pour obtenir un diagnostic.",
      auditRecommended: false,
    };
  }

  const ecart = ((gReel - gEstime) / gEstime) * 100;

  if (ecart < -15) {
    return {
      level: "PERFORMANT",
      ecartPercent: Math.round(ecart),
      message: `Le bâtiment est ${Math.abs(Math.round(ecart))}% plus performant qu'attendu.`,
      recommendation:
        "Bonne performance thermique. Vérifier si des travaux récents expliquent cet écart positif.",
      auditRecommended: false,
    };
  }

  if (ecart <= 15) {
    return {
      level: "CONFORME",
      ecartPercent: Math.round(ecart),
      message: "Le bâtiment se comporte conformément à son profil.",
      recommendation: "Performance dans la norme. Poursuivre le suivi régulier.",
      auditRecommended: false,
    };
  }

  if (ecart <= 40) {
    return {
      level: "ATTENTION",
      ecartPercent: Math.round(ecart),
      message: `Déperditions ${Math.round(ecart)}% supérieures au profil du bâtiment.`,
      recommendation:
        "Écart significatif détecté. Un audit énergétique est recommandé pour identifier les causes : défauts d'isolation, ponts thermiques, régulation, ou vétusté des équipements.",
      auditRecommended: true,
    };
  }

  return {
    level: "CRITIQUE",
    ecartPercent: Math.round(ecart),
    message: `Déperditions ${Math.round(ecart)}% supérieures au profil — anomalie critique.`,
    recommendation:
      "Écart très important. Mission d'audit énergétique fortement recommandée. Causes possibles : absence d'isolation, fuites d'air majeures, régulation défaillante, équipements en fin de vie.",
    auditRecommended: true,
  };
}

// ============================================================
// Estimations de puissance et consommation
// ============================================================

export interface PowerEstimation {
  /** Puissance de chauffe nécessaire (kW) */
  heatingPowerKw: number;
  /** Consommation annuelle théorique (kWh) */
  theoreticalConsumptionKwh: number;
  /** Consommation annuelle théorique (MWh) */
  theoreticalConsumptionMwh: number;
}

/**
 * Estime la puissance et la consommation théorique
 * @param g Coefficient G (W/m³.°C)
 * @param volume Volume chauffé (m³)
 * @param djuAnnuel DJU annuels de référence
 * @param tempBase Température de base extérieure de la zone climatique (°C)
 * @param tempConsigne Température de consigne intérieure (°C)
 * @param rendement Rendement global de l'installation
 */
export function estimatePowerAndConsumption(
  g: number,
  volume: number,
  djuAnnuel: number,
  tempBase: number = -7,
  tempConsigne: number = 19,
  rendement: number = 0.9
): PowerEstimation {
  // Puissance = G × V × ΔT / 1000 (kW)
  const deltaT = tempConsigne - tempBase;
  const heatingPowerKw = Math.round((g * volume * deltaT) / 1000 * 10) / 10;

  // Consommation = G × V × DJU × 24 / 1000 / rendement (kWh)
  const theoreticalConsumptionKwh = Math.round(
    (g * volume * djuAnnuel * 24) / 1000 / rendement
  );
  const theoreticalConsumptionMwh = Math.round(theoreticalConsumptionKwh / 100) / 10;

  return {
    heatingPowerKw,
    theoreticalConsumptionKwh,
    theoreticalConsumptionMwh,
  };
}
