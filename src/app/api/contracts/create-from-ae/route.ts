import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { ContractType, EnergyType, NbUnit, SiteType } from "@/generated/prisma/client";

// Determine NB unit based on energy type
function getNbUnitForEnergyType(energyType: EnergyType): NbUnit {
  switch (energyType) {
    case "GAZ":
    case "FIOUL":
    case "BOIS":
      return "PCS";
    case "RESEAU_CHALEUR":
    case "ELECTRICITE":
      return "UTILE";
    default:
      return "PCS";
  }
}

// Map contract type string to enum
// Note: P2 is ALWAYS required, P1 and P3 are optional
// P1 is NOT available for PF/PFI contracts (no energy supply)
function getContractTypeInfo(type: string): {
  contractType: ContractType;
  canHaveP1: boolean; // Whether P1 is allowed for this contract type
} {
  const normalized = type ? type.toUpperCase().trim() : "";
  switch (normalized) {
    case "PFI": // Prestation Forfaitaire Intégrale - NO P1 allowed
      return { contractType: "PFI", canHaveP1: false };
    case "PF": // Prestation Forfaitaire - NO P1 allowed
      return { contractType: "PF", canHaveP1: false };
    case "MTI": // Marché Tout Intégré
      return { contractType: "MTI", canHaveP1: true };
    case "MCI": // Marché Chauffage Intégré
      return { contractType: "MCI", canHaveP1: true };
    case "CPI": // Chauffage Performance Intégré
      return { contractType: "CPI", canHaveP1: true };
    case "MT": // Marché Type
      return { contractType: "MT", canHaveP1: true };
    case "CP": // Contrat Performance
      return { contractType: "CP", canHaveP1: true };
    case "MC": // Marché Combustible
      return { contractType: "MC", canHaveP1: true };
    case "MF": // Marché Forfait
      return { contractType: "MF", canHaveP1: true };
    default:
      return { contractType: "PFI", canHaveP1: false };
  }
}

interface P1Components {
  peg?: number;      // PEG (€/MWh)
  tvd?: number;      // TVD (€/MWh)
  ticgn?: number;    // TICGN (€/MWh)
  cee?: number;      // CEE (€/MWh)
  p0?: number;       // P0 (€/MWh)
  pu?: number;       // Prix Unitaire total (€/MWh)
  abonnement?: number; // Abonnement (€/an)
  locationCompteur?: number; // Location compteur (€/an)
}

interface ParsedSite {
  row: number;
  siteName: string;
  contractType: string;
  contractTypeInfo: ReturnType<typeof getContractTypeInfo>;
  nb: { [year: number]: number | null };
  // P1 components (for price revision)
  p1Components: P1Components;
  // P1 values by year (calculated in AE but imported for reference)
  p1ByYear: { [year: number]: number | null };
  // P2 with 10 sub-components
  p2: {
    p21?: number;
    p22?: number;
    p23?: number;
    p24?: number;
    p25?: number;
    p26?: number;
    p27?: number;
    p28?: number;
    p29?: number;
    p210?: number;
    total?: number;
  };
  // P3 with 10 sub-components
  p3: {
    p31?: number;
    p32?: number;
    p33?: number;
    p34?: number;
    p35?: number;
    p36?: number;
    p37?: number;
    p38?: number;
    p39?: number;
    p310?: number;
    total?: number;
  };
  existingSite?: { id: string; name: string };
}

interface ContractMetadata {
  reference?: string;
  title?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  billingFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  stationMeteo?: string;
  djuContractuel?: number;
}

// Site details from "Sites" sheet
interface SiteDetails {
  name: string;
  type?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  surface?: number;
  surfaceChauffee?: number;
  energyType?: string;
  pce?: string;
  pdl?: string;
  rae?: string;
}

