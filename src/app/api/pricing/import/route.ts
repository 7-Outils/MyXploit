import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import * as XLSX from "xlsx";
import { SiteType, EnergyType, EquipmentDomain, EquipmentType } from "@/generated/prisma/enums";
import { geocodeAddress } from "@/lib/geocoding";

/**
 * Import combiné sites + équipements pour chiffrage appel d'offres
 *
 * Le fichier Excel doit avoir les colonnes:
 * - Site: nom du site (obligatoire)
 * - Type Site: type de bâtiment (optionnel)
 * - Adresse, Ville, CP: localisation (optionnel)
 * - Équipement: type d'équipement (obligatoire)
 * - Puissance: puissance en kW (optionnel)
 * - Quantité: nombre d'équipements (optionnel, défaut: 1)
 * - Année: année de fabrication/installation (optionnel)
 * - Marque, Modèle: infos équipement (optionnel)
 * - Local, Niveau: localisation dans le bâtiment (optionnel)
 */

// Synonymes pour types de sites
const SITE_TYPE_MAPPING: Record<string, SiteType> = {
  "lycée": SiteType.LYCEE,
  "lycee": SiteType.LYCEE,
  "collège": SiteType.COLLEGE,
  "college": SiteType.COLLEGE,
  "école": SiteType.ECOLE,
  "ecole": SiteType.ECOLE,
  "mairie": SiteType.MAIRIE,
  "hôpital": SiteType.HOPITAL,
  "hopital": SiteType.HOPITAL,
  "gymnase": SiteType.GYMNASE,
  "piscine": SiteType.PISCINE,
  "médiathèque": SiteType.MEDIATHEQUE,
  "mediatheque": SiteType.MEDIATHEQUE,
  "bibliothèque": SiteType.MEDIATHEQUE,
  "bibliotheque": SiteType.MEDIATHEQUE,
};

