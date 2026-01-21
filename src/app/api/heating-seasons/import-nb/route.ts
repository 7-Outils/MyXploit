import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import * as XLSX from "xlsx";
import { EnergyType, NbUnit } from "@/generated/prisma/client";

// Determine NB unit based on energy type
// GAZ, FIOUL, BOIS → PCS (pouvoir calorifique supérieur)
// RESEAU_CHALEUR, ELECTRICITE → UTILE (énergie utile)
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
      return "PCS"; // Default to PCS for AUTRE, EAU, etc.
  }
}

// POST /api/heating-seasons/import-nb - Import NB values from DPGF Excel file
// Format: Site | Année 1 | Année 2 | ... | Année N
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer des données" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contractId = formData.get("contractId") as string;
    const previewMode = formData.get("preview") === "true";
    // Unit overrides: JSON string { siteId: "PCS" | "UTILE" }
    const unitOverridesStr = formData.get("unitOverrides") as string | null;
    const unitOverrides: Record<string, NbUnit> = unitOverridesStr ? JSON.parse(unitOverridesStr) : {};

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (!contractId) {
      return NextResponse.json(
        { error: "Le contrat est requis pour déterminer les années" },
        { status: 400 }
      );
    }

    // Get contract to determine year mapping
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        yearType: true,
        yearStartMonth: true,
        yearStartDay: true,
        contractSites: {
          select: { siteId: true },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Parse as raw rows
    const rawData = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: "Le fichier ne contient pas de données" },
        { status: 400 }
      );
    }

    // Find header row - scan first 15 rows to find one with "Libellé" or "NB" columns
    // This handles AE files where headers are not on row 1
    let headerRowIndex = 0;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (!row) continue;
      const rowHeaders = row.map((h) => String(h || "").trim().toLowerCase());

      // Check if this row has typical header columns
      const hasLibelle = rowHeaders.some(h => h === "libellé" || h === "libelle");
      const hasNB = rowHeaders.some(h => h.includes("nb") && h.includes("ann"));
      const hasSite = rowHeaders.some(h => h === "site" || h.includes("installation"));
      const hasAnnee = rowHeaders.some(h => h.includes("année") || h.includes("annee"));

      if ((hasLibelle && hasNB) || (hasSite && hasAnnee) || hasNB) {
        headerRowIndex = i;
        headers = row.map((h) => String(h || "").trim());
        break;
      }
    }

    // Fallback to first row if no header found
    if (headers.length === 0) {
      headers = rawData[0].map((h) => String(h || "").trim());
    }

    // Find site column - prefer "Libellé" for AE format
    let actualSiteCol = 0;
    const libelleColIndex = headers.findIndex((h) => {
      const lower = h.toLowerCase();
      return lower === "libellé" || lower === "libelle";
    });

    if (libelleColIndex !== -1) {
      actualSiteCol = libelleColIndex;
    } else {
      // Fallback: find "Site", "Installation", "Nom"
      const siteColIndex = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return lower.includes("site") || lower.includes("installation") || lower === "nom";
      });
      if (siteColIndex !== -1) {
        actualSiteCol = siteColIndex;
      }
    }

    // Find year columns - support "NB - Année X" format from AE files
    const yearColumns: { index: number; year: number }[] = [];
    headers.forEach((h, index) => {
      if (index === actualSiteCol) return;

      const lower = h.toLowerCase();

      // Match "NB - Année 1", "NB - Année 2" format (AE files)
      const nbYearMatch = lower.match(/nb\s*[-–]\s*ann[eé]e\s*(\d+)/);
      if (nbYearMatch) {
        yearColumns.push({ index, year: parseInt(nbYearMatch[1]) });
        return;
      }

      // Match patterns like "Année 1", "An 1", "Year 1", "A1"
      const yearMatch = lower.match(/(?:ann[eé]e|an|year|a)\s*(\d+)/);
      if (yearMatch) {
        yearColumns.push({ index, year: parseInt(yearMatch[1]) });
        return;
      }

      // Match direct season format: 2024-2025
      const seasonMatch = h.match(/(\d{4})-(\d{4})/);
      if (seasonMatch) {
        yearColumns.push({ index, year: parseInt(seasonMatch[1]) - contract.startDate.getFullYear() + 1 });
      }
    });

    if (yearColumns.length === 0) {
      return NextResponse.json(
        { error: "Aucune colonne d'année trouvée (NB - Année 1, Année 1, etc.)" },
        { status: 400 }
      );
    }

    // Sort year columns by year number
    yearColumns.sort((a, b) => a.year - b.year);

    // Get sites for matching - filter by contract sites
    const contractSiteIds = contract.contractSites.map((cs) => cs.siteId);
    const sites = await prisma.site.findMany({
      where: {
        organizationId: effectiveOrgId,
        id: { in: contractSiteIds },
      },
      select: { id: true, name: true, city: true, energyType: true },
    });

    // Create a map to quickly get site energy type
    const siteEnergyTypeMap = new Map(sites.map((s) => [s.id, s.energyType]));

    // Get site aliases
    const siteAliases = await prisma.siteAlias.findMany({
      where: { organizationId: effectiveOrgId },
      select: { alias: true, siteId: true, site: { select: { name: true } } },
    });

    // Create lookup maps
    const siteMatchers = createSiteMatchers(sites, siteAliases);

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; site: string; error: string }[],
      siteMatches: {} as Record<string, {
        matched: boolean;
        siteId?: string;
        siteName?: string;
        suggestions?: Array<{ id: string; name: string; score: number }>;
      }>,
    };

    // Preview data structure
    const previewData: Array<{
      row: number;
      excelSiteName: string;
      matchedSite?: { id: string; name: string; energyType: string; detectedUnit: NbUnit };
      years: Array<{ year: number; season: string; nb: number | null }>;
    }> = [];

    // Calculate season for each contract year
    // Uses same logic as energy page display to ensure consistency
    const getSeasonForYear = (contractYear: number): string => {
      const startYear = contract.startDate.getFullYear();
      const startMonth = contract.startDate.getMonth(); // 0-indexed (July = 6)

      // First season: if contract starts July or later (month >= 6),
      // season starts same year (e.g., July 2025 -> season 2025-2026)
      // Otherwise, season starts previous year (e.g., January 2025 -> season 2024-2025)
      const firstSeasonEndYear = startMonth >= 6 ? startYear + 1 : startYear;

      // Calculate season for the requested contract year
      const seasonEndYear = firstSeasonEndYear + (contractYear - 1);
      return `${seasonEndYear - 1}-${seasonEndYear}`;
    };

    // Process data rows - start after header row
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 1; // Excel row number (1-indexed)

      const siteName = String(row[actualSiteCol] || "").trim();
      if (!siteName) continue;

      // Skip rows that look like sub-headers or empty site names
      // Also skip if site name is purely numeric (site number without name)
      if (siteName.toLowerCase().includes("total") || /^\d+$/.test(siteName)) continue;

      // Match site
      const siteMatch = matchSite(siteName, siteMatchers);

      // Track site matching
      if (!results.siteMatches[siteName]) {
        results.siteMatches[siteName] = siteMatch.siteId
          ? { matched: true, siteId: siteMatch.siteId, siteName: siteMatch.siteName }
          : { matched: false, suggestions: siteMatch.suggestions };
      }

      // Build preview row
      const siteEnergyType = siteMatch.siteId ? siteEnergyTypeMap.get(siteMatch.siteId) : undefined;
      const previewRow: typeof previewData[0] = {
        row: rowNum,
        excelSiteName: siteName,
        matchedSite: siteMatch.siteId && siteEnergyType ? {
          id: siteMatch.siteId,
          name: siteMatch.siteName!,
          energyType: siteEnergyType,
          detectedUnit: getNbUnitForEnergyType(siteEnergyType),
        } : undefined,
        years: [],
      };

      // Process each year column
      for (const yearCol of yearColumns) {
        const nbValue = row[yearCol.index];
        const nbNumberRaw = typeof nbValue === "number" ? nbValue : parseFloat(String(nbValue || "").replace(",", "."));
        // Round NB value to integer (no decimals)
        const nbNumber = isNaN(nbNumberRaw) ? NaN : Math.round(nbNumberRaw);
        const season = getSeasonForYear(yearCol.year);

        previewRow.years.push({
          year: yearCol.year,
          season,
          nb: isNaN(nbNumber) ? null : nbNumber,
        });

        // If not preview mode and we have a match and valid NB, upsert
        if (!previewMode && siteMatch.siteId && !isNaN(nbNumber) && nbNumber > 0) {
          try {
            // Determine unit: use override if provided, otherwise detect from energy type
            const siteEnergyType = siteEnergyTypeMap.get(siteMatch.siteId);
            const detectedUnit = siteEnergyType ? getNbUnitForEnergyType(siteEnergyType) : "PCS";
            const nbUnit = unitOverrides[siteMatch.siteId] || detectedUnit;

            const existing = await prisma.heatingSeason.findUnique({
              where: { siteId_season: { siteId: siteMatch.siteId, season } },
            });

            if (existing) {
              await prisma.heatingSeason.update({
                where: { id: existing.id },
                data: { nb: nbNumber, nbUnit },
              });
              results.updated++;
            } else {
              // Create heating season with NB (without start date - will be set when heating starts)
              await prisma.heatingSeason.create({
                data: {
                  siteId: siteMatch.siteId,
                  season,
                  startDate: new Date(parseInt(season.split("-")[0]), 6, 1), // Default: July 1st
                  nb: nbNumber,
                  nbUnit,
                },
              });
              results.imported++;
            }
          } catch (error) {
            results.errors.push({
              row: rowNum,
              site: siteName,
              error: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
            });
          }
        }
      }

      previewData.push(previewRow);

      if (!siteMatch.siteId) {
        results.skipped++;
      }
    }

    // Build unmatched sites list
    const unmatchedSites = Object.entries(results.siteMatches)
      .filter(([, match]) => !match.matched)
      .map(([excelName, match]) => ({
        excelName,
        suggestions: match.suggestions || [],
      }));

    if (previewMode) {
      return NextResponse.json({
        success: true,
        mode: "preview",
        contract: {
          id: contract.id,
          title: contract.title,
          startDate: contract.startDate.toISOString(),
          endDate: contract.endDate.toISOString(),
        },
        yearColumns: yearColumns.map((yc) => ({
          year: yc.year,
          season: getSeasonForYear(yc.year),
          headerLabel: headers[yc.index],
        })),
        preview: previewData,
        siteMatches: results.siteMatches,
        unmatchedSites,
        availableSites: sites.map((s) => ({
          id: s.id,
          name: s.name,
          energyType: s.energyType,
          detectedUnit: getNbUnitForEnergyType(s.energyType),
        })),
      });
    }

    return NextResponse.json({
      success: true,
      mode: "import",
      imported: results.imported,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 20),
      totalErrors: results.errors.length,
      unmatchedSites,
    });
  } catch (error) {
    console.error("Error importing NB values:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des NB" },
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
  const aliasMap = new Map<string, { id: string; name: string }>();

  // Build alias map first (priority)
  for (const alias of aliases) {
    const normalized = normalizeSiteName(alias.alias);
    aliasMap.set(normalized, { id: alias.siteId, name: alias.site.name });
  }

  for (const site of sites) {
    const normalized = normalizeSiteName(site.name);
    normalizedNames.set(normalized, { id: site.id, name: site.name });
  }

  return { normalizedNames, aliasMap };
}