// Convert Excel serial date to DD/MM/YYYY string
function excelDateToString(value: string | number): string {
  // If it's already a string in date format, return as-is
  if (typeof value === "string") {
    // Check if it looks like a date already (contains / or -)
    if (value.includes("/") || value.includes("-")) {
      return value;
    }
    // Try to parse as number
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    value = num;
  }

  // Convert Excel serial date (days since 1899-12-30)
  // Excel incorrectly treats 1900 as a leap year, so we adjust
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Parse "Contrat" sheet for metadata
function parseContractMetadataSheet(workbook: XLSX.WorkBook): ContractMetadata | null {
  // Look for a "Contrat" sheet (case insensitive)
  const contratSheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase() === "contrat" || name.toLowerCase() === "info" || name.toLowerCase() === "metadata"
  );

  if (!contratSheetName) return null;

  const sheet = workbook.Sheets[contratSheetName];
  const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

  const metadata: ContractMetadata = {};

  // Parse key-value pairs (looking for "Champ | Valeur" format)
  for (const row of rawData) {
    if (!row || row.length < 2) continue;

    const key = String(row[0] || "").trim().toLowerCase();
    const value = String(row[1] || "").trim();

    if (!key || !value || key === "champ") continue; // Skip header row

    // Map fields
    if (key.includes("référence") || key.includes("reference")) {
      metadata.reference = value;
    } else if (key === "titre" || key === "title") {
      metadata.title = value;
    } else if (key.includes("titulaire") || key.includes("provider") || key.includes("prestataire")) {
      metadata.provider = value;
    } else if (key.includes("date de début") || key.includes("date début") || key.includes("start")) {
      // Parse date - convert Excel serial if needed
      metadata.startDate = excelDateToString(row[1]);
    } else if (key.includes("date de fin") || key.includes("date fin") || key.includes("end")) {
      metadata.endDate = excelDateToString(row[1]);
    } else if (key.includes("type année") || key.includes("type annee") || key.includes("année") || key.includes("annee")) {
      const lowerValue = value.toLowerCase();
      if (lowerValue.includes("civile")) {
        metadata.yearType = "CIVIL";
      } else if (lowerValue.includes("chauffe") || lowerValue.includes("saison")) {
        metadata.yearType = "HEATING_SEASON";
      } else if (lowerValue.includes("contractuel")) {
        metadata.yearType = "CONTRACTUAL";
      }
    } else if (key.includes("facturation") || key.includes("billing") || key.includes("fréquence")) {
      const lowerValue = value.toLowerCase();
      if (lowerValue.includes("mensuel")) {
        metadata.billingFrequency = "MENSUEL";
      } else if (lowerValue.includes("trimestriel")) {
        metadata.billingFrequency = "TRIMESTRIEL";
      } else if (lowerValue.includes("semestriel")) {
        metadata.billingFrequency = "SEMESTRIEL";
      } else if (lowerValue.includes("annuel")) {
        metadata.billingFrequency = "ANNUEL";
      }
    } else if (key.includes("station") || key.includes("météo") || key.includes("meteo")) {
      metadata.stationMeteo = value;
    } else if (key.includes("dju") && (key.includes("contractuel") || key.includes("contrat") || key.includes("référence") || key.includes("reference"))) {
      // Parse DJU contractuel - can be number or string with comma
      const djuValue = typeof row[1] === "number" ? row[1] : parseFloat(String(row[1] || "").replace(",", ".").replace(/\s/g, ""));
      if (!isNaN(djuValue) && djuValue > 0) {
        metadata.djuContractuel = Math.round(djuValue);
      }
    }
  }

  // Only return if we found at least one field
  const hasAnyField = metadata.reference || metadata.title || metadata.provider ||
                      metadata.startDate || metadata.endDate || metadata.yearType ||
                      metadata.billingFrequency || metadata.stationMeteo || metadata.djuContractuel;

  return hasAnyField ? metadata : null;
}

// Parse "Sites" sheet for site details (address, surface, etc.)
function parseSitesSheet(workbook: XLSX.WorkBook): Map<string, SiteDetails> {
  const siteDetailsMap = new Map<string, SiteDetails>();

  // Look for a "Sites" sheet (case insensitive)
  const sitesSheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase() === "sites" || name.toLowerCase() === "liste sites"
  );

  if (!sitesSheetName) return siteDetailsMap;

  const sheet = workbook.Sheets[sitesSheetName];
  const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

  if (rawData.length < 2) return siteDetailsMap;

  // Find header row
  let headerRowIndex = 0;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    const rowHeaders = row.map((h) => String(h || "").trim().toLowerCase());

    // Look for typical site columns
    const hasName = rowHeaders.some(h => h === "libellé" || h === "libelle" || h === "nom" || h === "site");
    const hasAddress = rowHeaders.some(h => h.includes("adresse") || h === "address");
    const hasSurface = rowHeaders.some(h => h.includes("surface"));

    if (hasName && (hasAddress || hasSurface)) {
      headerRowIndex = i;
      headers = row.map((h) => String(h || "").trim());
      break;
    }
  }

  if (headers.length === 0) {
    headers = rawData[0].map((h) => String(h || "").trim());
  }

  // Column mapping
  const colMapping: Record<string, number> = {};
  headers.forEach((h, index) => {
    if (!h) return;
    const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (lower === "libelle" || lower === "nom" || lower === "site" || lower === "installation") {
      colMapping.name = index;
    } else if (lower === "type" || lower === "type de site" || lower === "type site") {
      colMapping.type = index;
    } else if (lower === "adresse" || lower === "address") {
      colMapping.address = index;
    } else if (lower === "ville" || lower === "city" || lower === "commune") {
      colMapping.city = index;
    } else if (lower === "code postal" || lower === "cp" || lower === "postalcode" || lower === "postal") {
      colMapping.postalCode = index;
    } else if (lower === "surface chauffee" || lower === "surface chauffee (m²)" || lower === "surface chauffee m2") {
      colMapping.surfaceChauffee = index;
    } else if (lower === "surface" || lower === "surface (m²)" || lower === "surface m2" || lower === "surface totale") {
      colMapping.surface = index;
    } else if (lower === "energie" || lower === "type energie" || lower === "energytype" || lower === "type d'energie") {
      colMapping.energyType = index;
    } else if (lower === "pce" || lower === "point de comptage") {
      colMapping.pce = index;
    } else if (lower === "pdl" || lower === "point de livraison") {
      colMapping.pdl = index;
    } else if (lower === "rae" || lower === "reference acheminement") {
      colMapping.rae = index;
    }
  });

  // Must have at least name column
  if (colMapping.name === undefined) return siteDetailsMap;

  // Parse each row
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const name = String(row[colMapping.name] || "").trim();
    if (!name) continue;

    const parseNum = (idx: number | undefined): number | undefined => {
      if (idx === undefined) return undefined;
      const val = row[idx];
      const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", ".").replace(/\s/g, ""));
      return isNaN(num) ? undefined : num;
    };

    const parseStr = (idx: number | undefined): string | undefined => {
      if (idx === undefined) return undefined;
      const val = row[idx];
      const str = String(val || "").trim();
      return str || undefined;
    };

    const siteDetail: SiteDetails = {
      name,
      type: parseStr(colMapping.type),
      address: parseStr(colMapping.address),
      city: parseStr(colMapping.city),
      postalCode: parseStr(colMapping.postalCode),
      surface: parseNum(colMapping.surface),
      surfaceChauffee: parseNum(colMapping.surfaceChauffee),
      energyType: parseStr(colMapping.energyType),
      pce: parseStr(colMapping.pce),
      pdl: parseStr(colMapping.pdl),
      rae: parseStr(colMapping.rae),
    };

    // Store with normalized name for matching
    const normalizedName = normalizeSiteName(name);
    siteDetailsMap.set(normalizedName, siteDetail);
  }

  return siteDetailsMap;
}

