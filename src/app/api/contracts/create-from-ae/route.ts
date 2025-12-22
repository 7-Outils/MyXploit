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

// Map contract type string to enum and determine prestations
function getContractTypeInfo(type: string): {
  contractType: ContractType;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
} {
  const normalized = type ? type.toUpperCase().trim() : "";
  switch (normalized) {
    case "PFI": // Prestation Forfaitaire Intégrale (P2+P3)
      return { contractType: "PFI", hasP1: false, hasP2: true, hasP3: true };
    case "PF": // Prestation Forfaitaire (P2 only)
      return { contractType: "PF", hasP1: false, hasP2: true, hasP3: false };
    case "MTI": // Marché Tout Intégré (P1+P2+P3)
      return { contractType: "MTI", hasP1: true, hasP2: true, hasP3: true };
    case "MCI": // Marché Chauffage Intégré
      return { contractType: "MCI", hasP1: true, hasP2: true, hasP3: true };
    case "CPI": // Chauffage Performance Intégré
      return { contractType: "CPI", hasP1: true, hasP2: true, hasP3: true };
    case "MT": // Marché Type (P1+P2)
      return { contractType: "MT", hasP1: true, hasP2: true, hasP3: false };
    case "CP": // Contrat Performance (P1+P2+P3)
      return { contractType: "CP", hasP1: true, hasP2: true, hasP3: true };
    case "MC": // Marché Combustible (P1 only)
      return { contractType: "MC", hasP1: true, hasP2: false, hasP3: false };
    case "MF": // Marché Forfait
      return { contractType: "MF", hasP1: false, hasP2: true, hasP3: false };
    default:
      return { contractType: "MC", hasP1: true, hasP2: false, hasP3: false };
  }
}

interface ParsedSite {
  row: number;
  siteName: string;
  contractType: string;
  contractTypeInfo: ReturnType<typeof getContractTypeInfo>;
  nb: { [year: number]: number | null };
  p2: {
    p21?: number;
    p22?: number;
    p23?: number;
    p24?: number;
    p25?: number;
    p26?: number;
    total?: number;
  };
  p3: {
    p31?: number;
    p32?: number;
    p33?: number;
    p34?: number;
    p35?: number;
    p36?: number;
    total?: number;
  };
  existingSite?: { id: string; name: string };
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

    // Use "P2P3" sheet if available, otherwise first sheet
    const sheetName = workbook.SheetNames.includes("P2P3")
      ? "P2P3"
      : workbook.SheetNames[0];
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

    // P2 columns
    const p21ColIndex = findExactColIndex(/p21.*chauffage.*annuel/);
    const p22ColIndex = findExactColIndex(/p22.*ventilation.*annuel/);
    const p23ColIndex = findExactColIndex(/p23.*climatisation.*annuel/);
    const p24ColIndex = findExactColIndex(/p24.*ecs.*annuel/);
    const p25ColIndex = findExactColIndex(/p25.*traitement.*eau.*annuel/);
    const p26ColIndex = findExactColIndex(/p26.*mde.*annuel/);
    const p2TotalColIndex = findExactColIndex(/p2\s*[-–]\s*total.*annuel/);

    // P3 columns
    const p31ColIndex = findExactColIndex(/p31.*chauffage.*annuel/);
    const p32ColIndex = findExactColIndex(/p32.*ventilation.*annuel/);
    const p33ColIndex = findExactColIndex(/p33.*climatisation.*annuel/);
    const p34ColIndex = findExactColIndex(/p34.*ecs.*traitement.*annuel/);
    const p35ColIndex = findExactColIndex(/p35.*prestations.*annuel/);
    const p36ColIndex = findExactColIndex(/p36.*ape.*annuel/);
    const p3TotalColIndex = findExactColIndex(/p3\s*[-–]\s*total.*annuel/);

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

      // Parse P2/P3
      const p2 = {
        p21: parseNum(row, p21ColIndex),
        p22: parseNum(row, p22ColIndex),
        p23: parseNum(row, p23ColIndex),
        p24: parseNum(row, p24ColIndex),
        p25: parseNum(row, p25ColIndex),
        p26: parseNum(row, p26ColIndex),
        total: parseNum(row, p2TotalColIndex),
      };

      const p3 = {
        p31: parseNum(row, p31ColIndex),
        p32: parseNum(row, p32ColIndex),
        p33: parseNum(row, p33ColIndex),
        p34: parseNum(row, p34ColIndex),
        p35: parseNum(row, p35ColIndex),
        p36: parseNum(row, p36ColIndex),
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
        results: parsedSites.map(s => ({
          row: s.row,
          siteName: s.siteName,
          contractType: s.contractType,
          isNew: !s.existingSite,
          existingSiteId: s.existingSite?.id,
          // Filter out null/0 NB values
          nbValues: Object.fromEntries(
            Object.entries(s.nb).filter(([, v]) => v !== null && v > 0)
          ),
          p2Total: s.p2.total || (
            (s.p2.p21 || 0) + (s.p2.p22 || 0) + (s.p2.p23 || 0) +
            (s.p2.p24 || 0) + (s.p2.p25 || 0) + (s.p2.p26 || 0)
          ) || undefined,
          p3Total: s.p3.total || (
            (s.p3.p31 || 0) + (s.p3.p32 || 0) + (s.p3.p33 || 0) +
            (s.p3.p34 || 0) + (s.p3.p35 || 0) + (s.p3.p36 || 0)
          ) || undefined,
        })),
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

        // Calculate P2/P3 totals if not provided
        const p2Total = parsedSite.p2.total ??
          (parsedSite.p2.p21 || 0) + (parsedSite.p2.p22 || 0) + (parsedSite.p2.p23 || 0) +
          (parsedSite.p2.p24 || 0) + (parsedSite.p2.p25 || 0) + (parsedSite.p2.p26 || 0);

        const p3Total = parsedSite.p3.total ??
          (parsedSite.p3.p31 || 0) + (parsedSite.p3.p32 || 0) + (parsedSite.p3.p33 || 0) +
          (parsedSite.p3.p34 || 0) + (parsedSite.p3.p35 || 0) + (parsedSite.p3.p36 || 0);

        // Create ContractSite
        await tx.contractSite.create({
          data: {
            contractId: contract.id,
            siteId,
            contractType: parsedSite.contractTypeInfo.contractType,
            hasP1: parsedSite.contractTypeInfo.hasP1,
            hasP2: parsedSite.contractTypeInfo.hasP2,
            hasP3: parsedSite.contractTypeInfo.hasP3,
            hasP4: false,
            amountP2: p2Total > 0 ? p2Total : null,
            amountP3: p3Total > 0 ? p3Total : null,
            amountP21: parsedSite.p2.p21,
            amountP22: parsedSite.p2.p22,
            amountP23: parsedSite.p2.p23,
            amountP24: parsedSite.p2.p24,
            amountP25: parsedSite.p2.p25,
            amountP26: parsedSite.p2.p26,
            amountP31: parsedSite.p3.p31,
            amountP32: parsedSite.p3.p32,
            amountP33: parsedSite.p3.p33,
            amountP34: parsedSite.p3.p34,
            amountP35: parsedSite.p3.p35,
            amountP36: parsedSite.p3.p36,
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
