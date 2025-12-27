import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { ContractType, EnergyType, NbUnit } from "@/generated/prisma/client";

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
    }
  }

  // Only return if we found at least one field
  const hasAnyField = metadata.reference || metadata.title || metadata.provider ||
                      metadata.startDate || metadata.endDate || metadata.yearType ||
                      metadata.billingFrequency;

  return hasAnyField ? metadata : null;
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

    // Contract type column
    const contractTypeColIndex = headers.findIndex(h =>
      h && (h.toLowerCase() === "contrat" || h.toLowerCase() === "type contrat")
    );

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
        dataSheetName: sheetName,
        results: parsedSites.map(s => {
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

      const createdSites: string[] = [];
      const linkedSites: string[] = [];

      // Helper to calculate season from contract year
      const getSeasonForYear = (contractYear: number): string => {
        const startYear = new Date(startDate).getFullYear();
        const startMonth = yearType === "HEATING_SEASON" ? 7 : 1;

        if (startMonth >= 7) {
          const seasonStart = startYear + (contractYear - 1);
          return `${seasonStart}-${seasonStart + 1}`;
        } else {
          const seasonStart = startYear - 1 + (contractYear - 1);
          return `${seasonStart}-${seasonStart + 1}`;
        }
      };

      for (const parsedSite of parsedSites) {
        let siteId: string;

        if (parsedSite.existingSite) {
          // Use existing site
          siteId = parsedSite.existingSite.id;
          linkedSites.push(siteId);
        } else {
          // Create new site
          const newSite = await tx.site.create({
            data: {
              organizationId: user.organizationId,
              name: parsedSite.siteName,
              type: "AUTRE",
              energyType: "GAZ",
              address: "",
              postalCode: "",
              city: "",
            },
          });
          siteId = newSite.id;
          createdSites.push(siteId);
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

        // Create ContractSite
        // P2 is always required, P3 is determined by actual values
        // P1 is imported from AE (calculated value at instant T)
        const hasP1 = parsedSite.contractTypeInfo.canHaveP1 && (p1Total !== null || Object.keys(parsedSite.p1ByYear).length > 0);
        const hasP3 = p3Total > 0;

        await tx.contractSite.create({
          data: {
            contractId: contract.id,
            siteId,
            contractType: parsedSite.contractTypeInfo.contractType,
            hasP1,
            hasP2: true, // P2 is always required
            hasP3,
            hasP4: false,
            amountP1: p1Total, // P1 total (sum of all years from AE)
            amountP2: p2Total > 0 ? p2Total : null,
            amountP3: p3Total > 0 ? p3Total : null,
            // P2 sub-components (10)
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
            // P3 sub-components (10)
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
          },
        });

        // Create HeatingSeason entries for NB values
        const site = await tx.site.findUnique({ where: { id: siteId }, select: { energyType: true } });
        const nbUnit = site ? getNbUnitForEnergyType(site.energyType) : "PCS";

        for (const [yearStr, nbValue] of Object.entries(parsedSite.nb)) {
          const year = parseInt(yearStr);
          if (nbValue === null || nbValue <= 0) continue;

          const season = getSeasonForYear(year);

          // Check if season already exists
          const existing = await tx.heatingSeason.findUnique({
            where: { siteId_season: { siteId, season } },
          });

          if (existing) {
            await tx.heatingSeason.update({
              where: { id: existing.id },
              data: { nb: nbValue, nbUnit },
            });
          } else {
            await tx.heatingSeason.create({
              data: {
                siteId,
                season,
                startDate: new Date(parseInt(season.split("-")[0]), 6, 1),
                nb: nbValue,
                nbUnit,
              },
            });
          }
        }
      }

      return {
        contract,
        createdSites: createdSites.length,
        linkedSites: linkedSites.length,
        totalSites: parsedSites.length,
      };
    }, {
      timeout: 60000, // 60 seconds for large files
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
