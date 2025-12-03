import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Synonymes et alias pour les types d'équipements
// Permet de matcher "pompe" → "CIRCULATEUR", "clim" → "CLIMATISEUR", etc.
const TYPE_SYNONYMS: Record<string, string> = {
  // Chauffage - Générateurs
  "chaudière": "CHAUDIERE",
  "chaudiere": "CHAUDIERE",
  "chaudière gaz": "CHAUDIERE",
  "chaudiere gaz": "CHAUDIERE",
  "chaudière fioul": "CHAUDIERE",
  "chaudiere fioul": "CHAUDIERE",
  "chaudière condensation": "CHAUDIERE_CONDENSATION",
  "chaudiere condensation": "CHAUDIERE_CONDENSATION",
  "chaudière à condensation": "CHAUDIERE_CONDENSATION",
  "pac": "PAC",
  "pompe à chaleur": "PAC",
  "pompe a chaleur": "PAC",
  "pac air eau": "PAC_AIR_EAU",
  "pac air/eau": "PAC_AIR_EAU",
  "pac eau eau": "PAC_EAU_EAU",
  "pac eau/eau": "PAC_EAU_EAU",
  "pac air air": "PAC_AIR_AIR",
  "pac air/air": "PAC_AIR_AIR",
  "brûleur": "BRULEUR",
  "bruleur": "BRULEUR",

  // Chauffage - Émetteurs
  "radiateur": "RADIATEUR",
  "radiateurs": "RADIATEUR",
  "plancher chauffant": "PLANCHER_CHAUFFANT",
  "convecteur": "CONVECTEUR",
  "convecteurs": "CONVECTEUR",
  "aérotherme": "AEROTERME",
  "aerotherme": "AEROTERME",
  "aérothermes": "AEROTERME",
  "radiant": "RADIANT_GAZ",
  "radiant gaz": "RADIANT_GAZ",
  "tube radiant": "RADIANT_GAZ",

  // Chauffage - Distribution
  "pompe": "CIRCULATEUR",
  "pompe de circulation": "CIRCULATEUR",
  "circulateur": "CIRCULATEUR",
  "circulateurs": "CIRCULATEUR",
  "pompe chauffage": "POMPE_CHAUFFAGE",
  "vanne 3 voies": "VANNE_3_VOIES",
  "v3v": "VANNE_3_VOIES",
  "vanne trois voies": "VANNE_3_VOIES",
  "vanne motorisée": "VANNE_MOTORISEE",
  "vanne motorisee": "VANNE_MOTORISEE",
  "vase expansion": "VASE_EXPANSION",
  "vase d'expansion": "VASE_EXPANSION",
  "échangeur": "ECHANGEUR_THERMIQUE",
  "echangeur": "ECHANGEUR_THERMIQUE",
  "échangeur thermique": "ECHANGEUR_THERMIQUE",
  "echangeur thermique": "ECHANGEUR_THERMIQUE",

  // Chauffage - Régulation
  "régulateur": "REGULATEUR",
  "regulateur": "REGULATEUR",
  "régulation": "REGULATEUR",
  "sonde": "SONDE_TEMPERATURE",
  "sonde température": "SONDE_TEMPERATURE",
  "sonde temperature": "SONDE_TEMPERATURE",
  "sonde extérieure": "SONDE_EXTERIEURE",
  "sonde exterieure": "SONDE_EXTERIEURE",
  "sonde ext": "SONDE_EXTERIEURE",

  // ECS
  "ballon": "BALLON_ECS",
  "ballon ecs": "BALLON_ECS",
  "ballon eau chaude": "BALLON_ECS",
  "cumulus": "BALLON_ECS",
  "chauffe-eau": "BALLON_ECS",
  "chauffe eau": "BALLON_ECS",
  "ballon thermodynamique": "BALLON_THERMODYNAMIQUE",
  "ballon thermo": "BALLON_THERMODYNAMIQUE",
  "préparateur ecs": "PREPARATEUR_ECS_GAZ",
  "preparateur ecs": "PREPARATEUR_ECS_GAZ",
  "préparateur ecs gaz": "PREPARATEUR_ECS_GAZ",
  "preparateur ecs gaz": "PREPARATEUR_ECS_GAZ",
  "échangeur ecs": "ECHANGEUR_ECS",
  "echangeur ecs": "ECHANGEUR_ECS",
  "pompe bouclage": "POMPE_BOUCLAGE",
  "pompe de bouclage": "POMPE_BOUCLAGE",
  "bouclage": "POMPE_BOUCLAGE",
  "mitigeur": "MITIGEUR_THERMOSTATIQUE",
  "mitigeur thermostatique": "MITIGEUR_THERMOSTATIQUE",
  "résistance": "RESISTANCE_ELECTRIQUE",
  "resistance": "RESISTANCE_ELECTRIQUE",
  "résistance électrique": "RESISTANCE_ELECTRIQUE",
  "resistance electrique": "RESISTANCE_ELECTRIQUE",

  // Ventilation
  "vmc": "VMC",
  "vmc simple flux": "VMC_SIMPLE_FLUX",
  "vmc sf": "VMC_SIMPLE_FLUX",
  "vmc double flux": "VMC_DOUBLE_FLUX",
  "vmc df": "VMC_DOUBLE_FLUX",
  "cta": "CTA",
  "centrale traitement air": "CTA",
  "centrale de traitement d'air": "CTA",
  "caisson extraction": "CAISSON_EXTRACTION",
  "caisson d'extraction": "CAISSON_EXTRACTION",
  "extraction": "CAISSON_EXTRACTION",
  "caisson soufflage": "CAISSON_SOUFFLAGE",
  "caisson de soufflage": "CAISSON_SOUFFLAGE",
  "soufflage": "CAISSON_SOUFFLAGE",
  "ventilateur": "VENTILATEUR",
  "ventilo": "VENTILATEUR",
  "registre": "REGISTRE",
  "batterie chaude": "BATTERIE_CHAUDE",
  "bc": "BATTERIE_CHAUDE",
  "batterie froide": "BATTERIE_FROIDE",
  "bf": "BATTERIE_FROIDE",
  "récupérateur": "RECUPERATEUR_CHALEUR",
  "recuperateur": "RECUPERATEUR_CHALEUR",
  "récupérateur chaleur": "RECUPERATEUR_CHALEUR",
  "recuperateur chaleur": "RECUPERATEUR_CHALEUR",

  // Climatisation
  "groupe froid": "GROUPE_FROID",
  "gf": "GROUPE_FROID",
  "groupe eau glacée": "GROUPE_FROID",
  "climatisation": "CLIMATISATION",
  "clim": "CLIMATISEUR",
  "climatiseur": "CLIMATISEUR",
  "split": "SPLIT",
  "split system": "SPLIT",
  "multi split": "MULTI_SPLIT",
  "multi-split": "MULTI_SPLIT",
  "cassette": "CASSETTE",
  "gainable": "GAINABLE",
  "rooftop": "ROOFTOP",
  "roof top": "ROOFTOP",

  // Traitement eau
  "adoucisseur": "ADOUCISSEUR",
  "disconnecteur": "DISCONNECTEUR",
  "filtre": "FILTRE",
  "pot à boue": "POT_BOUE",
  "pot a boue": "POT_BOUE",
  "pot boue": "POT_BOUE",
  "dégazeur": "DEGAZEUR",
  "degazeur": "DEGAZEUR",
  "doseur": "DOSEUR",

  // Plomberie
  "compteur eau": "COMPTEUR_EAU",
  "compteur d'eau": "COMPTEUR_EAU",
  "vanne générale": "VANNE_GENERALE",
  "vanne generale": "VANNE_GENERALE",
  "vg": "VANNE_GENERALE",
  "surpresseur": "SURPRESSEUR",
  "bâche": "BACHE_EAU",
  "bache": "BACHE_EAU",
  "bâche à eau": "BACHE_EAU",
  "bache a eau": "BACHE_EAU",
  "réducteur pression": "REDUCTION_PRESSION",
  "reducteur pression": "REDUCTION_PRESSION",
  "détendeur": "REDUCTION_PRESSION",
  "detendeur": "REDUCTION_PRESSION",

  // CFO/CFA
  "armoire électrique": "ARMOIRE_ELECTRIQUE",
  "armoire electrique": "ARMOIRE_ELECTRIQUE",
  "armoire elec": "ARMOIRE_ELECTRIQUE",
  "tgbt": "ARMOIRE_TGBT",
  "tableau général": "ARMOIRE_TGBT",
  "tableau general": "ARMOIRE_TGBT",
  "td": "ARMOIRE_TD",
  "tableau divisionnaire": "ARMOIRE_TD",
  "onduleur": "ONDULEUR",
  "ups": "ONDULEUR",
  "groupe électrogène": "GROUPE_ELECTROGENE",
  "groupe electrogene": "GROUPE_ELECTROGENE",
  "ge": "GROUPE_ELECTROGENE",
  "transformateur": "TRANSFORMATEUR",
  "transfo": "TRANSFORMATEUR",
  "baie informatique": "BAIE_INFORMATIQUE",
  "baie info": "BAIE_INFORMATIQUE",
  "rack": "BAIE_INFORMATIQUE",

  // Comptage
  "compteur énergie": "COMPTEUR_ENERGIE",
  "compteur energie": "COMPTEUR_ENERGIE",
  "compteur thermique": "COMPTEUR_ENERGIE",
  "compteur calories": "COMPTEUR_CALORIES",
  "compteur de calories": "COMPTEUR_CALORIES",
  "calorimètre": "COMPTEUR_CALORIES",
  "calorimetre": "COMPTEUR_CALORIES",
  "compteur frigories": "COMPTEUR_FRIGORIES",
  "compteur de frigories": "COMPTEUR_FRIGORIES",
  "frigorimètre": "COMPTEUR_FRIGORIES",
  "frigorimetre": "COMPTEUR_FRIGORIES",
  "compteur ecs": "COMPTEUR_ECS",
  "compteur gaz": "COMPTEUR_GAZ",
  "compteur électrique": "COMPTEUR_ELECTRIQUE",
  "compteur electrique": "COMPTEUR_ELECTRIQUE",
  "sous-compteur": "SOUS_COMPTEUR_ELEC",
  "sous compteur": "SOUS_COMPTEUR_ELEC",
  "sous-compteur électrique": "SOUS_COMPTEUR_ELEC",
  "compteur horaire": "COMPTEUR_HORAIRE",
  "analyseur réseau": "ANALYSEUR_RESEAU",
  "analyseur reseau": "ANALYSEUR_RESEAU",
  "analyseur": "ANALYSEUR_RESEAU",
  "sonde ambiante": "SONDE_TEMPERATURE_AMB",
  "sonde température ambiante": "SONDE_TEMPERATURE_AMB",
  "sonde hygrométrie": "SONDE_HYGROMETRIE",
  "sonde hygrometrie": "SONDE_HYGROMETRIE",
  "hygromètre": "SONDE_HYGROMETRIE",
  "hygrometre": "SONDE_HYGROMETRIE",
  "capteur co2": "CAPTEUR_CO2",
  "sonde co2": "CAPTEUR_CO2",
  "capteur qualité air": "CAPTEUR_QUALITE_AIR",
  "capteur qualite air": "CAPTEUR_QUALITE_AIR",

  // Autre
  "autre": "AUTRE",
};

