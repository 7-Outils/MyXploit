import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { EnergyType, EnergyUsage } from "@/generated/prisma/client";

// Types for exploitant data (generic for IDEX, Engie, Dalkia, etc.)
interface ExploitantRow {
  dateReleve: number; // Excel date number
  nomInstallation: string;
  nomCompteur: string;
  index: number;
  conso: number;
  unite: string;
  fluide: string;
  etat: string; // ON/OFF or similar
}

// Meter type patterns for different exploitants
// Maps patterns to energy type and usage
const METER_PATTERNS: Array<{
  patterns: string[];
  energyType: EnergyType;
  usage: EnergyUsage;
  isMaintenanceIndicator?: boolean;
}> = [
  // Gas meters (various naming conventions)
  {
    patterns: ["gaz grdf", "cpt gaz", "compteur gaz", "gaz naturel", "gn", "grdf"],
    energyType: "GAZ",
    usage: "CHAUFFAGE",
  },
  // ECS meters (hot water)
  {
    patterns: ["ecs", "eau chaude", "cpt ecs", "compteur ecs", "sanitaire", "ecs gaz"],
    energyType: "GAZ",
    usage: "ECS",
  },
  // Water makeup (maintenance indicator)
  {
    patterns: ["appoint", "eau appoint", "appoint eau", "remplissage", "makeup"],
    energyType: "EAU",
    usage: "AUTRE",
    isMaintenanceIndicator: true,
  },
  // Electricity
  {
    patterns: ["elec", "électricité", "electricite", "compteur elec", "enedis", "kwh elec"],
    energyType: "ELECTRICITE",
    usage: "MIXTE",
  },
  // District heating
  {
    patterns: ["rcu", "reseau chaleur", "réseau chaleur", "chauffage urbain", "calories"],
    energyType: "RESEAU_CHALEUR",
    usage: "CHAUFFAGE",
  },
  // Fuel oil
  {
    patterns: ["fioul", "fuel", "mazout", "cuve fioul"],
    energyType: "FIOUL",
    usage: "CHAUFFAGE",
  },
  // Cold water (not energy, but tracked)
  {
    patterns: ["eau froide", "ef", "compteur eau", "eau potable"],
    energyType: "EAU",
    usage: "AUTRE",
  },
];