// Synonymes pour types d'équipements
const EQUIPMENT_TYPE_MAPPING: Record<string, EquipmentType> = {
  // Chauffage - Générateurs
  "chaudière": EquipmentType.CHAUDIERE,
  "chaudiere": EquipmentType.CHAUDIERE,
  "chaudière gaz": EquipmentType.CHAUDIERE,
  "chaudière fioul": EquipmentType.CHAUDIERE,
  "chaudière condensation": EquipmentType.CHAUDIERE_CONDENSATION,
  "chaudiere condensation": EquipmentType.CHAUDIERE_CONDENSATION,
  "pac": EquipmentType.PAC,
  "pompe à chaleur": EquipmentType.PAC,
  "pompe a chaleur": EquipmentType.PAC,
  "pac air eau": EquipmentType.PAC_AIR_EAU,
  "pac air/eau": EquipmentType.PAC_AIR_EAU,
  "pac eau eau": EquipmentType.PAC_EAU_EAU,
  "pac eau/eau": EquipmentType.PAC_EAU_EAU,
  "pac air air": EquipmentType.PAC_AIR_AIR,
  "pac air/air": EquipmentType.PAC_AIR_AIR,
  "brûleur": EquipmentType.BRULEUR,
  "bruleur": EquipmentType.BRULEUR,
  // Émetteurs
  "radiateur": EquipmentType.RADIATEUR,
  "radiateurs": EquipmentType.RADIATEUR,
  "plancher chauffant": EquipmentType.PLANCHER_CHAUFFANT,
  "convecteur": EquipmentType.CONVECTEUR,
  "convecteurs": EquipmentType.CONVECTEUR,
  "aérotherme": EquipmentType.AEROTERME,
  "aerotherme": EquipmentType.AEROTERME,
  "radiant": EquipmentType.RADIANT_GAZ,
  "radiant gaz": EquipmentType.RADIANT_GAZ,
  // Distribution
  "circulateur": EquipmentType.CIRCULATEUR,
  "pompe": EquipmentType.CIRCULATEUR,
  "pompe chauffage": EquipmentType.POMPE_CHAUFFAGE,
  "vanne 3 voies": EquipmentType.VANNE_3_VOIES,
  "v3v": EquipmentType.VANNE_3_VOIES,
  "vanne motorisée": EquipmentType.VANNE_MOTORISEE,
  "vase expansion": EquipmentType.VASE_EXPANSION,
  "échangeur": EquipmentType.ECHANGEUR_THERMIQUE,
  "echangeur": EquipmentType.ECHANGEUR_THERMIQUE,
  "régulateur": EquipmentType.REGULATEUR,
  "regulateur": EquipmentType.REGULATEUR,
  "sonde": EquipmentType.SONDE_TEMPERATURE,
  "sonde extérieure": EquipmentType.SONDE_EXTERIEURE,
  // ECS
  "ballon": EquipmentType.BALLON_ECS,
  "ballon ecs": EquipmentType.BALLON_ECS,
  "cumulus": EquipmentType.BALLON_ECS,
  "chauffe-eau": EquipmentType.BALLON_ECS,
  "ballon thermodynamique": EquipmentType.BALLON_THERMODYNAMIQUE,
  "préparateur ecs": EquipmentType.PREPARATEUR_ECS_GAZ,
  "échangeur ecs": EquipmentType.ECHANGEUR_ECS,
  "pompe bouclage": EquipmentType.POMPE_BOUCLAGE,
  "mitigeur": EquipmentType.MITIGEUR_THERMOSTATIQUE,
  // Ventilation
  "vmc": EquipmentType.VMC,
  "vmc simple flux": EquipmentType.VMC_SIMPLE_FLUX,
  "vmc double flux": EquipmentType.VMC_DOUBLE_FLUX,
  "cta": EquipmentType.CTA,
  "centrale traitement air": EquipmentType.CTA,
  "caisson extraction": EquipmentType.CAISSON_EXTRACTION,
  "caisson soufflage": EquipmentType.CAISSON_SOUFFLAGE,
  "ventilateur": EquipmentType.VENTILATEUR,
  "batterie chaude": EquipmentType.BATTERIE_CHAUDE,
  "batterie froide": EquipmentType.BATTERIE_FROIDE,
  "récupérateur": EquipmentType.RECUPERATEUR_CHALEUR,
  // Climatisation
  "groupe froid": EquipmentType.GROUPE_FROID,
  "clim": EquipmentType.CLIMATISEUR,
  "climatiseur": EquipmentType.CLIMATISEUR,
  "climatisation": EquipmentType.CLIMATISATION,
  "split": EquipmentType.SPLIT,
  "multi split": EquipmentType.MULTI_SPLIT,
  "cassette": EquipmentType.CASSETTE,
  "gainable": EquipmentType.GAINABLE,
  "rooftop": EquipmentType.ROOFTOP,
  // Traitement eau
  "adoucisseur": EquipmentType.ADOUCISSEUR,
  "disconnecteur": EquipmentType.DISCONNECTEUR,
  "filtre": EquipmentType.FILTRE,
  "pot à boue": EquipmentType.POT_BOUE,
  "dégazeur": EquipmentType.DEGAZEUR,
  "doseur": EquipmentType.DOSEUR,
  // Comptage
  "compteur énergie": EquipmentType.COMPTEUR_ENERGIE,
  "compteur calories": EquipmentType.COMPTEUR_CALORIES,
  "compteur gaz": EquipmentType.COMPTEUR_GAZ,
  "compteur eau": EquipmentType.COMPTEUR_EAU,
};