// Synonymes pour les domaines
const DOMAIN_SYNONYMS: Record<string, string> = {
  "chauffage": "CHAUFFAGE",
  "chauf": "CHAUFFAGE",
  "ecs": "ECS",
  "eau chaude": "ECS",
  "eau chaude sanitaire": "ECS",
  "ventilation": "VENTILATION",
  "ventil": "VENTILATION",
  "vent": "VENTILATION",
  "climatisation": "CLIMATISATION",
  "clim": "CLIMATISATION",
  "froid": "CLIMATISATION",
  "traitement eau": "TRAITEMENT_EAU",
  "traitement d'eau": "TRAITEMENT_EAU",
  "plomberie": "PLOMBERIE",
  "plomb": "PLOMBERIE",
  "sanitaire": "PLOMBERIE",
  "cfo": "CFO_CFA",
  "cfa": "CFO_CFA",
  "cfo/cfa": "CFO_CFA",
  "électricité": "CFO_CFA",
  "electricite": "CFO_CFA",
  "elec": "CFO_CFA",
  "comptage": "COMPTAGE",
  "mesure": "COMPTAGE",
  "instrumentation": "COMPTAGE",
  "autre": "AUTRE",
};

// Mapping type -> domain automatique
const TYPE_TO_DOMAIN: Record<string, string> = {
  CHAUDIERE: "CHAUFFAGE",
  CHAUDIERE_CONDENSATION: "CHAUFFAGE",
  PAC: "CHAUFFAGE",
  PAC_AIR_EAU: "CHAUFFAGE",
  PAC_EAU_EAU: "CHAUFFAGE",
  PAC_AIR_AIR: "CHAUFFAGE",
  RADIATEUR: "CHAUFFAGE",
  PLANCHER_CHAUFFANT: "CHAUFFAGE",
  CONVECTEUR: "CHAUFFAGE",
  AEROTERME: "CHAUFFAGE",
  RADIANT_GAZ: "CHAUFFAGE",
  VANNE_3_VOIES: "CHAUFFAGE",
  VANNE_MOTORISEE: "CHAUFFAGE",
  POMPE_CHAUFFAGE: "CHAUFFAGE",
  CIRCULATEUR: "CHAUFFAGE",
  VASE_EXPANSION: "CHAUFFAGE",
  ECHANGEUR_THERMIQUE: "CHAUFFAGE",
  BRULEUR: "CHAUFFAGE",
  REGULATEUR: "CHAUFFAGE",
  SONDE_TEMPERATURE: "CHAUFFAGE",
  SONDE_EXTERIEURE: "CHAUFFAGE",
  BALLON_ECS: "ECS",
  BALLON_THERMODYNAMIQUE: "ECS",
  PREPARATEUR_ECS_GAZ: "ECS",
  ECHANGEUR_ECS: "ECS",
  POMPE_BOUCLAGE: "ECS",
  MITIGEUR_THERMOSTATIQUE: "ECS",
  RESISTANCE_ELECTRIQUE: "ECS",
  VMC: "VENTILATION",
  VMC_SIMPLE_FLUX: "VENTILATION",
  VMC_DOUBLE_FLUX: "VENTILATION",
  CTA: "VENTILATION",
  CAISSON_EXTRACTION: "VENTILATION",
  CAISSON_SOUFFLAGE: "VENTILATION",
  VENTILATEUR: "VENTILATION",
  REGISTRE: "VENTILATION",
  BATTERIE_CHAUDE: "VENTILATION",
  BATTERIE_FROIDE: "VENTILATION",
  RECUPERATEUR_CHALEUR: "VENTILATION",
  GROUPE_FROID: "CLIMATISATION",
  CLIMATISATION: "CLIMATISATION",
  CLIMATISEUR: "CLIMATISATION",
  SPLIT: "CLIMATISATION",
  MULTI_SPLIT: "CLIMATISATION",
  CASSETTE: "CLIMATISATION",
  GAINABLE: "CLIMATISATION",
  ROOFTOP: "CLIMATISATION",
  ADOUCISSEUR: "TRAITEMENT_EAU",
  DISCONNECTEUR: "TRAITEMENT_EAU",
  FILTRE: "TRAITEMENT_EAU",
  POT_BOUE: "TRAITEMENT_EAU",
  DEGAZEUR: "TRAITEMENT_EAU",
  DOSEUR: "TRAITEMENT_EAU",
  COMPTEUR_EAU: "PLOMBERIE",
  VANNE_GENERALE: "PLOMBERIE",
  SURPRESSEUR: "PLOMBERIE",
  BACHE_EAU: "PLOMBERIE",
  REDUCTION_PRESSION: "PLOMBERIE",
  ARMOIRE_ELECTRIQUE: "CFO_CFA",
  ARMOIRE_TGBT: "CFO_CFA",
  ARMOIRE_TD: "CFO_CFA",
  ONDULEUR: "CFO_CFA",
  GROUPE_ELECTROGENE: "CFO_CFA",
  TRANSFORMATEUR: "CFO_CFA",
  BAIE_INFORMATIQUE: "CFO_CFA",
  COMPTEUR_ENERGIE: "COMPTAGE",
  COMPTEUR_CALORIES: "COMPTAGE",
  COMPTEUR_FRIGORIES: "COMPTAGE",
  COMPTEUR_ECS: "COMPTAGE",
  COMPTEUR_GAZ: "COMPTAGE",
  COMPTEUR_ELECTRIQUE: "COMPTAGE",
  SOUS_COMPTEUR_ELEC: "COMPTAGE",
  COMPTEUR_HORAIRE: "COMPTAGE",
  ANALYSEUR_RESEAU: "COMPTAGE",
  SONDE_TEMPERATURE_AMB: "COMPTAGE",
  SONDE_HYGROMETRIE: "COMPTAGE",
  CAPTEUR_CO2: "COMPTAGE",
  CAPTEUR_QUALITE_AIR: "COMPTAGE",
  AUTRE: "AUTRE",
};