// Parse site type string to enum
function parseSiteType(value?: string): SiteType {
  if (!value) return SiteType.AUTRE;
  const upper = value.toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Available types: LYCEE, COLLEGE, ECOLE, MAIRIE, HOPITAL, GYMNASE, PISCINE, MEDIATHEQUE, AUTRE
  const mapping: Record<string, SiteType> = {
    "LYCEE": SiteType.LYCEE,
    "COLLEGE": SiteType.COLLEGE,
    "ECOLE": SiteType.ECOLE,
    "MAIRIE": SiteType.MAIRIE,
    "PISCINE": SiteType.PISCINE,
    "GYMNASE": SiteType.GYMNASE,
    "MEDIATHEQUE": SiteType.MEDIATHEQUE,
    "HOPITAL": SiteType.HOPITAL,
  };

  for (const [key, val] of Object.entries(mapping)) {
    if (upper.includes(key)) return val;
  }
  return SiteType.AUTRE;
}

// Parse energy type string to enum
function parseEnergyType(value?: string): EnergyType {
  if (!value) return EnergyType.GAZ;
  const upper = value.toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (upper.includes("ELECTRICITE") || upper.includes("ELEC")) return EnergyType.ELECTRICITE;
  if (upper.includes("RESEAU") || upper.includes("CHALEUR")) return EnergyType.RESEAU_CHALEUR;
  if (upper.includes("FIOUL") || upper.includes("FUEL")) return EnergyType.FIOUL;
  if (upper.includes("BOIS") || upper.includes("BIOMASSE")) return EnergyType.BOIS;

  return EnergyType.GAZ;
}