// Mapping type -> domaine
const TYPE_TO_DOMAIN: Record<string, EquipmentDomain> = {
  CHAUDIERE: EquipmentDomain.CHAUFFAGE,
  CHAUDIERE_CONDENSATION: EquipmentDomain.CHAUFFAGE,
  PAC: EquipmentDomain.CHAUFFAGE,
  PAC_AIR_EAU: EquipmentDomain.CHAUFFAGE,
  PAC_EAU_EAU: EquipmentDomain.CHAUFFAGE,
  PAC_AIR_AIR: EquipmentDomain.CHAUFFAGE,
  BRULEUR: EquipmentDomain.CHAUFFAGE,
  RADIATEUR: EquipmentDomain.CHAUFFAGE,
  PLANCHER_CHAUFFANT: EquipmentDomain.CHAUFFAGE,
  CONVECTEUR: EquipmentDomain.CHAUFFAGE,
  AEROTERME: EquipmentDomain.CHAUFFAGE,
  RADIANT_GAZ: EquipmentDomain.CHAUFFAGE,
  CIRCULATEUR: EquipmentDomain.CHAUFFAGE,
  POMPE_CHAUFFAGE: EquipmentDomain.CHAUFFAGE,
  VANNE_3_VOIES: EquipmentDomain.CHAUFFAGE,
  VANNE_MOTORISEE: EquipmentDomain.CHAUFFAGE,
  VASE_EXPANSION: EquipmentDomain.CHAUFFAGE,
  ECHANGEUR_THERMIQUE: EquipmentDomain.CHAUFFAGE,
  REGULATEUR: EquipmentDomain.CHAUFFAGE,
  SONDE_TEMPERATURE: EquipmentDomain.CHAUFFAGE,
  SONDE_EXTERIEURE: EquipmentDomain.CHAUFFAGE,
  BALLON_ECS: EquipmentDomain.ECS,
  BALLON_THERMODYNAMIQUE: EquipmentDomain.ECS,
  PREPARATEUR_ECS_GAZ: EquipmentDomain.ECS,
  ECHANGEUR_ECS: EquipmentDomain.ECS,
  POMPE_BOUCLAGE: EquipmentDomain.ECS,
  MITIGEUR_THERMOSTATIQUE: EquipmentDomain.ECS,
  RESISTANCE_ELECTRIQUE: EquipmentDomain.ECS,
  VMC: EquipmentDomain.VENTILATION,
  VMC_SIMPLE_FLUX: EquipmentDomain.VENTILATION,
  VMC_DOUBLE_FLUX: EquipmentDomain.VENTILATION,
  CTA: EquipmentDomain.VENTILATION,
  CAISSON_EXTRACTION: EquipmentDomain.VENTILATION,
  CAISSON_SOUFFLAGE: EquipmentDomain.VENTILATION,
  VENTILATEUR: EquipmentDomain.VENTILATION,
  BATTERIE_CHAUDE: EquipmentDomain.VENTILATION,
  BATTERIE_FROIDE: EquipmentDomain.VENTILATION,
  RECUPERATEUR_CHALEUR: EquipmentDomain.VENTILATION,
  GROUPE_FROID: EquipmentDomain.CLIMATISATION,
  CLIMATISATION: EquipmentDomain.CLIMATISATION,
  CLIMATISEUR: EquipmentDomain.CLIMATISATION,
  SPLIT: EquipmentDomain.CLIMATISATION,
  MULTI_SPLIT: EquipmentDomain.CLIMATISATION,
  CASSETTE: EquipmentDomain.CLIMATISATION,
  GAINABLE: EquipmentDomain.CLIMATISATION,
  ROOFTOP: EquipmentDomain.CLIMATISATION,
  ADOUCISSEUR: EquipmentDomain.TRAITEMENT_EAU,
  DISCONNECTEUR: EquipmentDomain.TRAITEMENT_EAU,
  FILTRE: EquipmentDomain.TRAITEMENT_EAU,
  POT_BOUE: EquipmentDomain.TRAITEMENT_EAU,
  DEGAZEUR: EquipmentDomain.TRAITEMENT_EAU,
  DOSEUR: EquipmentDomain.TRAITEMENT_EAU,
  COMPTEUR_ENERGIE: EquipmentDomain.COMPTAGE,
  COMPTEUR_CALORIES: EquipmentDomain.COMPTAGE,
  COMPTEUR_GAZ: EquipmentDomain.COMPTAGE,
  COMPTEUR_EAU: EquipmentDomain.COMPTAGE,
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
  VENTILATEUR: 15, BATTERIE_CHAUDE: 20, BATTERIE_FROIDE: 20, RECUPERATEUR_CHALEUR: 15,
  GROUPE_FROID: 20, CLIMATISATION: 15, CLIMATISEUR: 15, SPLIT: 12, MULTI_SPLIT: 12, CASSETTE: 12, GAINABLE: 15, ROOFTOP: 20,
  ADOUCISSEUR: 15, DISCONNECTEUR: 20, FILTRE: 10, POT_BOUE: 20, DEGAZEUR: 20, DOSEUR: 10,
  COMPTEUR_ENERGIE: 15, COMPTEUR_CALORIES: 15, COMPTEUR_GAZ: 15, COMPTEUR_EAU: 15,
  AUTRE: 15,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, " ")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findEquipmentType(input: string): EquipmentType | null {
  const normalized = normalize(input);

  // Exact enum match
  const allTypes = Object.values(EquipmentType);
  if (allTypes.includes(input.toUpperCase() as EquipmentType)) {
    return input.toUpperCase() as EquipmentType;
  }

  // Synonym match
  if (EQUIPMENT_TYPE_MAPPING[normalized]) {
    return EQUIPMENT_TYPE_MAPPING[normalized];
  }

  // Partial match
  for (const [synonym, type] of Object.entries(EQUIPMENT_TYPE_MAPPING)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return type;
    }
  }

  return null;
}