// Durée de vie par défaut
const DEFAULT_LIFESPAN: Record<string, number> = {
  CHAUDIERE: 20, CHAUDIERE_CONDENSATION: 20, PAC: 20, PAC_AIR_EAU: 20, PAC_EAU_EAU: 25, PAC_AIR_AIR: 15,
  BRULEUR: 15, RADIATEUR: 30, PLANCHER_CHAUFFANT: 50, CONVECTEUR: 20, AEROTERME: 15, RADIANT_GAZ: 15,
  VANNE_3_VOIES: 15, VANNE_MOTORISEE: 15, POMPE_CHAUFFAGE: 15, CIRCULATEUR: 15, VASE_EXPANSION: 15,
  ECHANGEUR_THERMIQUE: 20, REGULATEUR: 15, SONDE_TEMPERATURE: 10, SONDE_EXTERIEURE: 10,
  BALLON_ECS: 15, BALLON_THERMODYNAMIQUE: 15, PREPARATEUR_ECS_GAZ: 15, ECHANGEUR_ECS: 20,
  POMPE_BOUCLAGE: 15, MITIGEUR_THERMOSTATIQUE: 10, RESISTANCE_ELECTRIQUE: 10,
  VMC: 15, VMC_SIMPLE_FLUX: 15, VMC_DOUBLE_FLUX: 15, CTA: 20, CAISSON_EXTRACTION: 15, CAISSON_SOUFFLAGE: 15,
  VENTILATEUR: 15, REGISTRE: 20, BATTERIE_CHAUDE: 20, BATTERIE_FROIDE: 20, RECUPERATEUR_CHALEUR: 15,
  GROUPE_FROID: 20, CLIMATISATION: 15, CLIMATISEUR: 15, SPLIT: 12, MULTI_SPLIT: 12, CASSETTE: 12, GAINABLE: 15, ROOFTOP: 20,
  ADOUCISSEUR: 15, DISCONNECTEUR: 20, FILTRE: 10, POT_BOUE: 20, DEGAZEUR: 20, DOSEUR: 10,
  COMPTEUR_EAU: 15, VANNE_GENERALE: 30, SURPRESSEUR: 15, BACHE_EAU: 25, REDUCTION_PRESSION: 15,
  ARMOIRE_ELECTRIQUE: 30, ARMOIRE_TGBT: 30, ARMOIRE_TD: 30, ONDULEUR: 10, GROUPE_ELECTROGENE: 25, TRANSFORMATEUR: 35, BAIE_INFORMATIQUE: 15,
  COMPTEUR_ENERGIE: 15, COMPTEUR_CALORIES: 15, COMPTEUR_FRIGORIES: 15, COMPTEUR_ECS: 15, COMPTEUR_GAZ: 15,
  COMPTEUR_ELECTRIQUE: 15, SOUS_COMPTEUR_ELEC: 15, COMPTEUR_HORAIRE: 10, ANALYSEUR_RESEAU: 15,
  SONDE_TEMPERATURE_AMB: 10, SONDE_HYGROMETRIE: 10, CAPTEUR_CO2: 10, CAPTEUR_QUALITE_AIR: 10,
  AUTRE: 15,
};