// POST /api/consumptions/import-exploitant - Import consumptions from exploitant Excel file (IDEX, Engie, Dalkia, etc.)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer des données" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contractId = formData.get("contractId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Parse as raw rows (to handle Excel date numbers)
    const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: "Le fichier ne contient pas de données" },
        { status: 400 }
      );
    }

    // Get header row and find column indices
    const headers = rawData[0].map((h) => String(h).toLowerCase().trim());
    const colIndices = {
      dateReleve: headers.findIndex((h) => h.includes("date") && h.includes("releve")),
      nomInstallation: headers.findIndex((h) => h.includes("installation") || h.includes("site")),
      nomCompteur: headers.findIndex((h) => h.includes("compteur")),
      index: headers.findIndex((h) => h === "index"),
      conso: headers.findIndex((h) => h === "conso" || h.includes("consommation")),
      unite: headers.findIndex((h) => h.includes("unit")),
      fluide: headers.findIndex((h) => h.includes("fluide")),
      etat: headers.findIndex((h) => h.includes("etat") || h.includes("état")),
    };

    // Validate required columns
    if (colIndices.nomInstallation === -1 || colIndices.conso === -1) {
      return NextResponse.json(
        { error: "Colonnes requises non trouvées (Installation, Conso)" },
        { status: 400 }
      );
    }

    // Get sites for matching - filter by contract if provided
    // Also get PCS coefficient for gas conversion (20 mbar: ~10.5, 300 mbar: ~14.5)
    let sitesQuery: { organizationId: string; id?: { in: string[] } } = {
      organizationId: user.organizationId,
    };

    // Map siteId -> PCS coefficient (for gas m³ to kWh conversion)
    const sitePcsCoefficients = new Map<string, number>();
    const DEFAULT_PCS = 10.5; // Default PCS coefficient for 20 mbar (kWh/m³)

    if (contractId) {
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true, coefficientPCS: true },
      });
      sitesQuery.id = { in: contractSites.map((cs) => cs.siteId) };

      // Store PCS coefficients per site
      contractSites.forEach((cs) => {
        sitePcsCoefficients.set(cs.siteId, cs.coefficientPCS || DEFAULT_PCS);
      });
    }

    const sites = await prisma.site.findMany({
      where: sitesQuery,
      select: { id: true, name: true, city: true },
    });

    // Create lookup maps for site matching
    const siteMatchers = createSiteMatchers(sites);

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; site: string; error: string }[],
      siteMatches: {} as Record<string, { matched: boolean; siteId?: string; siteName?: string }>,
    };

    // Process data rows
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 1;

      try {
        const exploitantRow: ExploitantRow = {
          dateReleve: Number(row[colIndices.dateReleve]) || 0,
          nomInstallation: String(row[colIndices.nomInstallation] || "").trim(),
          nomCompteur: String(row[colIndices.nomCompteur] || "").trim(),
          index: Number(row[colIndices.index]) || 0,
          conso: Number(row[colIndices.conso]) || 0,
          unite: String(row[colIndices.unite] || "m3").trim(),
          fluide: String(row[colIndices.fluide] || "").trim(),
          etat: String(row[colIndices.etat] || "").trim().toUpperCase(),
        };

        if (!exploitantRow.nomInstallation) {
          continue; // Skip empty rows
        }

        // Match site
        const siteMatch = matchSite(exploitantRow.nomInstallation, siteMatchers, sites);

        // Track site matching for feedback
        if (!results.siteMatches[exploitantRow.nomInstallation]) {
          results.siteMatches[exploitantRow.nomInstallation] = siteMatch.siteId
            ? { matched: true, siteId: siteMatch.siteId, siteName: siteMatch.siteName }
            : { matched: false };
        }

        if (!siteMatch.siteId) {
          results.errors.push({
            row: rowNum,
            site: exploitantRow.nomInstallation,
            error: "Site non trouvé",
          });
          continue;
        }

        // Parse date (Excel serial number to Date)
        const period = excelDateToJSDate(exploitantRow.dateReleve);
        if (!period || isNaN(period.getTime())) {
          results.errors.push({
            row: rowNum,
            site: exploitantRow.nomInstallation,
            error: `Date invalide: ${exploitantRow.dateReleve}`,
          });
          continue;
        }

        // Determine energy type and usage based on meter type
        const { energyType, usage, skip, isMaintenanceIndicator } = mapMeterType(exploitantRow.nomCompteur, exploitantRow.fluide);

        if (skip) {
          results.skipped++;
          continue;
        }

        // Handle consumption value
        let quantity = exploitantRow.conso;
        if (quantity === 0) {
          results.skipped++;
          continue;
        }

        // Convert unit and quantity (gas m³ → kWh using PCS coefficient)
        const pcsCoefficient = sitePcsCoefficients.get(siteMatch.siteId) || DEFAULT_PCS;
        const { unit, quantity: convertedQuantity } = normalizeUnitAndQuantity(
          exploitantRow.unite,
          quantity,
          energyType,
          pcsCoefficient
        );
        quantity = convertedQuantity;

        // Set period to first day of month
        const periodMonth = new Date(period.getFullYear(), period.getMonth(), 1);

        // Upsert consumption
        const existing = await prisma.consumption.findUnique({
          where: {
            siteId_energyType_usage_period: {
              siteId: siteMatch.siteId,
              energyType,
              usage,
              period: periodMonth,
            },
          },
        });

        if (existing) {
          await prisma.consumption.update({
            where: { id: existing.id },
            data: {
              quantity,
              unit,
            },
          });
          results.updated++;
        } else {
          await prisma.consumption.create({
            data: {
              siteId: siteMatch.siteId,
              organizationId: user.organizationId,
              energyType,
              usage,
              period: periodMonth,
              quantity,
              unit,
            },
          });
          results.imported++;
        }

        // Handle heating season (ON/OFF or similar states)
        const etatUpper = exploitantRow.etat.toUpperCase();
        if (etatUpper === "ON" || etatUpper === "OFF" || etatUpper === "MARCHE" || etatUpper === "ARRET") {
          await updateHeatingSeason(
            siteMatch.siteId,
            period,
            etatUpper === "ON" || etatUpper === "MARCHE"
          );
        }

        // Create alert for high water makeup (maintenance indicator)
        if (isMaintenanceIndicator && quantity > 10) {
          await createWaterMakeupAlert(
            siteMatch.siteId,
            user.organizationId,
            siteMatch.siteName || exploitantRow.nomInstallation,
            quantity,
            period
          );
        }

      } catch (error) {
        console.error(`Error importing row ${rowNum}:`, error);
        results.errors.push({
          row: rowNum,
          site: String(row[colIndices.nomInstallation] || "?"),
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: results.imported,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 20),
      totalErrors: results.errors.length,
      siteMatches: results.siteMatches,
    });
  } catch (error) {
    console.error("Error importing IDEX consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des consommations IDEX" },
      { status: 500 }
    );
  }
}

