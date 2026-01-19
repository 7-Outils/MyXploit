/**
 * Checklist complète pour les audits techniques de chaufferie
 *
 * Structure:
 * - Chaque catégorie contient des points de contrôle
 * - Chaque point de contrôle a des constats possibles (findings)
 * - Les constats peuvent être: À jour, Périmé, Non réalisé, Non applicable
 * - Certains points nécessitent une date ou des valeurs
 */

// Types de réponse pour les checkpoints
export type ResponseType =
  | "YES_NO"           // Simple Oui/Non
  | "YES_NO_DATE"      // Oui/Non + Date si Oui
  | "YES_NO_VALUES"    // Oui/Non + Valeurs mesurées
  | "STATUS"           // À jour / Périmé / Non réalisé / N/A
  | "STATUS_DATE"      // Statut + Date du dernier contrôle
  | "MULTI_CHOICE";    // Choix multiples personnalisés

// Statuts possibles pour les contrôles périodiques
export const CONTROL_STATUS = {
  A_JOUR: { id: "a_jour", label: "À jour", isConform: true },
  PERIME: { id: "perime", label: "Périmé", isConform: false },
  NON_REALISE: { id: "non_realise", label: "Non réalisé", isConform: false },
  NON_APPLICABLE: { id: "na", label: "Non applicable", isConform: true },
} as const;

// Statuts pour contrôles visuels/état
export const VISUAL_STATUS = {
  CONFORME: { id: "conforme", label: "Conforme", isConform: true },
  NON_CONFORME: { id: "non_conforme", label: "Non conforme", isConform: false },
  A_VERIFIER: { id: "a_verifier", label: "À vérifier", isConform: false },
  NON_APPLICABLE: { id: "na", label: "Non applicable", isConform: true },
} as const;

// Interface pour un constat (finding)
export interface Finding {
  id: string;
  label: string;
  isConform: boolean;
  reportText?: string;
  recommendationId?: string;
}

// Interface pour un champ de valeur
export interface ValueField {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "date" | "text";
  thresholdMin?: number;
  thresholdMax?: number;
  interpretation?: {
    belowMin?: string;
    withinRange?: string;
    aboveMax?: string;
  };
}

// Interface pour un point de contrôle
export interface CheckpointDefinition {
  id: string;
  label: string;
  category: string;
  subcategory?: string;
  description?: string;
  responseType: ResponseType;
  findings: Finding[];
  valueFields?: ValueField[];
  regulatoryRef?: string;
  periodicity?: string;
  sortOrder: number;
  applicableConditions?: string[]; // ex: ["HAS_GAS", "POWER_GT_70KW"]
}

// Interface pour une catégorie
export interface CategoryDefinition {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

// ============================================================================
// CATÉGORIES
// ============================================================================

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "SECURITE_LOCAL",
    label: "Sécurité & Local",
    description: "Conformité du local technique et sécurité incendie",
    sortOrder: 1,
  },
  {
    id: "AERATION_VENTILATION",
    label: "Aération et Ventilation",
    description: "Ventilation basse/haute et combustion",
    sortOrder: 2,
  },
  {
    id: "CHAUDIERES_BRULEURS",
    label: "Chaudières et Brûleurs",
    description: "Contrôles périodiques des générateurs",
    sortOrder: 3,
  },
  {
    id: "INSTALLATIONS_GAZ",
    label: "Installations Gaz",
    description: "Étanchéité et conformité gaz",
    sortOrder: 4,
  },
  {
    id: "COMBUSTION_FUMEES",
    label: "Combustion et Fumées",
    description: "Analyse combustion et conduits de fumée",
    sortOrder: 5,
  },
  {
    id: "CIRCUIT_HYDRAULIQUE",
    label: "Circuit Hydraulique",
    description: "Protection réseau eau et hydraulique",
    sortOrder: 6,
  },
  {
    id: "TRAITEMENT_EAU",
    label: "Traitement d'Eau",
    description: "Adoucisseur, désembouage, qualité eau",
    sortOrder: 7,
  },
  {
    id: "SECURITE_PRESSION",
    label: "Sécurité Pression/Température",
    description: "Soupapes, thermostats, vases d'expansion",
    sortOrder: 8,
  },
  {
    id: "ECS_LEGIONELLES",
    label: "ECS & Légionelles",
    description: "Températures ECS et risque légionelle",
    sortOrder: 9,
  },
  {
    id: "FLUIDES_FRIGORIGENES",
    label: "Fluides Frigorigènes",
    description: "Contrôle F-Gas pour PAC et groupes froids",
    sortOrder: 10,
  },
  {
    id: "EQUIPEMENTS_PRESSION",
    label: "Équipements sous Pression",
    description: "Inspections périodiques et requalifications",
    sortOrder: 11,
  },
  {
    id: "ELECTRICITE",
    label: "Électricité",
    description: "Vérifications électriques et thermographie",
    sortOrder: 12,
  },
  {
    id: "CUVES_FIOUL",
    label: "Cuves Fioul",
    description: "Contrôle étanchéité cuves",
    sortOrder: 13,
  },
  {
    id: "REGULATION_GTC",
    label: "Régulation / GTC",
    description: "Automates, sondes et programmation",
    sortOrder: 14,
  },
  {
    id: "POMPES_CIRCULATEURS",
    label: "Pompes et Circulateurs",
    description: "État et fonctionnement des pompes",
    sortOrder: 15,
  },
  {
    id: "COMPTAGE_ENERGIE",
    label: "Comptage Énergie",
    description: "Compteurs et métrologie",
    sortOrder: 16,
  },
  {
    id: "SIGNALETIQUE",
    label: "Signalétique et Repérage",
    description: "Étiquetage et schémas",
    sortOrder: 17,
  },
  {
    id: "AFFICHAGE_OBLIGATOIRE",
    label: "Affichage Obligatoire",
    description: "Consignes de sécurité, schémas, plans",
    sortOrder: 18,
  },
  {
    id: "ECLAIRAGE",
    label: "Éclairage Chaufferie",
    description: "Éclairage normal et de sécurité",
    sortOrder: 19,
  },
  {
    id: "DOCUMENTATION",
    label: "Documentation",
    description: "Dossiers techniques et attestations",
    sortOrder: 20,
  },
  {
    id: "ETAT_GENERAL",
    label: "État Général",
    description: "Propreté, fuites, corrosion, sol, température",
    sortOrder: 21,
  },
];

// ============================================================================
// POINTS DE CONTRÔLE
// ============================================================================