// Normalise un texte pour la recherche (minuscules, sans accents, sans apostrophes)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[''`´]/g, " ")          // Remplace apostrophes par espace
    .replace(/[-]/g, " ")             // Remplace tirets par espace
    .replace(/\s+/g, " ")             // Normalise les espaces multiples
    .trim();
}

// Crée un index normalisé des synonymes pour recherche rapide
const NORMALIZED_TYPE_SYNONYMS: Record<string, string> = {};
for (const [key, value] of Object.entries(TYPE_SYNONYMS)) {
  NORMALIZED_TYPE_SYNONYMS[normalize(key)] = value;
}

// Trouve le type d'équipement le plus proche
function findEquipmentType(input: string): string | null {
  const normalized = normalize(input);

  // Essai direct avec le nom uppercase (si déjà au bon format)
  if (TYPE_TO_DOMAIN[input.toUpperCase()]) {
    return input.toUpperCase();
  }

  // Recherche dans les synonymes normalisés
  if (NORMALIZED_TYPE_SYNONYMS[normalized]) {
    return NORMALIZED_TYPE_SYNONYMS[normalized];
  }

  // Recherche partielle (si le texte contient un synonyme)
  for (const [synonym, type] of Object.entries(NORMALIZED_TYPE_SYNONYMS)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return type;
    }
  }

  return null;
}