// Helper: Create site matchers for fuzzy matching
function createSiteMatchers(sites: { id: string; name: string; city: string | null }[]) {
  const normalizedNames = new Map<string, { id: string; name: string }>();
  const keywords = new Map<string, { id: string; name: string }[]>();

  for (const site of sites) {
    // Normalize full name
    const normalized = normalizeSiteName(site.name);
    normalizedNames.set(normalized, { id: site.id, name: site.name });

    // Extract keywords for partial matching
    const words = normalized.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      if (!keywords.has(word)) {
        keywords.set(word, []);
      }
      keywords.get(word)!.push({ id: site.id, name: site.name });
    }
  }

  return { normalizedNames, keywords };
}

// Helper: Normalize site name for matching
function normalizeSiteName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: Match site by name
function matchSite(
  installationName: string,
  matchers: ReturnType<typeof createSiteMatchers>,
  sites: { id: string; name: string; city: string | null }[]
): { siteId?: string; siteName?: string } {
  const normalized = normalizeSiteName(installationName);

  // 1. Try exact match
  const exact = matchers.normalizedNames.get(normalized);
  if (exact) {
    return { siteId: exact.id, siteName: exact.name };
  }

  // 2. Try partial match - check if normalized name contains site name or vice versa
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    if (normalized.includes(siteName) || siteName.includes(normalized)) {
      return { siteId: id, siteName: name };
    }
  }

  // 3. Try keyword matching - find site with most matching keywords
  const words = normalized.split(/\s+/).filter((w) => w.length > 3);
  const scores = new Map<string, { count: number; name: string }>();

  for (const word of words) {
    const matches = matchers.keywords.get(word);
    if (matches) {
      for (const match of matches) {
        const current = scores.get(match.id) || { count: 0, name: match.name };
        current.count++;
        scores.set(match.id, current);
      }
    }
  }

  // Find best match (at least 2 keywords)
  let bestMatch: { id: string; name: string; count: number } | null = null;
  for (const [id, { count, name }] of scores) {
    if (count >= 2 && (!bestMatch || count > bestMatch.count)) {
      bestMatch = { id, name, count };
    }
  }

  if (bestMatch) {
    return { siteId: bestMatch.id, siteName: bestMatch.name };
  }

  // 4. Try city matching as last resort (if city is in installation name)
  for (const site of sites) {
    if (site.city) {
      const normalizedCity = normalizeSiteName(site.city);
      if (normalized.includes(normalizedCity) && normalizedCity.length > 4) {
        // Check if site type is also in name
        const siteNormalized = normalizeSiteName(site.name);
        const siteTypeWords = ["ecole", "maternelle", "elementaire", "college", "lycee", "gymnase", "piscine", "mairie"];
        for (const typeWord of siteTypeWords) {
          if (normalized.includes(typeWord) && siteNormalized.includes(typeWord)) {
            return { siteId: site.id, siteName: site.name };
          }
        }
      }
    }
  }

  return {};
}