function findSiteType(input: string): SiteType {
  const normalized = normalize(input);

  // Exact enum match
  const allTypes = Object.values(SiteType);
  if (allTypes.includes(input.toUpperCase() as SiteType)) {
    return input.toUpperCase() as SiteType;
  }

  // Synonym match
  if (SITE_TYPE_MAPPING[normalized]) {
    return SITE_TYPE_MAPPING[normalized];
  }

  return SiteType.AUTRE;
}

// Column name mapping
const COLUMN_MAPPING: Record<string, string> = {
  // Site columns
  "site": "siteName",
  "nom site": "siteName",
  "nom du site": "siteName",
  "batiment": "siteName",
  "bâtiment": "siteName",
  "type site": "siteType",
  "type de site": "siteType",
  "adresse": "address",
  "ville": "city",
  "code postal": "postalCode",
  "cp": "postalCode",
  "surface": "surface",
  // Equipment columns
  "equipement": "equipmentType",
  "équipement": "equipmentType",
  "type equipement": "equipmentType",
  "type équipement": "equipmentType",
  "type": "equipmentType",
  "designation": "equipmentName",
  "désignation": "equipmentName",
  "nom equipement": "equipmentName",
  "puissance": "power",
  "puissance kw": "power",
  "puissance (kw)": "power",
  "kw": "power",
  "quantite": "quantity",
  "quantité": "quantity",
  "qte": "quantity",
  "qty": "quantity",
  "nombre": "quantity",
  "annee": "year",
  "année": "year",
  "annee installation": "year",
  "année installation": "year",
  "date installation": "installDate",
  "marque": "brand",
  "modele": "model",
  "modèle": "model",
  "local": "location",
  "emplacement": "location",
  "niveau": "level",
  "etage": "level",
  "étage": "level",
};

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const str = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

function parseInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const str = String(value).replace(/[^\d]/g, "");
  const num = Number.parseInt(str, 10);
  return isNaN(num) ? undefined : num;
}

export interface ImportedEquipmentRow {
  // Site info
  siteName: string;
  siteType?: SiteType;
  address?: string;
  city?: string;
  postalCode?: string;
  surface?: number;
  // Equipment info
  equipmentType: EquipmentType;
  equipmentTypeParsed: string;
  equipmentName?: string;
  domain?: EquipmentDomain;
  power?: number;
  quantity?: number;
  year?: number;
  brand?: string;
  model?: string;
  location?: string;
  level?: string;
  theoreticalLifespan?: number;
  // Status
  status: "ok" | "warning" | "error";
  message?: string;
  rowNumber: number;
}