// Crée un index normalisé des domaines pour recherche rapide
const NORMALIZED_DOMAIN_SYNONYMS: Record<string, string> = {};
for (const [key, value] of Object.entries(DOMAIN_SYNONYMS)) {
  NORMALIZED_DOMAIN_SYNONYMS[normalize(key)] = value;
}

// Trouve le domaine le plus proche
function findDomain(input: string): string | null {
  const normalized = normalize(input);

  if (NORMALIZED_DOMAIN_SYNONYMS[normalized]) {
    return NORMALIZED_DOMAIN_SYNONYMS[normalized];
  }

  // Recherche partielle
  for (const [synonym, domain] of Object.entries(NORMALIZED_DOMAIN_SYNONYMS)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return domain;
    }
  }

  return null;
}

interface ImportRow {
  site?: string;
  type?: string;
  domaine?: string;
  domain?: string;
  nom?: string;
  name?: string;
  marque?: string;
  brand?: string;
  modele?: string;
  model?: string;
  numero_serie?: string;
  serial_number?: string;
  annee?: string;
  year?: string;
  puissance?: string;
  power?: string;
  quantite?: string;
  quantity?: string;
  local?: string;
  location?: string;
  niveau?: string;
  level?: string;
  duree_vie?: string;
  lifespan?: string;
}