// Helper: Map meter type to energy type and usage (works for any exploitant)
function mapMeterType(
  compteur: string,
  fluide: string
): { energyType: EnergyType; usage: EnergyUsage; skip: boolean; isMaintenanceIndicator: boolean } {
  const searchText = `${compteur} ${fluide}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Try to match against known patterns
  for (const pattern of METER_PATTERNS) {
    for (const p of pattern.patterns) {
      if (searchText.includes(p)) {
        return {
          energyType: pattern.energyType,
          usage: pattern.usage,
          skip: false,
          isMaintenanceIndicator: pattern.isMaintenanceIndicator || false,
        };
      }
    }
  }

  // Try to infer from fluide field if no pattern matched
  const fluideLower = fluide.toLowerCase();
  if (fluideLower.includes("gaz")) {
    return { energyType: "GAZ", usage: "CHAUFFAGE", skip: false, isMaintenanceIndicator: false };
  }
  if (fluideLower.includes("elec")) {
    return { energyType: "ELECTRICITE", usage: "MIXTE", skip: false, isMaintenanceIndicator: false };
  }
  if (fluideLower.includes("eau") || fluideLower.includes("water")) {
    return { energyType: "EAU", usage: "AUTRE", skip: false, isMaintenanceIndicator: false };
  }

  // Default to gas/heating for unknown types (most common in exploitant files)
  return { energyType: "GAZ", usage: "MIXTE", skip: false, isMaintenanceIndicator: false };
}

// Helper: Convert Excel serial date to JS Date
function excelDateToJSDate(serial: number): Date {
  // Excel dates start from Jan 1, 1900
  // Serial 1 = Jan 1, 1900
  // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
}

// Helper: Normalize unit and convert quantity if needed (gas m³ → kWh)
function normalizeUnitAndQuantity(
  unit: string,
  quantity: number,
  energyType: EnergyType,
  pcsCoefficient: number
): { unit: string; quantity: number } {
  const unitLower = unit.toLowerCase().replace(/\s/g, "");

  // Convert gas m³ to kWh using PCS coefficient
  // 20 mbar: ~10.5 kWh/m³, 300 mbar: ~14.5 kWh/m³
  if ((unitLower === "m3" || unitLower === "m³") && energyType === "GAZ") {
    return {
      unit: "kWh",
      quantity: Math.round(quantity * pcsCoefficient * 100) / 100, // Round to 2 decimals
    };
  }

  // MWh to kWh
  if (unitLower === "mwh") {
    return {
      unit: "kWh",
      quantity: quantity * 1000,
    };
  }

  // Keep m³ for water
  if (unitLower === "m3" || unitLower === "m³") return { unit: "m³", quantity };
  if (unitLower === "kwh") return { unit: "kWh", quantity };
  if (unitLower === "l" || unitLower === "litres") return { unit: "L", quantity };

  return { unit, quantity };
}

// Helper: Update heating season record
async function updateHeatingSeason(
  siteId: string,
  date: Date,
  isOn: boolean
) {
  // Determine season (e.g., "2024-2025" for Oct 2024 to May 2025)
  const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const season = `${year}-${year + 1}`;

  try {
    const existing = await prisma.heatingSeason.findUnique({
      where: { siteId_season: { siteId, season } },
    });

    if (existing) {
      // Update end date if heating is OFF and we don't have an end date yet
      if (!isOn && !existing.endDate) {
        await prisma.heatingSeason.update({
          where: { id: existing.id },
          data: { endDate: date },
        });
      }
    } else if (isOn) {
      // Create new heating season if ON
      await prisma.heatingSeason.create({
        data: {
          siteId,
          season,
          startDate: date,
        },
      });
    }
  } catch (error) {
    // Ignore errors for heating season updates (not critical)
    console.error("Error updating heating season:", error);
  }
}

// Helper: Create alert for high water makeup
async function createWaterMakeupAlert(
  siteId: string,
  organizationId: string,
  siteName: string,
  quantity: number,
  date: Date
) {
  // Check if alert already exists for this month
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const existingAlert = await prisma.alert.findFirst({
    where: {
      siteId,
      type: "AUTRE",
      title: { contains: "Appoint eau" },
      createdAt: { gte: monthStart, lte: monthEnd },
    },
  });

  if (existingAlert) return;

  // Create alert
  await prisma.alert.create({
    data: {
      siteId,
      organizationId,
      type: "AUTRE",
      priority: quantity > 50 ? "HAUTE" : "MOYENNE",
      title: `Appoint eau élevé: ${quantity} m³`,
      message: `Le site ${siteName} a un appoint d'eau de ${quantity} m³ pour ${date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}. Cela peut indiquer une fuite dans le réseau de chauffage.`,
    },
  });
}