// POST /api/pricing/import - Parse Excel file and return structured data for pricing
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const saveToDb = formData.get("saveToDb") === "true";
    const projectName = formData.get("projectName") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide" }, { status: 400 });
    }

    // Detect columns
    const firstRow = rows[0];
    const columnMap = new Map<string, string>();

    for (const col of Object.keys(firstRow)) {
      const normalizedCol = normalize(col);
      if (COLUMN_MAPPING[normalizedCol]) {
        columnMap.set(col, COLUMN_MAPPING[normalizedCol]);
      }
    }

    // Check required columns
    const hasSiteColumn = Array.from(columnMap.values()).includes("siteName");
    const hasEquipmentColumn = Array.from(columnMap.values()).includes("equipmentType");

    if (!hasSiteColumn || !hasEquipmentColumn) {
      return NextResponse.json({
        error: "Colonnes obligatoires manquantes",
        details: `Colonnes détectées: ${Array.from(columnMap.keys()).join(", ")}. Colonnes requises: Site, Équipement/Type`,
      }, { status: 400 });
    }

    // Parse rows
    const parsedRows: ImportedEquipmentRow[] = [];
    const sites = new Map<string, {
      name: string;
      type: SiteType;
      address?: string;
      city?: string;
      postalCode?: string;
      surface?: number;
      equipments: ImportedEquipmentRow[];
    }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result: Partial<ImportedEquipmentRow> = {
        rowNumber: i + 2, // Excel rows start at 1, header is row 1
        status: "ok",
      };

      // Extract values
      for (const [col, field] of columnMap.entries()) {
        const value = row[col];

        switch (field) {
          case "siteName":
            result.siteName = value ? String(value).trim() : undefined;
            break;
          case "siteType":
            result.siteType = value ? findSiteType(String(value)) : SiteType.AUTRE;
            break;
          case "address":
            result.address = value ? String(value).trim() : undefined;
            break;
          case "city":
            result.city = value ? String(value).trim() : undefined;
            break;
          case "postalCode":
            result.postalCode = value ? String(value).trim() : undefined;
            break;
          case "surface":
            result.surface = parseNumber(value);
            break;
          case "equipmentType":
            result.equipmentTypeParsed = value ? String(value).trim() : "";
            const eqType = value ? findEquipmentType(String(value)) : null;
            if (eqType) {
              result.equipmentType = eqType;
              result.domain = TYPE_TO_DOMAIN[eqType] || EquipmentDomain.AUTRE;
            }
            break;
          case "equipmentName":
            result.equipmentName = value ? String(value).trim() : undefined;
            break;
          case "power":
            result.power = parseNumber(value);
            break;
          case "quantity":
            result.quantity = parseInt(value) || 1;
            break;
          case "year":
            result.year = parseInt(value);
            break;
          case "brand":
            result.brand = value ? String(value).trim() : undefined;
            break;
          case "model":
            result.model = value ? String(value).trim() : undefined;
            break;
          case "location":
            result.location = value ? String(value).trim() : undefined;
            break;
          case "level":
            result.level = value ? String(value).trim() : undefined;
            break;
        }
      }

      // Validate
      if (!result.siteName) {
        result.status = "error";
        result.message = "Nom du site manquant";
        parsedRows.push(result as ImportedEquipmentRow);
        continue;
      }

      if (!result.equipmentType) {
        result.status = "error";
        result.message = `Type d'équipement non reconnu: "${result.equipmentTypeParsed}"`;
        parsedRows.push(result as ImportedEquipmentRow);
        continue;
      }

      // Set default lifespan
      result.theoreticalLifespan = DEFAULT_LIFESPAN[result.equipmentType] || 15;

      // Add to sites map
      const siteKey = normalize(result.siteName);
      if (!sites.has(siteKey)) {
        sites.set(siteKey, {
          name: result.siteName,
          type: result.siteType || SiteType.AUTRE,
          address: result.address,
          city: result.city,
          postalCode: result.postalCode,
          surface: result.surface,
          equipments: [],
        });
      }
      sites.get(siteKey)!.equipments.push(result as ImportedEquipmentRow);
      parsedRows.push(result as ImportedEquipmentRow);
    }

    // Calculate stats
    const validRows = parsedRows.filter(r => r.status !== "error");
    const errorRows = parsedRows.filter(r => r.status === "error");

    // If saveToDb, create the sites and equipments
    let savedData = null;
    if (saveToDb && projectName && validRows.length > 0) {
      savedData = await saveToDatabase(request, projectName, sites);
    }

    return NextResponse.json({
      success: true,
      columns: Array.from(columnMap.entries()).map(([orig, mapped]) => ({ original: orig, mapped })),
      stats: {
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: errorRows.length,
        siteCount: sites.size,
        equipmentCount: validRows.length,
      },
      sites: Array.from(sites.values()).map(site => ({
        name: site.name,
        type: site.type,
        address: site.address,
        city: site.city,
        postalCode: site.postalCode,
        surface: site.surface,
        equipmentCount: site.equipments.length,
      })),
      equipments: validRows,
      errors: errorRows,
      savedData,
    });
  } catch (error) {
    console.error("Error importing file:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import du fichier" },
      { status: 500 }
    );
  }
}

