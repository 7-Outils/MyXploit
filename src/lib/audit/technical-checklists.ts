/**
 * Checklists techniques pour l'audit poussé des équipements CVC
 * Chaque type d'équipement a sa propre liste de points de contrôle
 */

export type ChecklistItemResult = "CONFORME" | "NON_CONFORME" | "NA" | "NON_VERIFIE";

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  description?: string;
}

export interface TechnicalChecklist {
  types: string[]; // Types d'équipements concernés (ex: ["CHAUDIERE", "CHAUDIERE_CONDENSATION"])
  domain: string;
  name: string; // Nom affiché (ex: "Chaudière")
  items: ChecklistItem[];
}

// Labels des catégories pour l'affichage
export const CATEGORY_LABELS: Record<string, string> = {
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

// ============================================
// CHECKLISTS PAR TYPE D'ÉQUIPEMENT
// ============================================

export const TECHNICAL_CHECKLISTS: TechnicalChecklist[] = [
  // ============================================
  // CHAUFFAGE
  // ============================================
  {
    types: ["CHAUDIERE", "CHAUDIERE_CONDENSATION"],
    domain: "CHAUFFAGE",
    name: "Chaudière",
    items: [
      { id: "combustion_analyse", label: "Analyse de combustion conforme (CO, CO2, rendement)", category: "COMBUSTION" },
      { id: "combustion_bruleur", label: "État du brûleur (électrodes, gicleur, pompe)", category: "COMBUSTION" },
      { id: "securite_controles", label: "Contrôle des sécurités (thermostat, pressostat, soupape)", category: "SECURITE" },
      { id: "securite_detecteur_co", label: "Détecteur CO présent et fonctionnel", category: "SECURITE" },
      { id: "evacuation_conduit", label: "État du conduit de fumée", category: "EVACUATION" },
      { id: "evacuation_ventilation", label: "Ventilation haute/basse du local", category: "EVACUATION" },
      { id: "hydraulique_vase", label: "État du vase d'expansion", category: "HYDRAULIQUE" },
      { id: "hydraulique_pression", label: "Pression circuit (entre 1 et 1.5 bar)", category: "HYDRAULIQUE" },
      { id: "reglementaire_carnet", label: "Carnet d'entretien à jour", category: "REGLEMENTAIRE" },
      { id: "reglementaire_etiquette", label: "Étiquette énergie visible", category: "REGLEMENTAIRE" },
    ],
  },
  {
    types: ["PAC", "PAC_AIR_EAU", "PAC_EAU_EAU", "PAC_AIR_AIR"],
    domain: "CHAUFFAGE",
    name: "Pompe à chaleur",
    items: [
      { id: "fluide_charge", label: "Charge fluide frigorigène conforme", category: "FLUIDE" },
      { id: "fluide_etancheite", label: "Absence de fuite (test étanchéité)", category: "FLUIDE" },
      { id: "echangeur_evaporateur", label: "État de l'évaporateur (propreté)", category: "ECHANGEUR" },
      { id: "echangeur_condenseur", label: "État du condenseur", category: "ECHANGEUR" },
      { id: "ventilation_ventilateurs", label: "État des ventilateurs", category: "VENTILATION" },
      { id: "filtration_filtres", label: "Filtres propres", category: "FILTRATION" },
      { id: "electrique_intensite", label: "Intensité compresseur conforme", category: "ELECTRIQUE" },
      { id: "electrique_contacteurs", label: "État des contacteurs", category: "ELECTRIQUE" },
      { id: "reglementaire_attestation", label: "Attestation capacité fluide", category: "REGLEMENTAIRE" },
      { id: "reglementaire_fiche", label: "Fiche d'intervention fluide à jour", category: "REGLEMENTAIRE" },
    ],
  },
  {
    types: ["BRULEUR"],
    domain: "CHAUFFAGE",
    name: "Brûleur",
    items: [
      { id: "combustion_gicleur", label: "Gicleur adapté (débit, angle)", category: "COMBUSTION" },
      { id: "combustion_electrodes", label: "Électrodes d'allumage (écartement)", category: "COMBUSTION" },
      { id: "combustion_photocellule", label: "Photocellule propre", category: "COMBUSTION" },
      { id: "pompe_pression", label: "Pression pompe fioul", category: "POMPE" },
      { id: "securite_arret", label: "Test arrêt sécurité", category: "SECURITE" },
    ],
  },
  {
    types: ["VASE_EXPANSION"],
    domain: "CHAUFFAGE",
    name: "Vase d'expansion",
    items: [
      { id: "pression_gonflage", label: "Pression de gonflage conforme", category: "PRESSION_GONFLAGE" },
      { id: "etat_membrane", label: "Absence de fuite membrane", category: "ETAT" },
      { id: "dimensionnement_volume", label: "Volume adapté à l'installation", category: "DIMENSIONNEMENT" },
    ],
  },
  {
    types: ["ECHANGEUR_THERMIQUE", "ECHANGEUR_PLAQUES"],
    domain: "CHAUFFAGE",
    name: "Échangeur thermique",
    items: [
      { id: "hydraulique_delta_t", label: "Delta T conforme", category: "HYDRAULIQUE" },
      { id: "hydraulique_encrassement", label: "Absence d'encrassement", category: "HYDRAULIQUE" },
      { id: "etancheite_circuits", label: "Absence de fuite entre circuits", category: "ETANCHEITE" },
    ],
  },

  // ============================================
  // ECS (Eau Chaude Sanitaire)
  // ============================================
  {
    types: ["BALLON_ECS", "PREPARATEUR_ECS", "PREPARATEUR_GAZ"],
    domain: "ECS",
    name: "Ballon/Préparateur ECS",
    items: [
      { id: "securite_groupe", label: "Groupe de sécurité fonctionnel", category: "SECURITE" },
      { id: "securite_soupape", label: "Soupape de sécurité (test)", category: "SECURITE" },
      { id: "temperature_consigne", label: "Température de consigne (55-60°C)", category: "TEMPERATURE" },
      { id: "legionelle_programme", label: "Programme anti-légionelle actif", category: "LEGIONELLE" },
      { id: "anode_etat", label: "État de l'anode sacrificielle", category: "ANODE" },
      { id: "isolation_calorifuge", label: "État du calorifuge", category: "ISOLATION" },
      { id: "hydraulique_vidange", label: "Vanne de vidange accessible", category: "HYDRAULIQUE" },
    ],
  },
  {
    types: ["MITIGEUR_THERMOSTATIQUE"],
    domain: "ECS",
    name: "Mitigeur thermostatique",
    items: [
      { id: "temperature_sortie", label: "Température de sortie conforme (< 50°C)", category: "TEMPERATURE" },
      { id: "securite_antibrulure", label: "Blocage anti-brûlure fonctionnel", category: "SECURITE" },
      { id: "hydraulique_fuite", label: "Absence de fuite", category: "HYDRAULIQUE" },
      { id: "reglage_butee", label: "Butée de réglage en place", category: "REGLAGE" },
    ],
  },

  // ============================================
  // VENTILATION
  // ============================================
  {
    types: ["CTA"],
    domain: "VENTILATION",
    name: "Centrale de Traitement d'Air",
    items: [
      { id: "filtration_etat", label: "État des filtres (G4, F7, etc.)", category: "FILTRATION" },
      { id: "filtration_perte_charge", label: "Perte de charge filtres (manomètre)", category: "FILTRATION" },
      { id: "ventilateur_courroies", label: "État des courroies", category: "VENTILATEUR" },
      { id: "ventilateur_tension", label: "Tension des courroies", category: "VENTILATEUR" },
      { id: "ventilateur_roulements", label: "État des roulements (bruit)", category: "VENTILATEUR" },
      { id: "batterie_chaude", label: "État batterie chaude (encrassement)", category: "BATTERIE" },
      { id: "batterie_froide", label: "État batterie froide", category: "BATTERIE" },
      { id: "registres_fonctionnement", label: "Fonctionnement des registres", category: "REGISTRES" },
      { id: "humidificateur_etat", label: "État de l'humidificateur (si présent)", category: "HUMIDIFICATEUR" },
      { id: "hygiene_proprete", label: "Propreté du caisson", category: "HYGIENE" },
    ],
  },
  {
    types: ["VMC", "VMC_DOUBLE_FLUX"],
    domain: "VENTILATION",
    name: "VMC",
    items: [
      { id: "ventilateur_moteur", label: "Fonctionnement moteur", category: "VENTILATEUR" },
      { id: "filtration_filtres", label: "État des filtres", category: "FILTRATION" },
      { id: "gaines_etancheite", label: "État des gaines (étanchéité)", category: "GAINES" },
      { id: "bouches_debit", label: "Débit aux bouches conforme", category: "BOUCHES" },
      { id: "echangeur_etat", label: "État échangeur (VMC DF)", category: "ECHANGEUR" },
      { id: "bypass_fonctionnement", label: "Fonctionnement bypass été (VMC DF)", category: "BYPASS" },
    ],
  },
  {
    types: ["EXTRACTEUR", "TOURELLE", "VENTILATEUR"],
    domain: "VENTILATION",
    name: "Extracteur/Tourelle",
    items: [
      { id: "ventilateur_pales", label: "État des pales", category: "VENTILATEUR" },
      { id: "ventilateur_equilibrage", label: "Équilibrage", category: "VENTILATEUR" },
      { id: "courroie_etat", label: "État et tension courroie", category: "COURROIE" },
      { id: "electrique_intensite", label: "Intensité moteur", category: "ELECTRIQUE" },
    ],
  },
  {
    types: ["BATTERIE_CHAUDE", "BATTERIE_FROIDE"],
    domain: "VENTILATION",
    name: "Batterie chaude/froide",
    items: [
      { id: "batterie_encrassement", label: "Absence d'encrassement", category: "BATTERIE" },
      { id: "hydraulique_vanne", label: "Fonctionnement vanne de régulation", category: "HYDRAULIQUE" },
      { id: "hydraulique_fuite", label: "Absence de fuite", category: "HYDRAULIQUE" },
    ],
  },

  // ============================================
  // CLIMATISATION
  // ============================================
  {
    types: ["GROUPE_FROID"],
    domain: "CLIMATISATION",
    name: "Groupe froid",
    items: [
      { id: "fluide_charge", label: "Charge fluide frigorigène", category: "FLUIDE" },
      { id: "fluide_etancheite", label: "Étanchéité circuit (test)", category: "FLUIDE" },
      { id: "compresseur_intensite", label: "Intensité absorbée", category: "COMPRESSEUR" },
      { id: "compresseur_temperature", label: "Température refoulement", category: "COMPRESSEUR" },
      { id: "condenseur_proprete", label: "Propreté (nettoyage)", category: "CONDENSEUR" },
      { id: "evaporateur_etat", label: "État évaporateur", category: "EVAPORATEUR" },
      { id: "pressostat_hp_bp", label: "HP/BP conformes", category: "PRESSOSTAT" },
      { id: "electrique_contacteurs", label: "État contacteurs", category: "ELECTRIQUE" },
      { id: "reglementaire_fiche", label: "Fiche intervention fluide", category: "REGLEMENTAIRE" },
    ],
  },
  {
    types: ["SPLIT", "MULTI_SPLIT"],
    domain: "CLIMATISATION",
    name: "Split/Multi-split",
    items: [
      { id: "fluide_fuite", label: "Absence de fuite", category: "FLUIDE" },
      { id: "filtres_ui", label: "État des filtres UI", category: "FILTRES" },
      { id: "evacuation_condensats", label: "Évacuation condensats", category: "EVACUATION" },
      { id: "telecommande_fonctionnement", label: "Fonctionnement", category: "TELECOMMANDE" },
      { id: "fixation_ui_ue", label: "Fixation UI et UE", category: "FIXATION" },
    ],
  },
  {
    types: ["ROOFTOP", "ARMOIRE_CLIM"],
    domain: "CLIMATISATION",
    name: "Rooftop/Armoire clim",
    items: [
      { id: "fluide_charge", label: "Charge fluide frigorigène", category: "FLUIDE" },
      { id: "filtration_filtres", label: "État des filtres", category: "FILTRATION" },
      { id: "compresseur_intensite", label: "Intensité compresseur", category: "COMPRESSEUR" },
      { id: "ventilateur_etat", label: "État ventilateurs", category: "VENTILATEUR" },
      { id: "courroie_etat", label: "État courroies (si applicable)", category: "COURROIE" },
    ],
  },

  // ============================================
  // PLOMBERIE
  // ============================================
  {
    types: ["DISCONNECTEUR", "DISCONNECTEUR_BA"],
    domain: "PLOMBERIE",
    name: "Disconnecteur",
    items: [
      { id: "amont_vanne", label: "Vanne d'arrêt manuelle présente", category: "AMONT" },
      { id: "amont_filtre", label: "Filtre avec robinet de rinçage", category: "AMONT" },
      { id: "aval_vanne", label: "Vanne d'arrêt manuelle présente", category: "AVAL" },
      { id: "aval_compteur", label: "Compteur installé", category: "AVAL" },
      { id: "installation_evacuation", label: "Raccordement aux évacuations", category: "INSTALLATION" },
      { id: "installation_entonnoir", label: "Entonnoir de vidange visible", category: "INSTALLATION" },
      { id: "reglementaire_controlable", label: "Disconnecteur contrôlable (si requis)", category: "REGLEMENTAIRE" },
      { id: "precaution_clapet", label: "Clapet anti-retour si piquage amont", category: "PRECAUTION" },
    ],
  },
  {
    types: ["SURPRESSEUR"],
    domain: "PLOMBERIE",
    name: "Surpresseur",
    items: [
      { id: "reservoir_pression", label: "Pression de gonflage vessie", category: "RESERVOIR" },
      { id: "pompe_intensite", label: "Intensité moteur", category: "POMPE" },
      { id: "pressostat_reglage", label: "Réglage HP/BP", category: "PRESSOSTAT" },
      { id: "securite_manque_eau", label: "Manque d'eau", category: "SECURITE" },
      { id: "hydraulique_etancheite", label: "Étanchéité", category: "HYDRAULIQUE" },
    ],
  },
  {
    types: ["POMPE_RELEVAGE"],
    domain: "PLOMBERIE",
    name: "Pompe de relevage",
    items: [
      { id: "flotteur_fonctionnement", label: "Fonctionnement flotteur", category: "FLOTTEUR" },
      { id: "pompe_intensite", label: "Intensité moteur", category: "POMPE" },
      { id: "alarme_niveau_haut", label: "Test alarme niveau haut", category: "ALARME" },
      { id: "bache_proprete", label: "Propreté bâche", category: "BACHE" },
    ],
  },
  {
    types: ["COMPTEUR_EAU"],
    domain: "PLOMBERIE",
    name: "Compteur d'eau",
    items: [
      { id: "affichage_fonctionnel", label: "Affichage fonctionnel", category: "AFFICHAGE" },
      { id: "etancheite_raccords", label: "Étanchéité des raccords", category: "HYDRAULIQUE" },
      { id: "accessibilite_releve", label: "Accessibilité pour relevé", category: "INSTALLATION" },
    ],
  },

  // ============================================
  // TRAITEMENT D'EAU
  // ============================================
  {
    types: ["ADOUCISSEUR"],
    domain: "TRAITEMENT_EAU",
    name: "Adoucisseur",
    items: [
      { id: "sel_niveau", label: "Niveau de sel suffisant", category: "SEL" },
      { id: "resine_etat", label: "État de la résine", category: "RESINE" },
      { id: "bypass_vanne", label: "Vanne bypass fonctionnelle", category: "BYPASS" },
      { id: "regeneration_programmation", label: "Programmation régénération", category: "REGENERATION" },
      { id: "durete_eau", label: "Dureté eau traitée conforme", category: "DURETE" },
      { id: "compteur_volumetrique", label: "Compteur volumétrique", category: "COMPTEUR" },
    ],
  },
  {
    types: ["FILTRE", "FILTRE_AUTOMATIQUE"],
    domain: "TRAITEMENT_EAU",
    name: "Filtre",
    items: [
      { id: "filtration_etat", label: "État de l'élément filtrant", category: "FILTRATION" },
      { id: "pression_differentielle", label: "Pression différentielle", category: "PRESSION" },
      { id: "bypass_vanne", label: "Vanne bypass (si présente)", category: "BYPASS" },
    ],
  },
  {
    types: ["DEGAZEUR"],
    domain: "TRAITEMENT_EAU",
    name: "Dégazeur",
    items: [
      { id: "fonctionnement_purge", label: "Fonctionnement purge automatique", category: "HYDRAULIQUE" },
      { id: "etancheite_raccords", label: "Étanchéité", category: "ETANCHEITE" },
    ],
  },

  // ============================================
  // ÉLECTRICITÉ (CFO/CFA)
  // ============================================
  {
    types: ["ARMOIRE_ELECTRIQUE", "TGBT"],
    domain: "CFO_CFA",
    name: "Armoire électrique/TGBT",
    items: [
      { id: "visuel_etat", label: "État général (propreté, corrosion)", category: "VISUEL" },
      { id: "serrage_connexions", label: "Resserrage des connexions", category: "SERRAGE" },
      { id: "thermique_verification", label: "Vérification thermographique", category: "THERMIQUE" },
      { id: "protection_disjoncteurs", label: "État des disjoncteurs", category: "PROTECTION" },
      { id: "terre_continuite", label: "Continuité de terre", category: "TERRE" },
    ],
  },
  {
    types: ["ONDULEUR"],
    domain: "CFO_CFA",
    name: "Onduleur",
    items: [
      { id: "batterie_etat", label: "État des batteries", category: "BATTERIE_ELEC" },
      { id: "autonomie_test", label: "Test autonomie", category: "AUTONOMIE" },
      { id: "alarmes_etat", label: "État des alarmes", category: "ALARMES" },
    ],
  },
  {
    types: ["TRANSFORMATEUR"],
    domain: "CFO_CFA",
    name: "Transformateur",
    items: [
      { id: "visuel_etat", label: "État général", category: "VISUEL" },
      { id: "thermique_temperature", label: "Température de fonctionnement", category: "THERMIQUE" },
      { id: "huile_niveau", label: "Niveau d'huile (si applicable)", category: "HYDRAULIQUE" },
    ],
  },

  // ============================================
  // COMPTAGE
  // ============================================
  {
    types: ["COMPTEUR_ENERGIE", "COMPTEUR_CALORIES", "COMPTEUR_GAZ"],
    domain: "COMPTAGE",
    name: "Compteur d'énergie",
    items: [
      { id: "affichage_fonctionnel", label: "Affichage fonctionnel", category: "AFFICHAGE" },
      { id: "communication_gtc", label: "Liaison GTC/GTB", category: "COMMUNICATION" },
      { id: "etalonnage_date", label: "Date dernier étalonnage", category: "ETALONNAGE" },
      { id: "sondes_etat", label: "État des sondes", category: "SONDES" },
    ],
  },
  {
    types: ["SONDE_TEMPERATURE", "SONDE_PRESSION", "SONDE_HYGROMETRIE"],
    domain: "COMPTAGE",
    name: "Sonde",
    items: [
      { id: "etalonnage_date", label: "Date dernier étalonnage", category: "ETALONNAGE" },
      { id: "cablage_etat", label: "État du câblage", category: "ELECTRIQUE" },
      { id: "communication_signal", label: "Signal de mesure", category: "COMMUNICATION" },
    ],
  },

  // ============================================
  // PISCINE
  // ============================================
  {
    types: ["FILTRE_PISCINE"],
    domain: "PISCINE",
    name: "Filtre piscine",
    items: [
      { id: "pression_fonctionnement", label: "Pression de fonctionnement", category: "PRESSION" },
      { id: "manometre_etat", label: "État manomètre", category: "MANOMETRE" },
      { id: "contrelavage_dernier", label: "Dernier contre-lavage", category: "CONTRELAVAGE" },
      { id: "media_etat", label: "État du média filtrant", category: "MEDIA" },
    ],
  },
  {
    types: ["POMPE_PISCINE"],
    domain: "PISCINE",
    name: "Pompe piscine",
    items: [
      { id: "amorcage_correct", label: "Amorçage correct", category: "AMORCAGE" },
      { id: "panier_proprete", label: "Propreté panier préfiltre", category: "PANIER" },
      { id: "intensite_moteur", label: "Intensité moteur", category: "INTENSITE" },
      { id: "garniture_etat", label: "État garniture mécanique", category: "GARNITURE" },
    ],
  },
  {
    types: ["PAC_PISCINE"],
    domain: "PISCINE",
    name: "PAC Piscine",
    items: [
      { id: "fluide_charge", label: "Charge fluide frigorigène", category: "FLUIDE" },
      { id: "echangeur_etat", label: "État échangeur titane", category: "ECHANGEUR" },
      { id: "ventilateur_etat", label: "État ventilateur", category: "VENTILATEUR" },
      { id: "debit_eau", label: "Débit d'eau conforme", category: "HYDRAULIQUE" },
    ],
  },
  {
    types: ["TRAITEMENT_CHLORE", "ELECTROLYSEUR_SEL"],
    domain: "PISCINE",
    name: "Traitement chlore/Électrolyseur",
    items: [
      { id: "consommation_produit", label: "Consommation produit", category: "CONSOMMATION" },
      { id: "dosage_reglage", label: "Réglage dosage", category: "DOSAGE" },
      { id: "sonde_etalonnage", label: "Étalonnage sonde", category: "SONDE" },
      { id: "cellule_etat", label: "État cellule (électrolyseur)", category: "CELLULE" },
    ],
  },
  {
    types: ["TRAITEMENT_PH"],
    domain: "PISCINE",
    name: "Régulation pH",
    items: [
      { id: "sonde_etalonnage", label: "Étalonnage sonde pH", category: "SONDE" },
      { id: "dosage_reglage", label: "Réglage dosage", category: "DOSAGE" },
      { id: "produit_niveau", label: "Niveau produit", category: "CONSOMMATION" },
    ],
  },
  {
    types: ["CHAUFFAGE_PISCINE", "ECHANGEUR_PISCINE"],
    domain: "PISCINE",
    name: "Chauffage piscine",
    items: [
      { id: "echangeur_encrassement", label: "Absence d'encrassement", category: "ECHANGEUR" },
      { id: "regulation_temperature", label: "Régulation température", category: "TEMPERATURE" },
      { id: "hydraulique_debit", label: "Débit conforme", category: "HYDRAULIQUE" },
    ],
  },
];

/**
 * Récupère la checklist pour un type d'équipement donné
 */
export function getChecklistForEquipmentType(equipmentType: string): TechnicalChecklist | null {
  return TECHNICAL_CHECKLISTS.find((checklist) => checklist.types.includes(equipmentType)) || null;
}

/**
 * Vérifie si un type d'équipement a une checklist technique disponible
 */
export function hasChecklist(equipmentType: string): boolean {
  return TECHNICAL_CHECKLISTS.some((checklist) => checklist.types.includes(equipmentType));
}

/**
 * Récupère tous les types d'équipements qui ont une checklist
 */
export function getEquipmentTypesWithChecklist(): string[] {
  return TECHNICAL_CHECKLISTS.flatMap((checklist) => checklist.types);
}

/**
 * Groupe les items par catégorie pour l'affichage
 */
export function groupItemsByCategory(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const existing = grouped.get(item.category) || [];
    existing.push(item);
    grouped.set(item.category, existing);
  }
  return grouped;
}

/**
 * Type pour les résultats d'un item de checklist sauvegardé
 */
export interface SavedChecklistItem {
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