// Helper: Normalize site name
function normalizeSiteName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: Calculate similarity
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let distance = 0;
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
  distance = matrix[b.length][a.length];

  return 1 - distance / maxLen;
}

// Helper: Match site by name
function matchSite(
  installationName: string,
  matchers: ReturnType<typeof createSiteMatchers>
): { siteId?: string; siteName?: string; suggestions?: Array<{ id: string; name: string; score: number }> } {
  const normalized = normalizeSiteName(installationName);

  // 1. Try alias match
  const aliasMatch = matchers.aliasMap.get(normalized);
  if (aliasMatch) {
    return { siteId: aliasMatch.id, siteName: aliasMatch.name };
  }

  // 2. Try exact match
  const exact = matchers.normalizedNames.get(normalized);
  if (exact) {
    return { siteId: exact.id, siteName: exact.name };
  }

  // 3. Try partial match
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    if (normalized.includes(siteName) || siteName.includes(normalized)) {
      return { siteId: id, siteName: name };
    }
  }

  // 4. Build suggestions using fuzzy matching
  const suggestions: Array<{ id: string; name: string; score: number }> = [];
  for (const [siteName, { id, name }] of matchers.normalizedNames) {
    const score = similarity(normalized, siteName);
    if (score > 0.4) {
      suggestions.push({ id, name, score });
    }
  }
  suggestions.sort((a, b) => b.score - a.score);

  // Auto-match if very confident
  if (suggestions.length > 0 && suggestions[0].score > 0.85) {
    return { siteId: suggestions[0].id, siteName: suggestions[0].name, suggestions: suggestions.slice(0, 5) };
  }

  return { suggestions: suggestions.slice(0, 5) };
}