export const CHECKPOINTS: CheckpointDefinition[] = [
  // -------------------------------------------------------------------------
  // SÉCURITÉ & LOCAL
  // -------------------------------------------------------------------------
  {
    id: "acces_chaufferie",
    label: "Accès chaufferie",
    category: "SECURITE_LOCAL",
    description: "Porte coupe-feu, ouverture vers extérieur, ferme-porte",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "L'accès à la chaufferie est conforme : porte coupe-feu avec ferme-porte opérationnel, ouverture vers l'extérieur." },
      { id: "porte_non_cf", label: "Porte non coupe-feu", isConform: false, reportText: "La porte d'accès à la chaufferie n'est pas coupe-feu (CF 2h ou EI120 requis)." },
      { id: "ferme_porte_hs", label: "Ferme-porte HS", isConform: false, reportText: "Le ferme-porte de la chaufferie est hors service ou absent." },
      { id: "ouverture_interieur", label: "Ouverture vers intérieur", isConform: false, reportText: "La porte de la chaufferie s'ouvre vers l'intérieur au lieu de l'extérieur." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 23/02/2018",
    sortOrder: 1,
  },
  {
    id: "coupure_urgence_elec",
    label: "Coupure d'urgence électrique",
    category: "SECURITE_LOCAL",
    description: "Arrêt d'urgence accessible depuis l'extérieur",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Présent et accessible", isConform: true, reportText: "L'arrêt d'urgence électrique est présent et accessible depuis l'extérieur ou à proximité immédiate de l'accès." },
      { id: "absent", label: "Absent", isConform: false, reportText: "L'arrêt d'urgence électrique est absent." },
      { id: "non_accessible", label: "Non accessible", isConform: false, reportText: "L'arrêt d'urgence électrique existe mais n'est pas accessible depuis l'extérieur." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "CCH Art. CH 6",
    sortOrder: 2,
  },
  {
    id: "coupure_urgence_gaz",
    label: "Coupure d'urgence gaz",
    category: "SECURITE_LOCAL",
    description: "Vanne de barrage générale accessible, signalée",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Présente et accessible", isConform: true, reportText: "La vanne de coupure gaz est présente, accessible depuis l'extérieur, signalée et manœuvrable." },
      { id: "absente", label: "Absente", isConform: false, reportText: "La vanne de coupure gaz générale est absente." },
      { id: "non_signalee", label: "Non signalée", isConform: false, reportText: "La vanne de coupure gaz n'est pas signalée." },
      { id: "non_manouvrable", label: "Non manœuvrable", isConform: false, reportText: "La vanne de coupure gaz est bloquée ou difficilement manœuvrable." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 23/02/2018",
    applicableConditions: ["HAS_GAS"],
    sortOrder: 3,
  },
  {
    id: "extincteurs",
    label: "Moyens d'extinction",
    category: "SECURITE_LOCAL",
    description: "Extincteurs adaptés et à jour de contrôle",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Les extincteurs sont présents, adaptés (Poudre ABC) et à jour de contrôle (< 1 an)." },
      { id: "perime", label: "Contrôle périmé", isConform: false, reportText: "Les extincteurs sont présents mais le contrôle annuel est périmé." },
      { id: "absents", label: "Absents", isConform: false, reportText: "Aucun extincteur présent dans la chaufferie." },
      { id: "non_adaptes", label: "Non adaptés", isConform: false, reportText: "Les extincteurs présents ne sont pas adaptés au type de risque." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Code du Travail / ERP",
    periodicity: "Annuel",
    sortOrder: 4,
  },
  {
    id: "proprete_stockage",
    label: "Propreté et stockage",
    category: "SECURITE_LOCAL",
    description: "Absence de matériaux combustibles",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "La chaufferie est propre, sans stockage de matériaux combustibles." },
      { id: "stockage_present", label: "Stockage présent", isConform: false, reportText: "Présence de stockage de matériaux combustibles (cartons, palettes, produits) dans la chaufferie." },
      { id: "encombrement", label: "Encombrement", isConform: false, reportText: "La chaufferie est encombrée, accès aux équipements difficile." },
    ],
    regulatoryRef: "RSDT",
    sortOrder: 5,
  },
  {
    id: "isolation_parois",
    label: "Isolation / Flocage",
    category: "SECURITE_LOCAL",
    description: "État de l'isolation thermique des parois",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Bon état", isConform: true, reportText: "L'isolation thermique des parois et plafonds est en bon état." },
      { id: "degrade", label: "Dégradé", isConform: false, reportText: "L'isolation thermique est dégradée (flocage qui tombe, décollement)." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Pas d'isolation thermique alors que nécessaire." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 6,
  },

  // -------------------------------------------------------------------------
  // AÉRATION ET VENTILATION
  // -------------------------------------------------------------------------
  {
    id: "ventilation_basse",
    label: "Ventilation basse (amenée d'air)",
    category: "AERATION_VENTILATION",
    description: "Présente, non obstruée, dimensionnée",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "La ventilation basse est présente, non obstruée et correctement dimensionnée selon la puissance installée." },
      { id: "obstruee", label: "Obstruée", isConform: false, reportText: "La ventilation basse est obstruée." },
      { id: "sous_dimensionnee", label: "Sous-dimensionnée", isConform: false, reportText: "La ventilation basse est sous-dimensionnée par rapport à la puissance installée." },
      { id: "absente", label: "Absente", isConform: false, reportText: "La ventilation basse est absente." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 23/02/2018",
    sortOrder: 10,
  },
  {
    id: "ventilation_haute",
    label: "Ventilation haute (sortie d'air)",
    category: "AERATION_VENTILATION",
    description: "En partie haute, débouchant à l'extérieur",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "La ventilation haute est présente en partie haute, débouche à l'extérieur et n'est pas obstruée." },
      { id: "obstruee", label: "Obstruée", isConform: false, reportText: "La ventilation haute est obstruée." },
      { id: "mal_positionnee", label: "Mal positionnée", isConform: false, reportText: "La ventilation haute n'est pas positionnée en partie haute." },
      { id: "absente", label: "Absente", isConform: false, reportText: "La ventilation haute est absente." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 23/02/2018",
    sortOrder: 11,
  },
  {
    id: "vmc_gaz_dsc",
    label: "VMC Gaz - DSC",
    category: "AERATION_VENTILATION",
    description: "Dispositif de Sécurité Collective présent",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "DSC présent et fonctionnel", isConform: true, reportText: "Le Dispositif de Sécurité Collective (DSC) est présent et fonctionnel." },
      { id: "absent", label: "DSC absent", isConform: false, reportText: "Le Dispositif de Sécurité Collective (DSC) est absent alors que la chaufferie est en VMC gaz." },
      { id: "hs", label: "DSC hors service", isConform: false, reportText: "Le Dispositif de Sécurité Collective (DSC) est hors service." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 30/05/1989",
    applicableConditions: ["HAS_VMC_GAZ"],
    sortOrder: 12,
  },

  // -------------------------------------------------------------------------
  // CHAUDIÈRES ET BRÛLEURS
  // -------------------------------------------------------------------------
  {
    id: "entretien_chaudiere",
    label: "Entretien annuel chaudière",
    category: "CHAUDIERES_BRULEURS",
    description: "Chaudières 4-400 kW",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "L'entretien annuel de la chaudière a été réalisé dans les délais." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "L'entretien annuel de la chaudière n'a pas été réalisé dans les délais (> 1 an)." },
      { id: "non_realise", label: "Non réalisé", isConform: false, reportText: "Aucun entretien de chaudière n'a été réalisé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Décret 2009-649",
    periodicity: "Annuel",
    sortOrder: 20,
  },
  {
    id: "controle_rendement_400kw",
    label: "Contrôle rendement chaudière > 400 kW",
    category: "CHAUDIERES_BRULEURS",
    description: "Contrôle bisannuel pour chaudières > 400 kW",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle de rendement de la chaudière > 400 kW a été réalisé dans les délais." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle de rendement de la chaudière > 400 kW est périmé (> 2 ans)." },
      { id: "non_realise", label: "Non réalisé", isConform: false, reportText: "Le contrôle de rendement n'a jamais été réalisé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 2 octobre 2009",
    periodicity: "Tous les 2 ans",
    applicableConditions: ["POWER_GT_400KW"],
    sortOrder: 21,
  },
  {
    id: "ramonage",
    label: "Ramonage conduits de fumée",
    category: "CHAUDIERES_BRULEURS",
    description: "2 fois/an dont 1 en période de chauffe",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le ramonage des conduits de fumée a été réalisé conformément à la réglementation." },
      { id: "partiel", label: "Partiel", isConform: false, reportText: "Un seul ramonage a été réalisé sur les deux requis." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le ramonage n'a pas été réalisé dans les délais." },
      { id: "non_realise", label: "Non réalisé", isConform: false, reportText: "Aucun ramonage n'a été réalisé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Règlement sanitaire départemental",
    periodicity: "2 fois/an",
    sortOrder: 22,
  },
  {
    id: "analyse_combustion",
    label: "Analyse de combustion",
    category: "CHAUDIERES_BRULEURS",
    description: "Mesures O2, CO2, CO, température fumées, rendement",
    responseType: "YES_NO_VALUES",
    findings: [
      { id: "conforme", label: "Valeurs conformes", isConform: true, reportText: "L'analyse de combustion montre des valeurs conformes." },
      { id: "non_conforme", label: "Valeurs non conformes", isConform: false, reportText: "L'analyse de combustion révèle des valeurs hors normes." },
      { id: "non_realise", label: "Non réalisée", isConform: false, reportText: "L'analyse de combustion n'a pas été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    valueFields: [
      { key: "o2", label: "O2", unit: "%", type: "number", thresholdMin: 3, thresholdMax: 6 },
      { key: "co2", label: "CO2", unit: "%", type: "number", thresholdMin: 8, thresholdMax: 12 },
      { key: "co", label: "CO", unit: "ppm", type: "number", thresholdMax: 100 },
      { key: "temp_fumees", label: "T° fumées", unit: "°C", type: "number", thresholdMax: 250 },
      { key: "rendement", label: "Rendement", unit: "%", type: "number", thresholdMin: 90 },
    ],
    regulatoryRef: "Arrêté 15 septembre 2009",
    periodicity: "Annuel",
    sortOrder: 23,
  },

  // -------------------------------------------------------------------------
  // INSTALLATIONS GAZ
  // -------------------------------------------------------------------------
  {
    id: "etancheite_gaz",
    label: "Étanchéité installation gaz",
    category: "INSTALLATIONS_GAZ",
    description: "Vérification annuelle étanchéité",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "La vérification d'étanchéité de l'installation gaz a été réalisée et est conforme." },
      { id: "fuite_detectee", label: "Fuite détectée", isConform: false, reportText: "Une fuite a été détectée sur l'installation gaz." },
      { id: "perime", label: "Contrôle périmé", isConform: false, reportText: "La vérification d'étanchéité gaz est périmée (> 1 an)." },
      { id: "non_realise", label: "Non réalisé", isConform: false, reportText: "Aucune vérification d'étanchéité gaz n'a été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 2 août 1977",
    periodicity: "Annuel",
    applicableConditions: ["HAS_GAS"],
    sortOrder: 30,
  },
  {
    id: "detection_gaz",
    label: "Contrôle détection gaz",
    category: "INSTALLATIONS_GAZ",
    description: "Si détection installée",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle de la détection gaz a été réalisé et l'installation est fonctionnelle." },
      { id: "perime", label: "Contrôle périmé", isConform: false, reportText: "Le contrôle de la détection gaz est périmé." },
      { id: "hs", label: "Détection HS", isConform: false, reportText: "La détection gaz est hors service." },
      { id: "absente", label: "Absente (si obligatoire)", isConform: false, reportText: "La détection gaz est absente alors qu'elle est obligatoire." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "NF C 15-100",
    periodicity: "Annuel",
    applicableConditions: ["HAS_GAS_DETECTION"],
    sortOrder: 31,
  },
  {
    id: "certificat_conformite_gaz",
    label: "Certificat de conformité gaz",
    category: "INSTALLATIONS_GAZ",
    description: "Après travaux sur installation gaz",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present", label: "Présent", isConform: true, reportText: "Le certificat de conformité gaz (Qualigaz) est présent." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le certificat de conformité gaz est absent après travaux." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Qualigaz",
    sortOrder: 32,
  },

  // -------------------------------------------------------------------------
  // CIRCUIT HYDRAULIQUE & EAU
  // -------------------------------------------------------------------------
  {
    id: "disconnecteur",
    label: "Disconnexion (protection réseau)",
    category: "CIRCUIT_HYDRAULIQUE",
    description: "Disconnecteur BA si P>70kW, CA/CB si P<70kW",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le disconnecteur est présent, adapté et vérifié annuellement." },
      { id: "perime", label: "Vérification périmée", isConform: false, reportText: "La vérification annuelle du disconnecteur est périmée." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le disconnecteur est absent ou non adapté à la puissance." },
      { id: "non_adapte", label: "Type non adapté", isConform: false, reportText: "Le type de disconnecteur n'est pas adapté à la puissance (BA requis si >70kW)." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "RSDT / Code Santé Publique",
    periodicity: "Annuel",
    sortOrder: 40,
  },
  {
    id: "soupapes_securite",
    label: "Soupapes de sécurité",
    category: "CIRCUIT_HYDRAULIQUE",
    description: "Présence, raccordement égout, tarage",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conformes", isConform: true, reportText: "Les soupapes de sécurité sont présentes sur chaque générateur, correctement tarées et raccordées à l'égout." },
      { id: "non_raccordees", label: "Non raccordées égout", isConform: false, reportText: "Les soupapes de sécurité ne sont pas raccordées à l'égout (crachement au sol)." },
      { id: "tarage_incorrect", label: "Tarage incorrect", isConform: false, reportText: "Le tarage des soupapes est incorrect ou non vérifié." },
      { id: "absentes", label: "Absentes", isConform: false, reportText: "Des soupapes de sécurité sont absentes." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "DESP",
    sortOrder: 41,
  },
  {
    id: "vases_expansion",
    label: "Vases d'expansion",
    category: "CIRCUIT_HYDRAULIQUE",
    description: "Raccordement sans vanne d'isolement",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conformes", isConform: true, reportText: "Les vases d'expansion sont raccordés sans vanne d'isolement (ou vanne verrouillée ouverte)." },
      { id: "vanne_isolement", label: "Vanne d'isolement présente", isConform: false, reportText: "Les vases d'expansion sont raccordés via une vanne d'isolement non verrouillée." },
      { id: "pression_incorrecte", label: "Pression gonflage incorrecte", isConform: false, reportText: "La pression de gonflage des vases d'expansion est incorrecte." },
      { id: "sous_dimensionnes", label: "Sous-dimensionnés", isConform: false, reportText: "Les vases d'expansion sont sous-dimensionnés." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "DTU 65.11",
    sortOrder: 42,
  },
  {
    id: "calorifugeage",
    label: "Calorifugeage tuyauteries",
    category: "CIRCUIT_HYDRAULIQUE",
    description: "Isolation des tuyauteries",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "Les tuyauteries sont correctement calorifugées (Classe 2 minimum)." },
      { id: "partiel", label: "Partiel", isConform: false, reportText: "Le calorifugeage des tuyauteries est partiel ou incomplet." },
      { id: "degrade", label: "Dégradé", isConform: false, reportText: "Le calorifugeage est dégradé (déchirures, manques)." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Les tuyauteries ne sont pas calorifugées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "RT Existant",
    sortOrder: 43,
  },

  // -------------------------------------------------------------------------
  // TRAITEMENT D'EAU
  // -------------------------------------------------------------------------
  {
    id: "adoucisseur",
    label: "Adoucisseur",
    category: "TRAITEMENT_EAU",
    description: "Présence et fonctionnement",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Présent et fonctionnel", isConform: true, reportText: "L'adoucisseur est présent et fonctionnel." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "L'adoucisseur est hors service." },
      { id: "absent", label: "Absent (si nécessaire)", isConform: false, reportText: "L'adoucisseur est absent alors que la dureté de l'eau le nécessite." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 50,
  },
  {
    id: "th_eau",
    label: "Dureté de l'eau (TH)",
    category: "TRAITEMENT_EAU",
    description: "Mesure TH entrée/sortie adoucisseur",
    responseType: "YES_NO_VALUES",
    findings: [
      { id: "conforme", label: "Valeurs conformes", isConform: true, reportText: "La dureté de l'eau est conforme aux recommandations." },
      { id: "non_conforme", label: "Valeurs non conformes", isConform: false, reportText: "La dureté de l'eau est hors normes." },
      { id: "non_mesure", label: "Non mesuré", isConform: false, reportText: "La dureté de l'eau n'a pas été mesurée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    valueFields: [
      { key: "th_entree", label: "TH entrée", unit: "°f", type: "number" },
      { key: "th_sortie", label: "TH sortie", unit: "°f", type: "number", thresholdMax: 15 },
    ],
    sortOrder: 51,
  },
  {
    id: "pot_boues",
    label: "Pot à boues / Séparateur",
    category: "TRAITEMENT_EAU",
    description: "Présence, positionnement, calorifuge, manomètres",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "Le pot à boues est présent, correctement positionné, calorifugé avec manomètres amont/aval." },
      { id: "sans_manometres", label: "Sans manomètres", isConform: false, reportText: "Le pot à boues n'a pas de manomètres amont/aval pour contrôler l'encrassement." },
      { id: "non_calorifuge", label: "Non calorifugé", isConform: false, reportText: "Le pot à boues n'est pas calorifugé." },
      { id: "mal_positionne", label: "Mal positionné", isConform: false, reportText: "Le pot à boues est mal positionné sur le circuit." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le pot à boues est absent." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 52,
  },
  {
    id: "desembouage",
    label: "Désembouage",
    category: "TRAITEMENT_EAU",
    description: "Réalisé ou prévu",
    responseType: "STATUS_DATE",
    findings: [
      { id: "realise", label: "Réalisé", isConform: true, reportText: "Un désembouage a été réalisé récemment." },
      { id: "necessaire", label: "Nécessaire", isConform: false, reportText: "Un désembouage est nécessaire (embouage constaté)." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 53,
  },
  {
    id: "analyse_eau",
    label: "Analyse qualité eau",
    category: "TRAITEMENT_EAU",
    description: "pH, conductivité",
    responseType: "YES_NO_VALUES",
    findings: [
      { id: "conforme", label: "Valeurs conformes", isConform: true, reportText: "Les paramètres de qualité de l'eau sont conformes." },
      { id: "non_conforme", label: "Valeurs non conformes", isConform: false, reportText: "Les paramètres de qualité de l'eau sont hors normes." },
      { id: "non_realise", label: "Non réalisée", isConform: false, reportText: "L'analyse de qualité de l'eau n'a pas été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    valueFields: [
      { key: "ph", label: "pH", type: "number", thresholdMin: 7, thresholdMax: 9 },
      { key: "conductivite", label: "Conductivité", unit: "µS/cm", type: "number" },
    ],
    sortOrder: 54,
  },

  // -------------------------------------------------------------------------
  // SÉCURITÉ PRESSION/TEMPÉRATURE
  // -------------------------------------------------------------------------
  {
    id: "thermostats_securite",
    label: "Thermostats de sécurité",
    category: "SECURITE_PRESSION",
    description: "Présence et fonctionnement",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnels", isConform: true, reportText: "Les thermostats de sécurité sont présents et fonctionnels." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "Des thermostats de sécurité sont hors service." },
      { id: "absents", label: "Absents", isConform: false, reportText: "Des thermostats de sécurité sont absents." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 60,
  },
  {
    id: "pressostats",
    label: "Pressostats",
    category: "SECURITE_PRESSION",
    description: "Présence et fonctionnement",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnels", isConform: true, reportText: "Les pressostats sont présents et fonctionnels." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "Des pressostats sont hors service." },
      { id: "absents", label: "Absents", isConform: false, reportText: "Des pressostats sont absents." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 61,
  },
  {
    id: "limiteurs_temperature",
    label: "Limiteurs de température",
    category: "SECURITE_PRESSION",
    description: "ECS et chauffage",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnels", isConform: true, reportText: "Les limiteurs de température sont présents et fonctionnels." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "Des limiteurs de température sont hors service." },
      { id: "absents", label: "Absents", isConform: false, reportText: "Des limiteurs de température sont absents." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 62,
  },

  // -------------------------------------------------------------------------
  // ECS & LÉGIONELLES
  // -------------------------------------------------------------------------
  {
    id: "temp_stockage_ecs",
    label: "Température stockage ECS",
    category: "ECS_LEGIONELLES",
    description: "≥ 60°C",
    responseType: "YES_NO_VALUES",
    findings: [
      { id: "conforme", label: "≥ 60°C", isConform: true, reportText: "La température de stockage ECS est conforme (≥ 60°C)." },
      { id: "non_conforme", label: "< 60°C", isConform: false, reportText: "La température de stockage ECS est inférieure à 60°C (risque légionelles)." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    valueFields: [
      { key: "temp_stockage", label: "T° stockage", unit: "°C", type: "number", thresholdMin: 60 },
    ],
    regulatoryRef: "Arrêté 1er février 2010",
    sortOrder: 70,
  },
  {
    id: "temp_bouclage_ecs",
    label: "Température bouclage ECS",
    category: "ECS_LEGIONELLES",
    description: "≥ 55°C",
    responseType: "YES_NO_VALUES",
    findings: [
      { id: "conforme", label: "≥ 55°C", isConform: true, reportText: "La température de bouclage ECS est conforme (≥ 55°C)." },
      { id: "non_conforme", label: "< 55°C", isConform: false, reportText: "La température de bouclage ECS est inférieure à 55°C (risque légionelles)." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    valueFields: [
      { key: "temp_bouclage", label: "T° bouclage", unit: "°C", type: "number", thresholdMin: 55 },
    ],
    regulatoryRef: "Arrêté 1er février 2010",
    sortOrder: 71,
  },
  {
    id: "analyse_legionelles",
    label: "Analyses légionelles",
    category: "ECS_LEGIONELLES",
    description: "Selon type de bâtiment",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour et conformes", isConform: true, reportText: "Les analyses légionelles sont à jour et conformes." },
      { id: "non_conforme", label: "Résultats non conformes", isConform: false, reportText: "Les analyses légionelles révèlent des résultats non conformes." },
      { id: "perime", label: "Analyses périmées", isConform: false, reportText: "Les analyses légionelles ne sont pas à jour." },
      { id: "non_realise", label: "Non réalisées", isConform: false, reportText: "Les analyses légionelles n'ont pas été réalisées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Code de la santé publique",
    periodicity: "Selon bâtiment",
    sortOrder: 72,
  },
  {
    id: "carnet_sanitaire",
    label: "Carnet sanitaire ECS",
    category: "ECS_LEGIONELLES",
    description: "Tenu à jour",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le carnet sanitaire ECS est tenu à jour." },
      { id: "incomplet", label: "Incomplet", isConform: false, reportText: "Le carnet sanitaire ECS est incomplet ou mal tenu." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le carnet sanitaire ECS est absent." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 1er février 2010",
    sortOrder: 73,
  },

  // -------------------------------------------------------------------------
  // FLUIDES FRIGORIGÈNES
  // -------------------------------------------------------------------------
  {
    id: "controle_fgas_5tco2",
    label: "Contrôle étanchéité < 5 TCO2",
    category: "FLUIDES_FRIGORIGENES",
    description: "Annuel",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle d'étanchéité F-Gas est à jour." },
      { id: "fuite_detectee", label: "Fuite détectée", isConform: false, reportText: "Une fuite de fluide frigorigène a été détectée." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle d'étanchéité F-Gas est périmé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Règlement F-Gas 517/2014",
    periodicity: "Annuel",
    applicableConditions: ["HAS_FGAS_LT_5TCO2"],
    sortOrder: 80,
  },
  {
    id: "controle_fgas_5_50tco2",
    label: "Contrôle étanchéité 5-50 TCO2",
    category: "FLUIDES_FRIGORIGENES",
    description: "Semestriel",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle d'étanchéité F-Gas est à jour." },
      { id: "fuite_detectee", label: "Fuite détectée", isConform: false, reportText: "Une fuite de fluide frigorigène a été détectée." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle d'étanchéité F-Gas est périmé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Règlement F-Gas 517/2014",
    periodicity: "Semestriel",
    applicableConditions: ["HAS_FGAS_5_50TCO2"],
    sortOrder: 81,
  },
  {
    id: "controle_fgas_50tco2",
    label: "Contrôle étanchéité > 50 TCO2",
    category: "FLUIDES_FRIGORIGENES",
    description: "Trimestriel",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle d'étanchéité F-Gas est à jour." },
      { id: "fuite_detectee", label: "Fuite détectée", isConform: false, reportText: "Une fuite de fluide frigorigène a été détectée." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle d'étanchéité F-Gas est périmé." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Règlement F-Gas 517/2014",
    periodicity: "Trimestriel",
    applicableConditions: ["HAS_FGAS_GT_50TCO2"],
    sortOrder: 82,
  },

  // -------------------------------------------------------------------------
  // ÉQUIPEMENTS SOUS PRESSION
  // -------------------------------------------------------------------------
  {
    id: "inspection_vases_pression",
    label: "Inspection vases > 0.5 bar",
    category: "EQUIPEMENTS_PRESSION",
    description: "Tous les 40 mois",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "L'inspection périodique des vases d'expansion > 0.5 bar est à jour." },
      { id: "perime", label: "Périmée", isConform: false, reportText: "L'inspection périodique est périmée (> 40 mois)." },
      { id: "non_realise", label: "Non réalisée", isConform: false, reportText: "L'inspection périodique n'a jamais été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 20 novembre 2017",
    periodicity: "40 mois",
    sortOrder: 90,
  },
  {
    id: "requalification_esp",
    label: "Requalification ESP",
    category: "EQUIPEMENTS_PRESSION",
    description: "Tous les 10 ans",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "La requalification des équipements sous pression est à jour." },
      { id: "perime", label: "Périmée", isConform: false, reportText: "La requalification est périmée (> 10 ans)." },
      { id: "non_realise", label: "Non réalisée", isConform: false, reportText: "La requalification n'a jamais été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 20 novembre 2017",
    periodicity: "10 ans",
    sortOrder: 91,
  },

  // -------------------------------------------------------------------------
  // ÉLECTRICITÉ
  // -------------------------------------------------------------------------
  {
    id: "verif_elec_erp",
    label: "Vérification électrique ERP",
    category: "ELECTRICITE",
    description: "Annuelle",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "La vérification électrique ERP est à jour et conforme." },
      { id: "non_conformite", label: "Non-conformités relevées", isConform: false, reportText: "La vérification électrique a relevé des non-conformités." },
      { id: "perime", label: "Périmée", isConform: false, reportText: "La vérification électrique est périmée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 25 juin 1980",
    periodicity: "Annuel",
    applicableConditions: ["IS_ERP"],
    sortOrder: 100,
  },
  {
    id: "verif_elec_ert",
    label: "Vérification électrique ERT",
    category: "ELECTRICITE",
    description: "Annuelle",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "La vérification électrique ERT est à jour et conforme." },
      { id: "non_conformite", label: "Non-conformités relevées", isConform: false, reportText: "La vérification électrique a relevé des non-conformités." },
      { id: "perime", label: "Périmée", isConform: false, reportText: "La vérification électrique est périmée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Code du travail R4226",
    periodicity: "Annuel",
    applicableConditions: ["IS_ERT"],
    sortOrder: 101,
  },
  {
    id: "thermographie",
    label: "Thermographie infrarouge",
    category: "ELECTRICITE",
    description: "Recommandée",
    responseType: "STATUS_DATE",
    findings: [
      { id: "realise", label: "Réalisée", isConform: true, reportText: "Une thermographie infrarouge a été réalisée récemment." },
      { id: "anomalies", label: "Anomalies détectées", isConform: false, reportText: "La thermographie a révélé des anomalies." },
      { id: "non_realise", label: "Non réalisée", isConform: false, reportText: "Aucune thermographie n'a été réalisée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 102,
  },

  // -------------------------------------------------------------------------
  // CUVES FIOUL
  // -------------------------------------------------------------------------
  {
    id: "cuve_fioul_aerienne",
    label: "Étanchéité cuve fioul aérienne",
    category: "CUVES_FIOUL",
    description: "Tous les 10 ans",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle d'étanchéité de la cuve fioul aérienne est à jour." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle d'étanchéité de la cuve fioul est périmé (> 10 ans)." },
      { id: "fuite", label: "Fuite détectée", isConform: false, reportText: "Une fuite a été détectée sur la cuve fioul." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Législation ICPE",
    periodicity: "10 ans",
    applicableConditions: ["HAS_FIOUL_AERIEN"],
    sortOrder: 110,
  },
  {
    id: "cuve_fioul_enterree",
    label: "Étanchéité cuve fioul enterrée",
    category: "CUVES_FIOUL",
    description: "Tous les 5 ans",
    responseType: "STATUS_DATE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le contrôle d'étanchéité de la cuve fioul enterrée est à jour." },
      { id: "perime", label: "Périmé", isConform: false, reportText: "Le contrôle d'étanchéité de la cuve fioul est périmé (> 5 ans)." },
      { id: "fuite", label: "Fuite détectée", isConform: false, reportText: "Une fuite a été détectée sur la cuve fioul." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Législation ICPE",
    periodicity: "5 ans",
    applicableConditions: ["HAS_FIOUL_ENTERRE"],
    sortOrder: 111,
  },

  // -------------------------------------------------------------------------
  // RÉGULATION / GTC
  // -------------------------------------------------------------------------
  {
    id: "automate_regulation",
    label: "Automate de régulation",
    category: "REGULATION_GTC",
    description: "En service et fonctionnel",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnel", isConform: true, reportText: "L'automate de régulation est en service et fonctionnel." },
      { id: "defaut", label: "Défaut signalé", isConform: false, reportText: "L'automate de régulation présente un défaut." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "L'automate de régulation est hors service." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 120,
  },
  {
    id: "sondes_temperature",
    label: "Sondes de température",
    category: "REGULATION_GTC",
    description: "Départ, retour, extérieur",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnelles", isConform: true, reportText: "Les sondes de température (départ, retour, extérieur) sont fonctionnelles." },
      { id: "defaillante", label: "Sonde défaillante", isConform: false, reportText: "Une ou plusieurs sondes de température sont défaillantes." },
      { id: "absente", label: "Sonde absente", isConform: false, reportText: "Une sonde de température est absente." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 121,
  },
  {
    id: "programmation_horaire",
    label: "Programmation horaire",
    category: "REGULATION_GTC",
    description: "Configurée et adaptée",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Configurée", isConform: true, reportText: "La programmation horaire est configurée et adaptée au bâtiment." },
      { id: "non_adaptee", label: "Non adaptée", isConform: false, reportText: "La programmation horaire n'est pas adaptée aux besoins." },
      { id: "absente", label: "Absente", isConform: false, reportText: "Pas de programmation horaire configurée." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 122,
  },
  {
    id: "alarmes_gtc",
    label: "Alarmes et reports",
    category: "REGULATION_GTC",
    description: "Configuration des alarmes",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Configurées", isConform: true, reportText: "Les alarmes sont configurées et les reports actifs." },
      { id: "non_conforme", label: "Non configurées", isConform: false, reportText: "Les alarmes ne sont pas correctement configurées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 123,
  },

  // -------------------------------------------------------------------------
  // POMPES ET CIRCULATEURS
  // -------------------------------------------------------------------------
  {
    id: "etat_pompes",
    label: "État des pompes",
    category: "POMPES_CIRCULATEURS",
    description: "Fonctionnement, bruit, fuites",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Bon état", isConform: true, reportText: "Les pompes et circulateurs sont en bon état de fonctionnement." },
      { id: "bruit_anormal", label: "Bruit anormal", isConform: false, reportText: "Un bruit anormal est constaté sur une ou plusieurs pompes." },
      { id: "fuite", label: "Fuite", isConform: false, reportText: "Une fuite est constatée sur une pompe." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "Une ou plusieurs pompes sont hors service." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 130,
  },
  {
    id: "variateur_vitesse",
    label: "Variateur de vitesse",
    category: "POMPES_CIRCULATEURS",
    description: "Si installé",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnel", isConform: true, reportText: "Le variateur de vitesse est fonctionnel." },
      { id: "defaut", label: "En défaut", isConform: false, reportText: "Le variateur de vitesse est en défaut." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "Le variateur de vitesse est hors service." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 131,
  },

  // -------------------------------------------------------------------------
  // COMPTAGE ÉNERGIE
  // -------------------------------------------------------------------------
  {
    id: "compteurs_energie",
    label: "Compteurs d'énergie",
    category: "COMPTAGE_ENERGIE",
    description: "Présence et relevés",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present_releve", label: "Présents et relevés", isConform: true, reportText: "Les compteurs d'énergie sont présents et les relevés sont effectués." },
      { id: "present_non_releve", label: "Présents non relevés", isConform: false, reportText: "Les compteurs sont présents mais les relevés ne sont pas effectués." },
      { id: "absents", label: "Absents", isConform: false, reportText: "Les compteurs d'énergie sont absents." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 140,
  },
  {
    id: "telereleve",
    label: "Télérelève",
    category: "COMPTAGE_ENERGIE",
    description: "Si installée",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnelle", isConform: true, reportText: "La télérelève est fonctionnelle." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "La télérelève est hors service." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 141,
  },

  // -------------------------------------------------------------------------
  // SIGNALÉTIQUE ET REPÉRAGE
  // -------------------------------------------------------------------------
  {
    id: "etiquetage_tuyauteries",
    label: "Étiquetage tuyauteries",
    category: "SIGNALETIQUE",
    description: "Couleurs NF",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme NF", isConform: true, reportText: "L'étiquetage des tuyauteries est conforme aux normes NF." },
      { id: "partiel", label: "Partiel", isConform: false, reportText: "L'étiquetage des tuyauteries est partiel ou incomplet." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Les tuyauteries ne sont pas étiquetées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 150,
  },
  {
    id: "schema_principe",
    label: "Schéma de principe",
    category: "SIGNALETIQUE",
    description: "Affiché en chaufferie",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present_jour", label: "Présent et à jour", isConform: true, reportText: "Le schéma de principe est affiché et à jour." },
      { id: "present_obsolete", label: "Présent mais obsolète", isConform: false, reportText: "Le schéma de principe est affiché mais obsolète." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le schéma de principe n'est pas affiché." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 151,
  },
  {
    id: "reperage_vannes",
    label: "Repérage des vannes",
    category: "SIGNALETIQUE",
    description: "Identification claire",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Repérées", isConform: true, reportText: "Les vannes sont correctement repérées et identifiées." },
      { id: "partiel", label: "Partiel", isConform: false, reportText: "Le repérage des vannes est partiel." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Les vannes ne sont pas repérées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 152,
  },

  // -------------------------------------------------------------------------
  // AFFICHAGE OBLIGATOIRE
  // -------------------------------------------------------------------------
  {
    id: "consignes_securite",
    label: "Consignes de sécurité",
    category: "AFFICHAGE_OBLIGATOIRE",
    description: "Procédures d'urgence, numéros d'appel",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "presentes", label: "Présentes et visibles", isConform: true, reportText: "Les consignes de sécurité sont affichées et visibles." },
      { id: "incompletes", label: "Incomplètes", isConform: false, reportText: "Les consignes de sécurité sont incomplètes." },
      { id: "absentes", label: "Absentes", isConform: false, reportText: "Les consignes de sécurité ne sont pas affichées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 155,
  },
  {
    id: "schema_principe_affiche",
    label: "Schéma de principe affiché",
    category: "AFFICHAGE_OBLIGATOIRE",
    description: "Synoptique de l'installation à jour",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present_jour", label: "Présent et à jour", isConform: true, reportText: "Le schéma de principe est affiché et à jour." },
      { id: "present_obsolete", label: "Présent mais obsolète", isConform: false, reportText: "Le schéma de principe est affiché mais ne reflète pas l'installation actuelle." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le schéma de principe n'est pas affiché dans la chaufferie." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 156,
  },
  {
    id: "plan_intervention",
    label: "Plan d'intervention",
    category: "AFFICHAGE_OBLIGATOIRE",
    description: "Emplacement organes de coupure",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present", label: "Présent", isConform: true, reportText: "Le plan d'intervention avec emplacement des organes de coupure est affiché." },
      { id: "incomplet", label: "Incomplet", isConform: false, reportText: "Le plan d'intervention est incomplet." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le plan d'intervention n'est pas affiché." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 157,
  },
  {
    id: "interdiction_fumer",
    label: "Interdiction de fumer",
    category: "AFFICHAGE_OBLIGATOIRE",
    description: "Pictogramme normalisé",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present", label: "Présent", isConform: true, reportText: "Le pictogramme d'interdiction de fumer est affiché." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le pictogramme d'interdiction de fumer n'est pas affiché." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 158,
  },
  {
    id: "consignes_fuite_gaz",
    label: "Consignes en cas de fuite gaz",
    category: "AFFICHAGE_OBLIGATOIRE",
    description: "Affichage visible",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "presentes", label: "Présentes", isConform: true, reportText: "Les consignes en cas de fuite de gaz sont affichées et visibles." },
      { id: "absentes", label: "Absentes", isConform: false, reportText: "Les consignes en cas de fuite de gaz ne sont pas affichées." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Arrêté 2 août 1977",
    applicableConditions: ["HAS_GAS"],
    sortOrder: 159,
  },

  // -------------------------------------------------------------------------
  // ÉCLAIRAGE
  // -------------------------------------------------------------------------
  {
    id: "eclairage_normal",
    label: "Éclairage normal",
    category: "ECLAIRAGE",
    description: "Suffisant pour les interventions",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Suffisant", isConform: true, reportText: "L'éclairage normal de la chaufferie est suffisant." },
      { id: "insuffisant", label: "Insuffisant", isConform: false, reportText: "L'éclairage normal est insuffisant pour les interventions." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "L'éclairage normal est hors service." },
    ],
    sortOrder: 160,
  },
  {
    id: "eclairage_securite",
    label: "Éclairage de sécurité (BAES)",
    category: "ECLAIRAGE",
    description: "Présent et fonctionnel",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Fonctionnel", isConform: true, reportText: "L'éclairage de sécurité (BAES) est présent et fonctionnel." },
      { id: "hs", label: "Hors service", isConform: false, reportText: "L'éclairage de sécurité est hors service." },
      { id: "absent", label: "Absent", isConform: false, reportText: "L'éclairage de sécurité est absent." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 161,
  },

  // -------------------------------------------------------------------------
  // DOCUMENTATION
  // -------------------------------------------------------------------------
  {
    id: "carnet_chaufferie",
    label: "Carnet de chaufferie",
    category: "DOCUMENTATION",
    description: "Tenu à jour",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "a_jour", label: "À jour", isConform: true, reportText: "Le carnet de chaufferie est tenu à jour." },
      { id: "incomplet", label: "Incomplet", isConform: false, reportText: "Le carnet de chaufferie est incomplet ou mal tenu." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le carnet de chaufferie est absent." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 170,
  },
  {
    id: "livret_chaufferie",
    label: "Livret de chaufferie",
    category: "DOCUMENTATION",
    description: "Caractéristiques techniques",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "present", label: "Présent", isConform: true, reportText: "Le livret de chaufferie avec les caractéristiques techniques est présent." },
      { id: "incomplet", label: "Incomplet", isConform: false, reportText: "Le livret de chaufferie est incomplet." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le livret de chaufferie est absent." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 171,
  },
  {
    id: "attestations_entretien",
    label: "Attestations d'entretien",
    category: "DOCUMENTATION",
    description: "Conservées et accessibles",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "presentes", label: "Présentes", isConform: true, reportText: "Les attestations d'entretien et rapports de contrôle sont présents et accessibles." },
      { id: "incompletes", label: "Incomplètes", isConform: false, reportText: "Les attestations d'entretien sont incomplètes." },
      { id: "absentes", label: "Absentes", isConform: false, reportText: "Les attestations d'entretien sont absentes." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 172,
  },
  {
    id: "fds_produits",
    label: "FDS produits traitement",
    category: "DOCUMENTATION",
    description: "Fiches de données sécurité",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "presentes", label: "Présentes", isConform: true, reportText: "Les fiches de données sécurité des produits de traitement sont présentes." },
      { id: "absentes", label: "Absentes", isConform: false, reportText: "Les fiches de données sécurité sont absentes." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 173,
  },

  // -------------------------------------------------------------------------
  // ÉTAT GÉNÉRAL
  // -------------------------------------------------------------------------
  {
    id: "absence_fuites",
    label: "Absence de fuites",
    category: "ETAT_GENERAL",
    description: "Eau, gaz, fioul",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Pas de fuite", isConform: true, reportText: "Aucune fuite n'est constatée (eau, gaz, fioul)." },
      { id: "fuite_eau", label: "Fuite d'eau", isConform: false, reportText: "Une fuite d'eau est constatée." },
      { id: "fuite_gaz", label: "Fuite de gaz", isConform: false, reportText: "Une fuite de gaz est suspectée ou constatée." },
      { id: "fuite_fioul", label: "Fuite de fioul", isConform: false, reportText: "Une fuite de fioul est constatée." },
    ],
    sortOrder: 180,
  },
  {
    id: "corrosion",
    label: "Corrosion",
    category: "ETAT_GENERAL",
    description: "Sur équipements et tuyauteries",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "absente", label: "Absente", isConform: true, reportText: "Pas de trace de corrosion visible sur les équipements et tuyauteries." },
      { id: "legere", label: "Légère", isConform: false, reportText: "Des traces de corrosion légère sont visibles." },
      { id: "importante", label: "Importante", isConform: false, reportText: "Une corrosion importante est constatée." },
    ],
    sortOrder: 181,
  },
  {
    id: "traces_humidite",
    label: "Traces d'humidité",
    category: "ETAT_GENERAL",
    description: "Murs, plafond, sol",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "absentes", label: "Absentes", isConform: true, reportText: "Pas de trace d'humidité visible." },
      { id: "presentes", label: "Présentes", isConform: false, reportText: "Des traces d'humidité sont visibles." },
      { id: "importantes", label: "Importantes", isConform: false, reportText: "Des traces d'humidité importantes sont constatées." },
    ],
    sortOrder: 182,
  },
  {
    id: "proprete_generale",
    label: "Propreté générale",
    category: "ETAT_GENERAL",
    description: "Sol, équipements",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Propre", isConform: true, reportText: "La chaufferie est propre et bien entretenue." },
      { id: "a_ameliorer", label: "À améliorer", isConform: false, reportText: "La propreté de la chaufferie est à améliorer." },
      { id: "sale", label: "Sale", isConform: false, reportText: "La chaufferie est sale, un nettoyage est nécessaire." },
    ],
    sortOrder: 183,
  },
  {
    id: "sol_chaufferie",
    label: "Sol de la chaufferie",
    category: "ETAT_GENERAL",
    description: "Résistant, non glissant, siphon si risque de fuite d'eau",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "Le sol de la chaufferie est résistant, non glissant et équipé d'un siphon d'évacuation." },
      { id: "glissant", label: "Glissant", isConform: false, reportText: "Le sol de la chaufferie est glissant, risque de chute." },
      { id: "degrade", label: "Dégradé", isConform: false, reportText: "Le sol de la chaufferie est dégradé." },
      { id: "sans_siphon", label: "Sans siphon", isConform: false, reportText: "Le sol n'est pas équipé de siphon d'évacuation alors que le risque de fuite d'eau existe." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 184,
  },
  {
    id: "temperature_local",
    label: "Température du local",
    category: "ETAT_GENERAL",
    description: "Hors gel, ventilation suffisante pour éviter surchauffe",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme", isConform: true, reportText: "La température du local est conforme (hors gel, pas de surchauffe)." },
      { id: "risque_gel", label: "Risque de gel", isConform: false, reportText: "Le local présente un risque de gel (température insuffisante)." },
      { id: "surchauffe", label: "Surchauffe", isConform: false, reportText: "Le local est en surchauffe, la ventilation est insuffisante." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 185,
  },
  {
    id: "bac_retention",
    label: "Bac de rétention",
    category: "ETAT_GENERAL",
    description: "Obligatoire si stockage fioul ou produits chimiques",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Présent et adapté", isConform: true, reportText: "Le bac de rétention est présent et correctement dimensionné." },
      { id: "sous_dimensionne", label: "Sous-dimensionné", isConform: false, reportText: "Le bac de rétention est sous-dimensionné." },
      { id: "absent", label: "Absent", isConform: false, reportText: "Le bac de rétention est absent alors que le stockage de fioul ou produits chimiques l'impose." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "ICPE / Code de l'environnement",
    applicableConditions: ["HAS_FIOUL", "HAS_CHEMICALS"],
    sortOrder: 186,
  },
  {
    id: "hauteur_plafond",
    label: "Hauteur sous plafond",
    category: "ETAT_GENERAL",
    description: "Minimum 2 m, davantage selon équipements",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conforme (≥ 2 m)", isConform: true, reportText: "La hauteur sous plafond est conforme (minimum 2 m respecté)." },
      { id: "insuffisante", label: "Insuffisante (< 2 m)", isConform: false, reportText: "La hauteur sous plafond est insuffisante (< 2 m)." },
      { id: "limite", label: "Limite pour les équipements", isConform: false, reportText: "La hauteur sous plafond est limite pour la maintenance des équipements." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    regulatoryRef: "Code du travail",
    sortOrder: 187,
  },
  {
    id: "distances_maintenance",
    label: "Distances de maintenance",
    category: "ETAT_GENERAL",
    description: "Respect des préconisations constructeur pour intervention",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Conformes", isConform: true, reportText: "Les distances de maintenance autour des équipements sont respectées selon les préconisations constructeur." },
      { id: "insuffisantes", label: "Insuffisantes", isConform: false, reportText: "Les distances de maintenance sont insuffisantes, l'accès aux équipements est difficile." },
      { id: "obstruees", label: "Obstruées", isConform: false, reportText: "Les zones de maintenance sont obstruées par du stockage ou des équipements." },
      { id: "na", label: "Non applicable", isConform: true },
    ],
    sortOrder: 188,
  },
  {
    id: "encombrement_local",
    label: "Encombrement du local",
    category: "ETAT_GENERAL",
    description: "Absence de matériaux non nécessaires",
    responseType: "MULTI_CHOICE",
    findings: [
      { id: "conforme", label: "Non encombré", isConform: true, reportText: "Le local n'est pas encombré, seuls les équipements nécessaires sont présents." },
      { id: "encombre", label: "Encombré", isConform: false, reportText: "Le local est encombré par des matériaux ou équipements non nécessaires." },
      { id: "dangereux", label: "Encombrement dangereux", isConform: false, reportText: "L'encombrement du local présente un danger (accès difficile, risque incendie)." },
    ],
    sortOrder: 189,
  },
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère les checkpoints par catégorie
 */
export function getCheckpointsByCategory(categoryId: string): CheckpointDefinition[] {
  return CHECKPOINTS.filter(cp => cp.category === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Récupère tous les checkpoints triés par catégorie puis par sortOrder
 */
export function getAllCheckpointsSorted(): CheckpointDefinition[] {
  const categoryOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  return [...CHECKPOINTS].sort((a, b) => {
    const catOrderA = categoryOrder.get(a.category) ?? 999;
    const catOrderB = categoryOrder.get(b.category) ?? 999;
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;
    return a.sortOrder - b.sortOrder;
  });
}

/**
 * Filtre les checkpoints selon les conditions applicables
 */
export function filterCheckpointsByConditions(
  checkpoints: CheckpointDefinition[],
  activeConditions: string[]
): CheckpointDefinition[] {
  return checkpoints.filter(cp => {
    if (!cp.applicableConditions || cp.applicableConditions.length === 0) {
      return true; // Pas de condition = toujours applicable
    }
    // Au moins une condition doit être active
    return cp.applicableConditions.some(cond => activeConditions.includes(cond));
  });
}

/**
 * Récupère une catégorie par son ID
 */
export function getCategoryById(categoryId: string): CategoryDefinition | undefined {
  return CATEGORIES.find(c => c.id === categoryId);
}

/**
 * Compte le nombre de checkpoints par catégorie
 */
export function countCheckpointsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  CHECKPOINTS.forEach(cp => {
    counts[cp.category] = (counts[cp.category] || 0) + 1;
  });
  return counts;
}