// POST /api/equipments/import - Preview import
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { rows, contractId, preview = true } = body as {
      rows: ImportRow[];
      contractId: string;
      preview?: boolean;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée à importer" },
        { status: 400 }
      );
    }

    if (!contractId) {
      return NextResponse.json(
        { error: "ID du contrat requis" },
        { status: 400 }
      );
    }

    // Get sites for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: { site: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json(
        { error: "Aucun site associé à ce contrat" },
        { status: 400 }
      );
    }

    // Build site name -> id mapping
    const siteMap = new Map<string, string>();
    for (const cs of contractSites) {
      const name = normalize(cs.site.name);
      siteMap.set(name, cs.siteId);
      // Also try with city
      const nameWithCity = normalize(`${cs.site.name} ${cs.site.city || ""}`);
      siteMap.set(nameWithCity, cs.siteId);
    }

    // Process rows
    const results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      type?: string;
      typeParsed?: string;
      domain?: string;
      site?: string;
      siteId?: string;
      name?: string;
      brand?: string;
      model?: string;
      year?: number;
      power?: number;
      quantity?: number;
      location?: string;
      level?: string;
      lifespan?: number;
      message?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result: typeof results[0] = {
        row: i + 1,
        status: "ok",
      };

      // Find site
      const siteName = row.site?.trim();
      if (!siteName) {
        result.status = "error";
        result.message = "Nom du site manquant";
        results.push(result);
        continue;
      }

      // Try to match site
      let siteId: string | undefined;
      const normalizedSite = normalize(siteName);

      // Exact match
      if (siteMap.has(normalizedSite)) {
        siteId = siteMap.get(normalizedSite);
      } else {
        // Partial match
        for (const [name, id] of siteMap.entries()) {
          if (name.includes(normalizedSite) || normalizedSite.includes(name)) {
            siteId = id;
            break;
          }
        }
      }

      if (!siteId) {
        result.status = "error";
        result.message = `Site "${siteName}" non trouvé dans le contrat`;
        result.site = siteName;
        results.push(result);
        continue;
      }

      result.site = siteName;
      result.siteId = siteId;

      // Find type
      const typeInput = row.type?.trim();
      if (!typeInput) {
        result.status = "error";
        result.message = "Type d'équipement manquant";
        results.push(result);
        continue;
      }

      const parsedType = findEquipmentType(typeInput);
      if (!parsedType) {
        result.status = "error";
        result.message = `Type "${typeInput}" non reconnu`;
        result.type = typeInput;
        results.push(result);
        continue;
      }

      result.type = typeInput;
      result.typeParsed = parsedType;

      // Domain (auto from type or from input)
      const domainInput = row.domaine || row.domain;
      if (domainInput) {
        const parsedDomain = findDomain(domainInput);
        result.domain = parsedDomain || TYPE_TO_DOMAIN[parsedType] || "AUTRE";
        if (!parsedDomain) {
          result.status = "warning";
          result.message = `Domaine "${domainInput}" non reconnu, utilisation de ${result.domain}`;
        }
      } else {
        result.domain = TYPE_TO_DOMAIN[parsedType] || "AUTRE";
      }

      // Other fields
      result.name = row.nom || row.name || undefined;
      result.brand = row.marque || row.brand || undefined;
      result.model = row.modele || row.model || undefined;
      result.location = row.local || row.location || undefined;
      result.level = row.niveau || row.level || undefined;

      // Numeric fields
      const yearStr = row.annee || row.year;
      if (yearStr) {
        const year = parseInt(yearStr);
        if (!isNaN(year) && year >= 1950 && year <= new Date().getFullYear()) {
          result.year = year;
        }
      }

      const powerStr = row.puissance || row.power;
      if (powerStr) {
        const power = parseFloat(powerStr.replace(",", "."));
        if (!isNaN(power) && power > 0) {
          result.power = power;
        }
      }

      const quantityStr = row.quantite || row.quantity;
      if (quantityStr) {
        const quantity = parseInt(quantityStr);
        if (!isNaN(quantity) && quantity > 0) {
          result.quantity = quantity;
        }
      }

      const lifespanStr = row.duree_vie || row.lifespan;
      if (lifespanStr) {
        const lifespan = parseInt(lifespanStr);
        if (!isNaN(lifespan) && lifespan > 0) {
          result.lifespan = lifespan;
        }
      } else {
        result.lifespan = DEFAULT_LIFESPAN[parsedType] || 15;
      }

      results.push(result);
    }

    // If preview, just return results
    if (preview) {
      const validCount = results.filter((r) => r.status !== "error").length;
      const errorCount = results.filter((r) => r.status === "error").length;
      const warningCount = results.filter((r) => r.status === "warning").length;

      return NextResponse.json({
        preview: true,
        total: rows.length,
        valid: validCount,
        errors: errorCount,
        warnings: warningCount,
        results,
      });
    }

    // Import valid rows
    const validRows = results.filter((r) => r.status !== "error" && r.siteId && r.typeParsed);
    let created = 0;

    for (const row of validRows) {
      try {
        await prisma.equipment.create({
          data: {
            name: row.name || undefined,
            domain: row.domain as "CHAUFFAGE" | "ECS" | "VENTILATION" | "CLIMATISATION" | "TRAITEMENT_EAU" | "PLOMBERIE" | "CFO_CFA" | "COMPTAGE" | "AUTRE",
            type: row.typeParsed as "CHAUDIERE" | "CIRCULATEUR", // Type assertion for Prisma
            brand: row.brand || undefined,
            model: row.model || undefined,
            year: row.year || undefined,
            power: row.power || undefined,
            quantity: row.quantity || undefined,
            location: row.location || undefined,
            level: row.level || undefined,
            theoreticalLifespan: row.lifespan || undefined,
            siteId: row.siteId!,
            organizationId: user.organizationId,
          },
        });
        created++;
      } catch (err) {
        console.error(`Error creating equipment for row ${row.row}:`, err);
      }
    }

    return NextResponse.json({
      preview: false,
      total: rows.length,
      created,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    console.error("Error importing equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des équipements" },
      { status: 500 }
    );
  }
}
