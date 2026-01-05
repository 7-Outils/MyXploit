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
    const previewMode = formData.get("preview") === "true";

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

    // Get site aliases for this organization (for fuzzy matching)
    const siteAliases = await prisma.siteAlias.findMany({
      where: { organizationId: user.organizationId },
      select: { alias: true, siteId: true, site: { select: { name: true } } },
    });

    console.log("Loaded site aliases:", siteAliases.length, siteAliases.map(a => ({ alias: a.alias, siteName: a.site.name })));

    // Create lookup maps for site matching
    const siteMatchers = createSiteMatchers(sites, siteAliases);
    console.log(`[IMPORT] ${sites.length} sites available for matching, ${siteAliases.length} aliases loaded`);

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; site: string; error: string }[],
      siteMatches: {} as Record<string, {
        matched: boolean;
        siteId?: string;
        siteName?: string;
        confidence?: number;
        suggestions?: Array<{ id: string; name: string; score: number }>;
        rowCount?: number;
      }>,
      unmatchedSites: [] as Array<{
        excelName: string;
        rowCount: number;
        suggestions: Array<{ id: string; name: string; score: number }>;
      }>,
    };

    // Data structure for preview: track each meter individually
    // Key: siteId|energyType|usage|period|meterName
    const meterData = new Map<string, {
      siteId: string;
      siteName: string;
      excelName: string;
      energyType: EnergyType;
      usage: EnergyUsage;
      period: Date;
      periodStr: string;
      quantity: number;
      unit: string;
      meterName: string;
    }>();

    // Track max relevé date per site (for updating HeatingSeason.lastReleveDate)
    const maxReleveDateBySite = new Map<string, Date>();

    // Process data rows - collect all meter data
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
        const siteMatch = matchSite(exploitantRow.nomInstallation, siteMatchers);

        // Track site matching for feedback
        if (!results.siteMatches[exploitantRow.nomInstallation]) {
          results.siteMatches[exploitantRow.nomInstallation] = siteMatch.siteId
            ? {
                matched: true,
                siteId: siteMatch.siteId,
                siteName: siteMatch.siteName,
                confidence: siteMatch.confidence,
                suggestions: siteMatch.suggestions,
                rowCount: 1
              }
            : {
                matched: false,
                suggestions: siteMatch.suggestions,
                rowCount: 1
              };
        } else {
          // Increment row count for this site
          results.siteMatches[exploitantRow.nomInstallation].rowCount =
            (results.siteMatches[exploitantRow.nomInstallation].rowCount || 0) + 1;
        }

        if (!siteMatch.siteId) {
          results.skipped++;
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
        const periodStr = periodMonth.toISOString();

        // Create unique key per meter
        const meterKey = `${siteMatch.siteId}|${energyType}|${usage}|${periodStr}|${exploitantRow.nomCompteur}`;

        if (meterData.has(meterKey)) {
          // Same meter, same period - update quantity (shouldn't happen normally)
          const existing = meterData.get(meterKey)!;
          existing.quantity += quantity;
        } else {
          meterData.set(meterKey, {
            siteId: siteMatch.siteId,
            siteName: siteMatch.siteName || exploitantRow.nomInstallation,
            excelName: exploitantRow.nomInstallation,
            energyType,
            usage,
            period: periodMonth,
            periodStr,
            quantity,
            unit,
            meterName: exploitantRow.nomCompteur,
          });
        }

        // Track max relevé date for this site (for DJU calculation)
        const currentMax = maxReleveDateBySite.get(siteMatch.siteId);
        if (!currentMax || period > currentMax) {
          maxReleveDateBySite.set(siteMatch.siteId, period);
        }

        // Handle heating season (detect start/stop markers)
        const etatLower = exploitantRow.etat.toLowerCase();
        const heatingStartMarkers = ["mise_en_marche", "mise en marche", "allumage", "démarrage", "demarrage", "début chauffe", "debut chauffe", "start", "marche"];
        const heatingStopMarkers = ["arret", "arrêt", "extinction", "off", "stop", "fin chauffe"];

        const isHeatingStart = heatingStartMarkers.some(marker => etatLower.includes(marker));
        const isHeatingStop = heatingStopMarkers.some(marker => etatLower.includes(marker));

        // Also detect simple ON (but not as start marker, just as running state)
        const isOn = etatLower === "on";

        if (isHeatingStart || isHeatingStop || isOn) {
          await updateHeatingSeason(
            siteMatch.siteId,
            period,
            isHeatingStart, // true = update start date
            isHeatingStop   // true = update end date
          );
        }

        // Create alert for high water makeup (maintenance indicator)
        if (isMaintenanceIndicator && quantity > 10) {
          await createWaterMakeupAlert(
            siteMatch.siteId,
            siteMatch.siteName || exploitantRow.nomInstallation,
            user.organizationId,
            quantity,
            period
          );
        }
      } catch (error) {
        results.errors.push({
          row: rowNum,
          site: String(row[colIndices.nomInstallation] || "?"),
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    // Build unmatched sites list for UI
    const unmatchedSites = Object.entries(results.siteMatches)
      .filter(([, match]) => !match.matched)
      .map(([excelName, match]) => ({
        excelName,
        rowCount: match.rowCount || 0,
        suggestions: match.suggestions || [],
      }))
      .sort((a, b) => b.rowCount - a.rowCount);

    // Group meter data by site for preview
    const previewBySite = new Map<string, {
      siteId: string;
      siteName: string;
      meters: Array<{
        meterName: string;
        energyType: EnergyType;
        usage: EnergyUsage;
        periods: Array<{
          period: string;
          quantity: number;
          unit: string;
        }>;
        totalQuantity: number;
      }>;
    }>();

    for (const data of meterData.values()) {
      if (!previewBySite.has(data.siteId)) {
        previewBySite.set(data.siteId, {
          siteId: data.siteId,
          siteName: data.siteName,
          meters: [],
        });
      }

      const sitePreview = previewBySite.get(data.siteId)!;

      // Find or create meter entry
      let meterEntry = sitePreview.meters.find(
        m => m.meterName === data.meterName && m.energyType === data.energyType && m.usage === data.usage
      );

      if (!meterEntry) {
        meterEntry = {
          meterName: data.meterName,
          energyType: data.energyType,
          usage: data.usage,
          periods: [],
          totalQuantity: 0,
        };
        sitePreview.meters.push(meterEntry);
      }

      meterEntry.periods.push({
        period: data.periodStr,
        quantity: data.quantity,
        unit: data.unit,
      });
      meterEntry.totalQuantity += data.quantity;
    }

    // Convert to array and sort
    const preview = Array.from(previewBySite.values()).map(site => ({
      ...site,
      meters: site.meters.sort((a, b) => b.totalQuantity - a.totalQuantity),
    }));

    // If preview mode, return the detailed data without importing
    if (previewMode) {
      return NextResponse.json({
        success: true,
        mode: "preview",
        preview,
        unmatchedSites,
        availableSites: sites.map(s => ({ id: s.id, name: s.name })),
        siteMatches: results.siteMatches,
        skipped: results.skipped,
        errors: results.errors.slice(0, 20),
        _debug: {
          totalSitesInContract: sites.length,
          totalAliases: siteAliases.length,
          loadedAliases: siteAliases.map(a => ({ alias: a.alias, siteName: a.site.name })),
          siteNamesInDb: sites.map(s => s.name).slice(0, 20),
        },
      });
    }

    // Import mode: aggregate by site/energy/usage/period and upsert
    const aggregatedData = new Map<string, {
      siteId: string;
      energyType: EnergyType;
      usage: EnergyUsage;
      period: Date;
      quantity: number;
      unit: string;
      meterNames: string[];
    }>();

    for (const data of meterData.values()) {
      const aggKey = `${data.siteId}|${data.energyType}|${data.usage}|${data.periodStr}`;

      if (aggregatedData.has(aggKey)) {
        const existing = aggregatedData.get(aggKey)!;
        existing.quantity += data.quantity;
        if (data.meterName && !existing.meterNames.includes(data.meterName)) {
          existing.meterNames.push(data.meterName);
        }
      } else {
        aggregatedData.set(aggKey, {
          siteId: data.siteId,
          energyType: data.energyType,
          usage: data.usage,
          period: data.period,
          quantity: data.quantity,
          unit: data.unit,
          meterNames: data.meterName ? [data.meterName] : [],
        });
      }
    }

    // Upsert aggregated data
    for (const data of aggregatedData.values()) {
      try {
        const existing = await prisma.consumption.findUnique({
          where: {
            siteId_energyType_usage_period: {
              siteId: data.siteId,
              energyType: data.energyType,
              usage: data.usage,
              period: data.period,
            },
          },
        });

        const meterName = data.meterNames.length > 0 ? data.meterNames.join(", ") : null;

        if (existing) {
          await prisma.consumption.update({
            where: { id: existing.id },
            data: {
              quantity: data.quantity,
              unit: data.unit,
              meterName,
            },
          });
          results.updated++;
        } else {
          await prisma.consumption.create({
            data: {
              siteId: data.siteId,
              organizationId: user.organizationId,
              energyType: data.energyType,
              usage: data.usage,
              period: data.period,
              quantity: data.quantity,
              unit: data.unit,
              meterName,
            },
          });
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          row: 0,
          site: data.siteId,
          error: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
        });
      }
    }

    // Auto-create meters in the metering schema
    const metersCreated: string[] = [];
    const uniqueMeters = new Map<string, {
      siteId: string;
      meterName: string;
      energyType: EnergyType;
      unit: string;
    }>();

    // Collect unique meters per site
    for (const data of meterData.values()) {
      if (data.meterName) {
        const key = `${data.siteId}|${data.meterName}`;
        if (!uniqueMeters.has(key)) {
          uniqueMeters.set(key, {
            siteId: data.siteId,
            meterName: data.meterName,
            energyType: data.energyType,
            unit: data.unit,
          });
        }
      }
    }

    // Create meters if they don't exist
    for (const meter of uniqueMeters.values()) {
      try {
        // Check if meter already exists for this site
        const existingMeter = await prisma.meter.findFirst({
          where: {
            siteId: meter.siteId,
            name: meter.meterName,
          },
        });

        if (!existingMeter) {
          // Map energyType to MeterFluid
          const fluid = mapEnergyTypeToFluid(meter.energyType, meter.meterName);

          await prisma.meter.create({
            data: {
              siteId: meter.siteId,
              name: meter.meterName,
              fluid,
              type: "DIVISIONNAIRE", // Default, user can change to PRINCIPAL later
              dataSource: "MANUEL",
              unit: meter.unit,
              isActive: true,
            },
          });
          metersCreated.push(meter.meterName);
        }
      } catch (err) {
        console.error("Error creating meter:", meter.meterName, err);
      }
    }

    // Update lastReleveDate in HeatingSeason for each site
    for (const [siteId, maxDate] of maxReleveDateBySite) {
      try {
        // Determine season for this date
        const year = maxDate.getMonth() >= 6 ? maxDate.getFullYear() : maxDate.getFullYear() - 1;
        const season = `${year}-${year + 1}`;

        // Update or create HeatingSeason with lastReleveDate
        const existing = await prisma.heatingSeason.findUnique({
          where: { siteId_season: { siteId, season } },
        });

        if (existing) {
          // Only update if new date is more recent
          if (!existing.lastReleveDate || maxDate > existing.lastReleveDate) {
            await prisma.heatingSeason.update({
              where: { id: existing.id },
              data: { lastReleveDate: maxDate },
            });
          }
        } else {
          // Create a new HeatingSeason with the relevé date as start date (fallback)
          await prisma.heatingSeason.create({
            data: {
              siteId,
              season,
              startDate: maxDate, // Use relevé date as default start if no other info
              lastReleveDate: maxDate,
            },
          });
        }
      } catch (err) {
        console.error("Error updating lastReleveDate for site:", siteId, err);
      }
    }

    return NextResponse.json({
      success: true,
      mode: "import",
      metersCreated: metersCreated.length,
      imported: results.imported,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 20),
      totalErrors: results.errors.length,
      siteMatches: results.siteMatches,
      unmatchedSites,
      // List of available sites for manual mapping
      availableSites: sites.map(s => ({ id: s.id, name: s.name })),
      // Debug: show loaded aliases
      _debug: {
        loadedAliases: siteAliases.map(a => ({ alias: a.alias, siteName: a.site.name })),
      },
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
function createSiteMatchers(
  sites: { id: string; name: string; city: string | null }[],
  aliases: { alias: string; siteId: string; site: { name: string } }[]
) {
  const normalizedNames = new Map<string, { id: string; name: string }>();
  const keywords = new Map<string, { id: string; name: string }[]>();
  const aliasMap = new Map<string, { id: string; name: string }>();

  // Build alias map first (priority over name matching)
  for (const alias of aliases) {
    const normalized = normalizeSiteName(alias.alias);
    console.log("Adding alias to map:", `"${alias.alias}" -> "${normalized}" -> ${alias.site.name}`);
    aliasMap.set(normalized, { id: alias.siteId, name: alias.site.name });
  }

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

  return { normalizedNames, keywords, aliasMap };
}

// Helper: Normalize site name for matching
function normalizeSiteName(name: string): string {
  let normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents

  // Remove common suffixes from exploitant files
  // e.g., "GYMNASE COGNEVAULT - GAZ - GONESSE" -> "gymnase cognevault"
  normalized = normalized
    .replace(/\s*-\s*(gonesse|gaz|elec|electricite|eau|site\s*\d+|rcu)(\s*-\s*|$)/gi, " ")
    .replace(/\s*-\s*site\s*\d+\s*/gi, " ")
    .replace(/\s*-\s*$/g, "") // Remove trailing dash
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

// Helper: Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Helper: Calculate similarity ratio (0 to 1)
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// Helper: Match site by name
function matchSite(
  installationName: string,
  matchers: ReturnType<typeof createSiteMatchers>
): { siteId?: string; siteName?: string; confidence?: number; suggestions?: Array<{ id: string; name: string; score: number }> } {
  const normalized = normalizeSiteName(installationName);
  console.log(`[MATCH] Input: "${installationName}" -> Normalized: "${normalized}"`);

  // 0. Try alias match first (exact match from saved aliases)
  const aliasMatch = matchers.aliasMap.get(normalized);
  if (aliasMatch) {
    console.log(`[MATCH] ✓ Alias match: ${aliasMatch.name}`);
    return { siteId: aliasMatch.id, siteName: aliasMatch.name, confidence: 1 };
  }

  // 1. Try exact match
  const exact = matchers.normalizedNames.get(normalized);
  if (exact) {
    console.log(`[MATCH] ✓ Exact match: ${exact.name}`);
    return { siteId: exact.id, siteName: exact.name, confidence: 1 };
  }
  console.log(`[MATCH] Available sites:`, Array.from(matchers.normalizedNames.keys()).slice(0, 10));

  // 2. Try partial match - check if normalized name contains site name or vice versa
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    if (normalized.includes(siteName) || siteName.includes(normalized)) {
      return { siteId: id, siteName: name, confidence: 0.9 };
    }
  }

  // 3. Try PREFIX match - for truncated names like "GYMNASE COG" -> "Gymnase Eugène Cognevault"
  // Check if the site name STARTS WITH the import name (handling truncation)
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    // Remove spaces and compare as prefix
    const normalizedNoSpace = normalized.replace(/\s+/g, "");
    const siteNameNoSpace = siteName.replace(/\s+/g, "");

    if (siteNameNoSpace.startsWith(normalizedNoSpace) && normalizedNoSpace.length >= 6) {
      return { siteId: id, siteName: name, confidence: 0.85 };
    }

    // Also try word-by-word prefix matching
    // "gymnase cog" should match "gymnase eugene cognevault"
    const importWords = normalized.split(/\s+/).filter(w => w.length >= 2);
    const siteWords = siteName.split(/\s+/).filter(w => w.length >= 2);

    if (importWords.length >= 2 && siteWords.length >= 2) {
      let allWordsMatch = true;
      for (let i = 0; i < importWords.length; i++) {
        const importWord = importWords[i];
        // Find a site word that starts with this import word (or matches exactly)
        const hasMatch = siteWords.some(sw =>
          sw.startsWith(importWord) || importWord.startsWith(sw) || sw === importWord
        );
        if (!hasMatch) {
          allWordsMatch = false;
          break;
        }
      }
      if (allWordsMatch) {
        return { siteId: id, siteName: name, confidence: 0.8 };
      }
    }
  }

  // 4. Build suggestions using fuzzy matching (for manual selection)
  const suggestions: Array<{ id: string; name: string; score: number }> = [];
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    // Compare word by word for typo detection
    const installWords = normalized.split(/\s+/).filter(w => w.length > 2);
    const siteWords = siteName.split(/\s+/).filter(w => w.length > 2);

    let matchedWords = 0;
    let totalScore = 0;

    for (const installWord of installWords) {
      let bestWordScore = 0;
      for (const siteWord of siteWords) {
        // Check prefix match (for truncated words)
        if (siteWord.startsWith(installWord) || installWord.startsWith(siteWord)) {
          bestWordScore = Math.max(bestWordScore, 0.9);
        }
        const wordSim = similarity(installWord, siteWord);
        if (wordSim > bestWordScore) bestWordScore = wordSim;
      }
      if (bestWordScore > 0.6) {
        matchedWords++;
        totalScore += bestWordScore;
      }
    }

    // Calculate overall score
    const matchRatio = matchedWords / Math.max(installWords.length, 1);
    const avgScore = matchedWords > 0 ? (totalScore / matchedWords) * matchRatio : 0;

    if (avgScore > 0.35) {
      suggestions.push({ id, name, score: avgScore });
    }
  }

  // Sort suggestions by score
  suggestions.sort((a, b) => b.score - a.score);

  // Auto-match if confident (score > 0.75)
  if (suggestions.length > 0 && suggestions[0].score > 0.75) {
    return {
      siteId: suggestions[0].id,
      siteName: suggestions[0].name,
      confidence: suggestions[0].score,
      suggestions: suggestions.slice(0, 5)
    };
  }

  // No confident match - return suggestions for manual selection
  console.log(`[MATCH] ✗ No match for "${normalized}", top suggestions:`, suggestions.slice(0, 3).map(s => `${s.name} (${s.score.toFixed(2)})`));
  return { suggestions: suggestions.slice(0, 5) };
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
  isHeatingStart: boolean,
  isHeatingStop: boolean
) {
  // Determine season (e.g., "2024-2025" for Oct 2024 to May 2025)
  const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const season = `${year}-${year + 1}`;

  try {
    const existing = await prisma.heatingSeason.findUnique({
      where: { siteId_season: { siteId, season } },
    });

    if (existing) {
      // Update start date if this is a heating start marker
      if (isHeatingStart) {
        await prisma.heatingSeason.update({
          where: { id: existing.id },
          data: { startDate: date },
        });
      }
      // Update end date if this is a heating stop marker
      if (isHeatingStop && !existing.endDate) {
        await prisma.heatingSeason.update({
          where: { id: existing.id },
          data: { endDate: date },
        });
      }
    } else if (isHeatingStart) {
      // Create new heating season if start marker detected
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

// Helper: Map EnergyType to MeterFluid based on energy type and meter name
function mapEnergyTypeToFluid(
  energyType: EnergyType,
  meterName: string
): "GAZ" | "ELECTRICITE" | "EAU_CHAUDE" | "EAU_FROIDE" | "CHALEUR" | "FIOUL" {
  const nameLower = meterName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Check meter name for specific indicators
  if (nameLower.includes("ecs") || nameLower.includes("eau chaude") || nameLower.includes("sanitaire")) {
    return "EAU_CHAUDE";
  }
  if (nameLower.includes("eau froide") || nameLower.includes("ef ")) {
    return "EAU_FROIDE";
  }
  if (nameLower.includes("chaleur") || nameLower.includes("rcu") || nameLower.includes("reseau")) {
    return "CHALEUR";
  }
  if (nameLower.includes("fioul") || nameLower.includes("fuel")) {
    return "FIOUL";
  }

  // Map by energy type
  switch (energyType) {
    case "GAZ":
      return "GAZ";
    case "ELECTRICITE":
      return "ELECTRICITE";
    case "FIOUL":
      return "FIOUL";
    case "RESEAU_CHALEUR":
      return "CHALEUR";
    case "EAU":
      // Distinguish between hot and cold water
      if (nameLower.includes("chauff") || nameLower.includes("calori")) {
        return "CHALEUR";
      }
      return "EAU_FROIDE";
    default:
      // Default based on common patterns
      if (nameLower.includes("gaz") || nameLower.includes("grdf")) {
        return "GAZ";
      }
      if (nameLower.includes("elec") || nameLower.includes("pdl")) {
        return "ELECTRICITE";
      }
      return "GAZ"; // Default fallback
  }
}