async function saveToDatabase(
  request: NextRequest,
  projectName: string,
  sites: Map<string, {
    name: string;
    type: SiteType;
    address?: string;
    city?: string;
    postalCode?: string;
    surface?: number;
    equipments: ImportedEquipmentRow[];
  }>
) {
  const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

  // Create a contract as "project" for the tender
  const contract = await prisma.contract.create({
    data: {
      reference: `AO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
      title: projectName,
      provider: user.organization?.name || "À définir",
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 8)), // 8 ans par défaut
      status: "EN_ATTENTE",
      description: `Projet d'appel d'offres importé le ${new Date().toLocaleDateString("fr-FR")}`,
      organizationId: effectiveOrgId,
    },
  });

  const createdSites: Array<{ id: string; name: string; equipmentCount: number }> = [];

  for (const [, siteData] of sites) {
    // Geocode address if provided
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (siteData.address && siteData.city) {
      const geoResult = await geocodeAddress(
        siteData.address,
        siteData.city,
        siteData.postalCode || ""
      );
      if (geoResult) {
        latitude = geoResult.latitude;
        longitude = geoResult.longitude;
      }
    }

    // Create site
    const site = await prisma.site.create({
      data: {
        name: siteData.name,
        type: siteData.type,
        address: siteData.address || "",
        city: siteData.city || "",
        postalCode: siteData.postalCode || "",
        surface: siteData.surface,
        energyType: EnergyType.GAZ, // Default
        latitude,
        longitude,
        organizationId: effectiveOrgId,
        createdById: user.id,
      },
    });

    // Link to contract
    await prisma.contractSite.create({
      data: {
        contractId: contract.id,
        siteId: site.id,
        hasP2: true,
        hasP3: true,
      },
    });

    // Create equipments
    let eqCount = 0;
    for (const eq of siteData.equipments) {
      if (eq.status === "error") continue;

      await prisma.equipment.create({
        data: {
          name: eq.equipmentName || undefined,
          domain: eq.domain || EquipmentDomain.CHAUFFAGE,
          type: eq.equipmentType,
          brand: eq.brand || undefined,
          model: eq.model || undefined,
          power: eq.power,
          quantity: eq.quantity || 1,
          year: eq.year,
          location: eq.location,
          level: eq.level,
          theoreticalLifespan: eq.theoreticalLifespan,
          siteId: site.id,
          organizationId: effectiveOrgId,
        },
      });
      eqCount++;
    }

    createdSites.push({
      id: site.id,
      name: site.name,
      equipmentCount: eqCount,
    });
  }

  return {
    contractId: contract.id,
    contractReference: contract.reference,
    sitesCreated: createdSites.length,
    sites: createdSites,
  };
}