// POST /api/contracts/create-from-ae - Create contract from AE file
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un contrat" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const previewMode = formData.get("preview") === "true";

    // Contract info (required when not in preview mode)
    const reference = formData.get("reference") as string;
    const title = formData.get("title") as string;
    const provider = formData.get("provider") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const yearType = (formData.get("yearType") as string) || "HEATING_SEASON";
    const billingFrequency = (formData.get("billingFrequency") as string) || "TRIMESTRIEL";

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    // Parse contract metadata from "Contrat" sheet if available
    const detectedMetadata = parseContractMetadataSheet(workbook);

    // Parse site details from "Sites" sheet if available
    const siteDetailsMap = parseSitesSheet(workbook);

    // Use "P2P3" or "Sites" sheet if available, otherwise first non-metadata sheet
    const dataSheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase() === "p2p3" || name.toLowerCase() === "sites"
    ) || workbook.SheetNames.find(
      (name) => !["contrat", "info", "metadata"].includes(name.toLowerCase())
    ) || workbook.SheetNames[0];
    const sheetName = dataSheetName;
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: "Le fichier ne contient pas de données" },
        { status: 400 }
      );
    }

    // Find header row (scan first 15 rows)
    let headerRowIndex = 0;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (!row) continue;
      const rowHeaders = row.map((h) => String(h || "").trim().toLowerCase());

      const hasLibelle = rowHeaders.some(h => h === "libellé" || h === "libelle");
      const hasP2 = rowHeaders.some(h => h.includes("p2") && h.includes("annuel"));
      const hasNB = rowHeaders.some(h => h.includes("nb") && h.includes("ann"));

      if ((hasLibelle && hasP2) || (hasLibelle && hasNB)) {
        headerRowIndex = i;
        headers = row.map((h) => String(h || "").trim());
        break;
      }
    }

    if (headers.length === 0) {
      headers = rawData[0].map((h) => String(h || "").trim());
    }

    // Find column indices
    const findColIndex = (patterns: string[]): number => {
      return headers.findIndex((h) => {
        if (!h) return false;
        const lower = h.toLowerCase();
        return patterns.some(p => lower.includes(p));
      });
    };

    const findExactColIndex = (pattern: RegExp): number => {
      return headers.findIndex((h) => h && pattern.test(h.toLowerCase()));
    };

    // Site name column (Libellé)
    let siteColIndex = headers.findIndex(h =>
      h && (h.toLowerCase() === "libellé" || h.toLowerCase() === "libelle")
    );
    if (siteColIndex === -1) {
      siteColIndex = findColIndex(["site", "installation", "nom"]);
    }
    if (siteColIndex === -1) siteColIndex = 1;

    // Contract type column - support various formats
    const contractTypeColIndex = headers.findIndex(h => {
      if (!h) return false;
      const lower = h.toLowerCase().trim();
      return lower === "contrat" ||
             lower === "type contrat" ||
             lower === "type de contrat" ||
             lower === "type" ||
             lower === "formule" ||
             lower === "formule contrat" ||
             lower === "type formule";
    });

    // NB columns
    const nbColumns: { index: number; year: number }[] = [];
    headers.forEach((h, index) => {
      if (!h) return;
      const lower = h.toLowerCase();
      const nbYearMatch = lower.match(/nb\s*[-–]\s*ann[eé]e\s*(\d+)/);
      if (nbYearMatch) {
        nbColumns.push({ index, year: parseInt(nbYearMatch[1]) });
      }
    });
    nbColumns.sort((a, b) => a.year - b.year);

    // P1 components columns (for price revision)
    const pegColIndex = findColIndex(["peg"]);
    const tvdColIndex = findColIndex(["tvd"]);
    const ticgnColIndex = findColIndex(["ticgn"]);
    const ceeColIndex = findColIndex(["cee"]);
    const p0ColIndex = headers.findIndex(h => h && h.toLowerCase() === "p0");
    const puColIndex = headers.findIndex(h => h && h.toLowerCase() === "pu");
    const abonnementColIndex = findColIndex(["abonnement"]);
    const locationCompteurColIndex = findColIndex(["location compteur", "location"]);

    // P1 HT by year columns (P1 HT - Année 1, P1 HT - Année 2, etc.)
    const p1Columns: { index: number; year: number }[] = [];
    headers.forEach((h, index) => {
      if (!h) return;
      const lower = h.toLowerCase();
      const p1YearMatch = lower.match(/p1\s*ht\s*[-–]\s*ann[eé]e\s*(\d+)/);
      if (p1YearMatch) {
        p1Columns.push({ index, year: parseInt(p1YearMatch[1]) });
      }
    });
    p1Columns.sort((a, b) => a.year - b.year);

    // P2 columns - Support both "P2 01" and "P21" formats
    const findP2ColIndex = (num: number): number => {
      // Try "P2 01", "P2 02" format first (user's template)
      const paddedNum = num.toString().padStart(2, "0");
      let idx = headers.findIndex(h => h && h.toLowerCase() === `p2 ${paddedNum}`);
      if (idx !== -1) return idx;
      // Fallback to old format "P21", "P22" etc.
      return findExactColIndex(new RegExp(`p2${num}.*annuel`));
    };
    const p21ColIndex = findP2ColIndex(1);
    const p22ColIndex = findP2ColIndex(2);
    const p23ColIndex = findP2ColIndex(3);
    const p24ColIndex = findP2ColIndex(4);
    const p25ColIndex = findP2ColIndex(5);
    const p26ColIndex = findP2ColIndex(6);
    const p27ColIndex = findP2ColIndex(7);
    const p28ColIndex = findP2ColIndex(8);
    const p29ColIndex = findP2ColIndex(9);
    const p210ColIndex = findP2ColIndex(10);
    const p2TotalColIndex = headers.findIndex(h =>
      h && (h.toLowerCase() === "p2 ht - total" || /p2\s*[-–]\s*total/.test(h.toLowerCase()))
    );

    // P3 columns - Support both "P3 01" and "P31" formats
    const findP3ColIndex = (num: number): number => {
      // Try "P3 01", "P3 02" format first (user's template)
      const paddedNum = num.toString().padStart(2, "0");
      let idx = headers.findIndex(h => h && h.toLowerCase() === `p3 ${paddedNum}`);
      if (idx !== -1) return idx;
      // Fallback to old format "P31", "P32" etc.
      return findExactColIndex(new RegExp(`p3${num}.*annuel`));
    };
    const p31ColIndex = findP3ColIndex(1);
    const p32ColIndex = findP3ColIndex(2);
    const p33ColIndex = findP3ColIndex(3);
    const p34ColIndex = findP3ColIndex(4);
    const p35ColIndex = findP3ColIndex(5);
    const p36ColIndex = findP3ColIndex(6);
    const p37ColIndex = findP3ColIndex(7);
    const p38ColIndex = findP3ColIndex(8);
    const p39ColIndex = findP3ColIndex(9);
    const p310ColIndex = findP3ColIndex(10);
    const p3TotalColIndex = headers.findIndex(h =>
      h && (h.toLowerCase() === "p3 ht - total" || /p3\s*[-–]\s*total/.test(h.toLowerCase()))
    );

    // Get existing sites for matching
    const existingSites = await prisma.site.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, city: true, energyType: true },
    });

    const siteMatchers = createSiteMatchers(existingSites);

    // Parse helper
    const parseNum = (row: (string | number)[], idx: number): number | undefined => {
      if (idx === -1) return undefined;
      const val = row[idx];
      const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", "."));
      return isNaN(num) ? undefined : num;
    };

    // Parse all sites from file
    const parsedSites: ParsedSite[] = [];

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;
      const rowNum = i + 1;

      const siteName = String(row[siteColIndex] || "").trim();
      if (!siteName) continue;
      if (siteName.toLowerCase().includes("total") || /^\d+$/.test(siteName)) continue;

      // Get contract type
      const contractTypeStr = contractTypeColIndex !== -1
        ? String(row[contractTypeColIndex] || "").trim()
        : "PFI";
      const contractTypeInfo = getContractTypeInfo(contractTypeStr);

      // Parse NB values
      const nb: { [year: number]: number | null } = {};
      for (const nbCol of nbColumns) {
        const val = row[nbCol.index];
        const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", "."));
        nb[nbCol.year] = isNaN(num) ? null : num;
      }

      // Parse P1 components
      const p1Components: P1Components = {
        peg: parseNum(row, pegColIndex),
        tvd: parseNum(row, tvdColIndex),
        ticgn: parseNum(row, ticgnColIndex),
        cee: parseNum(row, ceeColIndex),
        p0: parseNum(row, p0ColIndex),
        pu: parseNum(row, puColIndex),
        abonnement: parseNum(row, abonnementColIndex),
        locationCompteur: parseNum(row, locationCompteurColIndex),
      };

      // Parse P1 by year
      const p1ByYear: { [year: number]: number | null } = {};
      for (const p1Col of p1Columns) {
        const val = row[p1Col.index];
        const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", "."));
        p1ByYear[p1Col.year] = isNaN(num) ? null : num;
      }

      // Parse P2 with 10 sub-components
      const p2 = {
        p21: parseNum(row, p21ColIndex),
        p22: parseNum(row, p22ColIndex),
        p23: parseNum(row, p23ColIndex),
        p24: parseNum(row, p24ColIndex),
        p25: parseNum(row, p25ColIndex),
        p26: parseNum(row, p26ColIndex),
        p27: parseNum(row, p27ColIndex),
        p28: parseNum(row, p28ColIndex),
        p29: parseNum(row, p29ColIndex),
        p210: parseNum(row, p210ColIndex),
        total: parseNum(row, p2TotalColIndex),
      };

      // Parse P3 with 10 sub-components
      const p3 = {
        p31: parseNum(row, p31ColIndex),
        p32: parseNum(row, p32ColIndex),
        p33: parseNum(row, p33ColIndex),
        p34: parseNum(row, p34ColIndex),
        p35: parseNum(row, p35ColIndex),
        p36: parseNum(row, p36ColIndex),
        p37: parseNum(row, p37ColIndex),
        p38: parseNum(row, p38ColIndex),
        p39: parseNum(row, p39ColIndex),
        p310: parseNum(row, p310ColIndex),
        total: parseNum(row, p3TotalColIndex),
      };

      // Try to match existing site
      const siteMatch = matchSite(siteName, siteMatchers);

      parsedSites.push({
        row: rowNum,
        siteName,
        contractType: contractTypeStr,
        contractTypeInfo,
        nb,
        p1Components,
        p1ByYear,
        p2,
        p3,
        existingSite: siteMatch.siteId ? { id: siteMatch.siteId, name: siteMatch.siteName! } : undefined,
      });
    }

    if (previewMode) {
      // Return preview data in format expected by UI
      return NextResponse.json({
        total: parsedSites.length,
        newSites: parsedSites.filter(s => !s.existingSite).length,
        existingSites: parsedSites.filter(s => s.existingSite).length,
        // Detected metadata from "Contrat" sheet (if available)
        detectedMetadata: detectedMetadata || undefined,
        // Site details from "Sites" sheet
        siteDetailsCount: siteDetailsMap.size,
        dataSheetName: sheetName,
        results: parsedSites.map(s => {
          // Check if we have site details for this site
          const normalizedName = normalizeSiteName(s.siteName);
          const siteDetails = siteDetailsMap.get(normalizedName);
          // Calculate P1 total from sum of all years
          const p1YearValues = Object.values(s.p1ByYear).filter(v => v !== null && v > 0) as number[];
          const p1Total = p1YearValues.length > 0 ? p1YearValues.reduce((sum, v) => sum + v, 0) : undefined;

          // Calculate P2 total with 10 sub-components
          const p2Total = s.p2.total || (
            (s.p2.p21 || 0) + (s.p2.p22 || 0) + (s.p2.p23 || 0) +
            (s.p2.p24 || 0) + (s.p2.p25 || 0) + (s.p2.p26 || 0) +
            (s.p2.p27 || 0) + (s.p2.p28 || 0) + (s.p2.p29 || 0) + (s.p2.p210 || 0)
          ) || undefined;

          // Calculate P3 total with 10 sub-components
          const p3Total = s.p3.total || (
            (s.p3.p31 || 0) + (s.p3.p32 || 0) + (s.p3.p33 || 0) +
            (s.p3.p34 || 0) + (s.p3.p35 || 0) + (s.p3.p36 || 0) +
            (s.p3.p37 || 0) + (s.p3.p38 || 0) + (s.p3.p39 || 0) + (s.p3.p310 || 0)
          ) || undefined;

          return {
            row: s.row,
            siteName: s.siteName,
            contractType: s.contractType,
            isNew: !s.existingSite,
            existingSiteId: s.existingSite?.id,
            // Site details from "Sites" sheet (if found)
            hasDetails: !!siteDetails,
            city: siteDetails?.city,
            surface: siteDetails?.surface,
            // Filter out null/0 NB values
            nbValues: Object.fromEntries(
              Object.entries(s.nb).filter(([, v]) => v !== null && v > 0)
            ),
            // P1 total (sum of all years)
            p1Total,
            // P1 components for display
            p1Components: s.p1Components,
            p2Total,
            p3Total,
          };
        }),
      });
    }

    // Validate required fields for creation
    if (!reference || !title || !provider || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Informations du contrat manquantes (référence, titre, titulaire, dates)" },
        { status: 400 }
      );
    }

    // Create the contract and all sites in a transaction
    // Increase timeout for large files with many sites
    const result = await prisma.$transaction(async (tx) => {
      // Create contract
      const contract = await tx.contract.create({
        data: {
          organizationId: user.organizationId,
          reference,
          title,
          provider,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          yearType: yearType as "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL",
          billingFrequency: billingFrequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
          yearStartMonth: yearType === "HEATING_SEASON" ? 7 : 1,
          yearStartDay: 1,
          status: "ACTIF",
        },
      });

      const createdSiteIds: string[] = [];
      const linkedSiteIds: string[] = [];

      // Helper to calculate season from contract year
      // Uses same logic as energy page display to ensure consistency
      const getSeasonForYear = (contractYear: number): string => {
        const contractStartDate = new Date(startDate);
        const startYear = contractStartDate.getFullYear();
        const startMonth = contractStartDate.getMonth(); // 0-indexed (July = 6)

        // First season: if contract starts July or later (month >= 6),
        // season starts same year (e.g., July 2025 -> season 2025-2026)
        // Otherwise, season starts previous year (e.g., January 2025 -> season 2024-2025)
        const firstSeasonEndYear = startMonth >= 6 ? startYear + 1 : startYear;

        // Calculate season for the requested contract year
        const seasonEndYear = firstSeasonEndYear + (contractYear - 1);
        return `${seasonEndYear - 1}-${seasonEndYear}`;
      };

      // ============ BATCH OPTIMIZATION ============
      // Step 1: Create all new sites in batch (with details from Sites sheet if available)
      const newSitesToCreate = parsedSites.filter(s => !s.existingSite);
      if (newSitesToCreate.length > 0) {
        await tx.site.createMany({
          data: newSitesToCreate.map(s => {
            // Look for site details in the Sites sheet
            const normalizedName = normalizeSiteName(s.siteName);
            const details = siteDetailsMap.get(normalizedName);

            return {
              organizationId: user.organizationId,
              name: s.siteName,
              type: details?.type ? parseSiteType(details.type) : SiteType.AUTRE,
              energyType: details?.energyType ? parseEnergyType(details.energyType) : EnergyType.GAZ,
              address: details?.address || "",
              postalCode: details?.postalCode || "",
              city: details?.city || "",
              surface: details?.surface,
              surfaceChauffee: details?.surfaceChauffee,
              pce: details?.pce,
              pdl: details?.pdl,
              rae: details?.rae,
            };
          }),
        });
      }

      // Fetch created sites to get their IDs
      const createdSites = newSitesToCreate.length > 0
        ? await tx.site.findMany({
            where: {
              organizationId: user.organizationId,
              name: { in: newSitesToCreate.map(s => s.siteName) },
            },
            select: { id: true, name: true, energyType: true },
          })
        : [];

      // Build a map of site name to site info
      const siteNameToId = new Map<string, { id: string; energyType: string }>();
      for (const site of createdSites) {
        siteNameToId.set(site.name, { id: site.id, energyType: site.energyType });
        createdSiteIds.push(site.id);
      }

      // Step 2: Prepare ContractSite data and HeatingSeason data
      const contractSiteData: {
        contractId: string;
        siteId: string;
        contractType: ContractType;
        hasP1: boolean;
        hasP2: boolean;
        hasP3: boolean;
        hasP4: boolean;
        amountP1: number | null;
        amountP2: number | null;
        amountP3: number | null;
        amountP21?: number;
        amountP22?: number;
        amountP23?: number;
        amountP24?: number;
        amountP25?: number;
        amountP26?: number;
        amountP27?: number;
        amountP28?: number;
        amountP29?: number;
        amountP210?: number;
        amountP31?: number;
        amountP32?: number;
        amountP33?: number;
        amountP34?: number;
        amountP35?: number;
        amountP36?: number;
        amountP37?: number;
        amountP38?: number;
        amountP39?: number;
        amountP310?: number;
      }[] = [];
      const heatingSeasonData: { siteId: string; season: string; nbValue: number; nbUnit: string; djuContractuel?: number }[] = [];
      // Get DJU contractuel from metadata (applies to all sites in this contract)
      const contractDjuContractuel = detectedMetadata?.djuContractuel;

      // Get energy types for existing sites and update them with site details if available
      const existingSiteIds = parsedSites
        .filter(s => s.existingSite)
        .map(s => s.existingSite!.id);
      const existingSitesInfo = existingSiteIds.length > 0
        ? await tx.site.findMany({
            where: { id: { in: existingSiteIds } },
            select: { id: true, name: true, energyType: true, address: true, city: true, postalCode: true, surface: true, surfaceChauffee: true },
          })
        : [];
      const existingSiteEnergyTypes = new Map(existingSitesInfo.map(s => [s.id, s.energyType]));

      // Update existing sites with details from Sites sheet (if they have missing info)
      if (siteDetailsMap.size > 0 && existingSitesInfo.length > 0) {
        const siteUpdates: Promise<unknown>[] = [];
        for (const existingSite of existingSitesInfo) {
          const normalizedName = normalizeSiteName(existingSite.name);
          const details = siteDetailsMap.get(normalizedName);
          if (!details) continue;

          // Only update fields that are empty/missing
          const updateData: Record<string, unknown> = {};
          if (!existingSite.address && details.address) updateData.address = details.address;
          if (!existingSite.city && details.city) updateData.city = details.city;
          if (!existingSite.postalCode && details.postalCode) updateData.postalCode = details.postalCode;
          if (!existingSite.surface && details.surface) updateData.surface = details.surface;
          if (!existingSite.surfaceChauffee && details.surfaceChauffee) updateData.surfaceChauffee = details.surfaceChauffee;
          if (details.pce) updateData.pce = details.pce;
          if (details.pdl) updateData.pdl = details.pdl;
          if (details.rae) updateData.rae = details.rae;

          if (Object.keys(updateData).length > 0) {
            siteUpdates.push(tx.site.update({
              where: { id: existingSite.id },
              data: updateData,
            }));
          }
        }
        if (siteUpdates.length > 0) {
          await Promise.all(siteUpdates);
        }
      }

      for (const parsedSite of parsedSites) {
        let siteId: string;
        let energyType: string;

        if (parsedSite.existingSite) {
          siteId = parsedSite.existingSite.id;
          energyType = existingSiteEnergyTypes.get(siteId) || "GAZ";
          linkedSiteIds.push(siteId);
        } else {
          const siteInfo = siteNameToId.get(parsedSite.siteName);
          if (!siteInfo) continue; // Should not happen
          siteId = siteInfo.id;
          energyType = siteInfo.energyType;
        }

        // Calculate P2/P3 totals if not provided (with 10 sub-components)
        const p2Total = parsedSite.p2.total ??
          (parsedSite.p2.p21 || 0) + (parsedSite.p2.p22 || 0) + (parsedSite.p2.p23 || 0) +
          (parsedSite.p2.p24 || 0) + (parsedSite.p2.p25 || 0) + (parsedSite.p2.p26 || 0) +
          (parsedSite.p2.p27 || 0) + (parsedSite.p2.p28 || 0) + (parsedSite.p2.p29 || 0) + (parsedSite.p2.p210 || 0);

        const p3Total = parsedSite.p3.total ??
          (parsedSite.p3.p31 || 0) + (parsedSite.p3.p32 || 0) + (parsedSite.p3.p33 || 0) +
          (parsedSite.p3.p34 || 0) + (parsedSite.p3.p35 || 0) + (parsedSite.p3.p36 || 0) +
          (parsedSite.p3.p37 || 0) + (parsedSite.p3.p38 || 0) + (parsedSite.p3.p39 || 0) + (parsedSite.p3.p310 || 0);

        // Calculate P1 from sum of all years
        const p1YearValues = Object.values(parsedSite.p1ByYear).filter(v => v !== null && v > 0) as number[];
        const p1Total = p1YearValues.length > 0 ? p1YearValues.reduce((sum, v) => sum + v, 0) : null;

        const hasP1 = parsedSite.contractTypeInfo.canHaveP1 && (p1Total !== null || Object.keys(parsedSite.p1ByYear).length > 0);
        const hasP3 = p3Total > 0;

        contractSiteData.push({
          contractId: contract.id,
          siteId,
          contractType: parsedSite.contractTypeInfo.contractType,
          hasP1,
          hasP2: true,
          hasP3,
          hasP4: false,
          amountP1: p1Total,
          amountP2: p2Total > 0 ? p2Total : null,
          amountP3: p3Total > 0 ? p3Total : null,
          amountP21: parsedSite.p2.p21,
          amountP22: parsedSite.p2.p22,
          amountP23: parsedSite.p2.p23,
          amountP24: parsedSite.p2.p24,
          amountP25: parsedSite.p2.p25,
          amountP26: parsedSite.p2.p26,
          amountP27: parsedSite.p2.p27,
          amountP28: parsedSite.p2.p28,
          amountP29: parsedSite.p2.p29,
          amountP210: parsedSite.p2.p210,
          amountP31: parsedSite.p3.p31,
          amountP32: parsedSite.p3.p32,
          amountP33: parsedSite.p3.p33,
          amountP34: parsedSite.p3.p34,
          amountP35: parsedSite.p3.p35,
          amountP36: parsedSite.p3.p36,
          amountP37: parsedSite.p3.p37,
          amountP38: parsedSite.p3.p38,
          amountP39: parsedSite.p3.p39,
          amountP310: parsedSite.p3.p310,
        });

        // Prepare HeatingSeason data
        const nbUnit = getNbUnitForEnergyType(energyType as EnergyType);
        for (const [yearStr, nbValue] of Object.entries(parsedSite.nb)) {
          if (nbValue === null || nbValue <= 0) continue;
          const year = parseInt(yearStr);
          const season = getSeasonForYear(year);
          // Round NB value to integer (no decimals)
          heatingSeasonData.push({
            siteId,
            season,
            nbValue: Math.round(nbValue),
            nbUnit,
            djuContractuel: contractDjuContractuel,
          });
        }
      }

      // Step 3: Create all ContractSites in batch
      if (contractSiteData.length > 0) {
        await tx.contractSite.createMany({ data: contractSiteData });
      }

      // Step 4: Handle HeatingSeasons - get existing ones first
      const uniqueSiteSeasons = [...new Set(heatingSeasonData.map(h => `${h.siteId}|${h.season}`))];
      const siteSeasonPairs = uniqueSiteSeasons.map(s => {
        const [siteId, season] = s.split("|");
        return { siteId, season };
      });

      // Fetch all existing heating seasons in one query
      const existingSeasons = await tx.heatingSeason.findMany({
        where: {
          OR: siteSeasonPairs.map(({ siteId, season }) => ({
            siteId,
            season,
          })),
        },
        select: { id: true, siteId: true, season: true },
      });
      const existingSeasonMap = new Map(
        existingSeasons.map(s => [`${s.siteId}|${s.season}`, s.id])
      );

      // Separate into creates and updates
      const seasonsToCreate: {
        siteId: string;
        season: string;
        startDate: Date;
        nb: number;
        nbUnit: NbUnit;
        djuContractuel?: number;
      }[] = [];
      const seasonsToUpdate: { id: string; nb: number; nbUnit: string; djuContractuel?: number }[] = [];

      for (const hs of heatingSeasonData) {
        const key = `${hs.siteId}|${hs.season}`;
        const existingId = existingSeasonMap.get(key);
        if (existingId) {
          seasonsToUpdate.push({ id: existingId, nb: hs.nbValue, nbUnit: hs.nbUnit, djuContractuel: hs.djuContractuel });
        } else {
          seasonsToCreate.push({
            siteId: hs.siteId,
            season: hs.season,
            startDate: new Date(parseInt(hs.season.split("-")[0]), 6, 1),
            nb: hs.nbValue,
            nbUnit: hs.nbUnit as NbUnit,
            djuContractuel: hs.djuContractuel,
          });
        }
      }

      // Batch create new seasons
      if (seasonsToCreate.length > 0) {
        await tx.heatingSeason.createMany({ data: seasonsToCreate });
      }

      // Update existing seasons (must be done individually but in parallel)
      if (seasonsToUpdate.length > 0) {
        await Promise.all(
          seasonsToUpdate.map(s =>
            tx.heatingSeason.update({
              where: { id: s.id },
              data: {
                nb: s.nb,
                nbUnit: s.nbUnit as NbUnit,
                djuContractuel: s.djuContractuel,
              },
            })
          )
        );
      }

      return {
        contract,
        createdSites: createdSiteIds.length,
        linkedSites: linkedSiteIds.length,
        totalSites: parsedSites.length,
      };
    }, {
      timeout: 180000, // 3 minutes for large files with many sites
      maxWait: 10000, // 10 seconds to acquire connection
    });

    return NextResponse.json({
      success: true,
      contract: {
        id: result.contract.id,
        reference: result.contract.reference,
        title: result.contract.title,
      },
      createdSites: result.createdSites,
      linkedSites: result.linkedSites,
      totalSites: result.totalSites,
    });
  } catch (error) {
    console.error("Error creating contract from AE:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Erreur lors de la création du contrat: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Helper functions
function createSiteMatchers(sites: { id: string; name: string }[]) {
  const normalizedNames = new Map<string, { id: string; name: string }>();

  for (const site of sites) {
    const normalized = normalizeSiteName(site.name);
    normalizedNames.set(normalized, { id: site.id, name: site.name });
  }

  return { normalizedNames };
}

function normalizeSiteName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return 1 - matrix[b.length][a.length] / maxLen;
}

function matchSite(
  installationName: string,
  matchers: ReturnType<typeof createSiteMatchers>
): { siteId?: string; siteName?: string } {
  const normalized = normalizeSiteName(installationName);

  // Exact match
  const exact = matchers.normalizedNames.get(normalized);
  if (exact) {
    return { siteId: exact.id, siteName: exact.name };
  }

  // Partial match
  for (const [siteName, site] of matchers.normalizedNames) {
    if (normalized.includes(siteName) || siteName.includes(normalized)) {
      return { siteId: site.id, siteName: site.name };
    }
  }

  // Fuzzy match
  let bestMatch: { site: { id: string; name: string }; score: number } | null = null;
  for (const [siteName, site] of matchers.normalizedNames) {
    const score = similarity(normalized, siteName);
    if (score > 0.8 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { site, score };
    }
  }

  if (bestMatch) {
    return { siteId: bestMatch.site.id, siteName: bestMatch.site.name };
  }

  return {};
}
