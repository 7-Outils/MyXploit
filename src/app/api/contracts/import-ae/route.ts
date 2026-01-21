import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
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
function mapContractType(type: string): ContractType {
  const normalized = type?.toUpperCase().trim();
  switch (normalized) {
    case "PFI":
      return "PFI";
    case "PF":
      return "PF";
    case "MTI":
      return "MTI";
    case "MCI":
      return "MCI";
    case "CPI":
      return "CPI";
    case "MT":
      return "MT";
    case "CP":
      return "CP";
    case "MC":
      return "MC";
    case "MF":
      return "MF";
    default:
      return "MC"; // Default
  }
}

// POST /api/contracts/import-ae - Import AE (Acte d'Engagement) file
// Imports: NB values, P2/P3 budgets, contract type per site
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

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (!contractId) {
      return NextResponse.json(
        { error: "Le contrat est requis" },
        { status: 400 }
      );
    }

    // Get contract
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
          select: {
            id: true,
            siteId: true,
            site: { select: { id: true, name: true, energyType: true } }
          },
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

    // Use first sheet or "P2P3" sheet if available
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

      // Check if this row has typical header columns
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
        const lower = h.toLowerCase();
        return patterns.some(p => lower.includes(p));
      });
    };

    const findExactColIndex = (pattern: RegExp): number => {
      return headers.findIndex((h) => pattern.test(h.toLowerCase()));
    };

    // Site name column (Libellé)
    let siteColIndex = headers.findIndex(h =>
      h.toLowerCase() === "libellé" || h.toLowerCase() === "libelle"
    );
    if (siteColIndex === -1) {
      siteColIndex = findColIndex(["site", "installation", "nom"]);
    }
    if (siteColIndex === -1) siteColIndex = 1; // Default to column B

    // Contract type column
    const contractTypeColIndex = headers.findIndex(h =>
      h.toLowerCase() === "contrat" || h.toLowerCase() === "type contrat"
    );

    // NB columns (NB - Année 1, NB - Année 2, etc.)
    const nbColumns: { index: number; year: number }[] = [];
    headers.forEach((h, index) => {
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

    // Build site matchers
    const siteAliases = await prisma.siteAlias.findMany({
      where: { organizationId: effectiveOrgId },
      select: { alias: true, siteId: true, site: { select: { name: true } } },
    });

    const contractSiteIds = contract.contractSites.map(cs => cs.siteId);
    const sites = contract.contractSites.map(cs => ({
      id: cs.site.id,
      name: cs.site.name,
      energyType: cs.site.energyType,
      contractSiteId: cs.id,
    }));

    const siteMatchers = createSiteMatchers(sites, siteAliases);

    const results = {
      sitesUpdated: 0,
      seasonsCreated: 0,
      seasonsUpdated: 0,
      skipped: 0,
      errors: [] as { row: number; site: string; error: string }[],
    };

    const previewData: Array<{
      row: number;
      excelSiteName: string;
      matchedSite?: { id: string; name: string; contractSiteId: string };
      contractType?: string;
      nb?: { [year: number]: number | null };
      p2?: { p21?: number; p22?: number; p23?: number; p24?: number; p25?: number; p26?: number; total?: number };
      p3?: { p31?: number; p32?: number; p33?: number; p34?: number; p35?: number; p36?: number; total?: number };
    }> = [];

    // Calculate season for contract year
    const getSeasonForYear = (contractYear: number): string => {
      const startYear = contract.startDate.getFullYear();
      const startMonth = contract.yearStartMonth;

      if (startMonth >= 7) {
        const seasonStart = startYear + (contractYear - 1);
        return `${seasonStart}-${seasonStart + 1}`;
      } else {
        const seasonStart = startYear - 1 + (contractYear - 1);
        return `${seasonStart}-${seasonStart + 1}`;
      }
    };

    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 1;

      const siteName = String(row[siteColIndex] || "").trim();
      if (!siteName) continue;
      if (siteName.toLowerCase().includes("total") || /^\d+$/.test(siteName)) continue;

      // Match site
      const siteMatch = matchSite(siteName, siteMatchers);

      const previewRow: typeof previewData[0] = {
        row: rowNum,
        excelSiteName: siteName,
        matchedSite: siteMatch.contractSiteId ? {
          id: siteMatch.siteId!,
          name: siteMatch.siteName!,
          contractSiteId: siteMatch.contractSiteId,
        } : undefined,
      };

      // Parse contract type
      if (contractTypeColIndex !== -1) {
        const contractTypeVal = String(row[contractTypeColIndex] || "").trim();
        if (contractTypeVal) {
          previewRow.contractType = contractTypeVal;
        }
      }

      // Parse NB values
      if (nbColumns.length > 0) {
        previewRow.nb = {};
        for (const nbCol of nbColumns) {
          const val = row[nbCol.index];
          const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", "."));
          previewRow.nb[nbCol.year] = isNaN(num) ? null : num;
        }
      }

      // Parse P2 values
      const parseNum = (idx: number): number | undefined => {
        if (idx === -1) return undefined;
        const val = row[idx];
        const num = typeof val === "number" ? val : parseFloat(String(val || "").replace(",", "."));
        return isNaN(num) ? undefined : num;
      };

      previewRow.p2 = {
        p21: parseNum(p21ColIndex),
        p22: parseNum(p22ColIndex),
        p23: parseNum(p23ColIndex),
        p24: parseNum(p24ColIndex),
        p25: parseNum(p25ColIndex),
        p26: parseNum(p26ColIndex),
        total: parseNum(p2TotalColIndex),
      };

      previewRow.p3 = {
        p31: parseNum(p31ColIndex),
        p32: parseNum(p32ColIndex),
        p33: parseNum(p33ColIndex),
        p34: parseNum(p34ColIndex),
        p35: parseNum(p35ColIndex),
        p36: parseNum(p36ColIndex),
        total: parseNum(p3TotalColIndex),
      };

      previewData.push(previewRow);

      // If not preview and site matched, update database
      if (!previewMode && siteMatch.contractSiteId) {
        try {
          // Update ContractSite with P2/P3 and contract type
          const updateData: Record<string, number | string | null | boolean> = {};

          if (previewRow.contractType) {
            updateData.contractType = mapContractType(previewRow.contractType);
            // Set hasP1/hasP2/hasP3 based on contract type
            if (previewRow.contractType === "PFI" || previewRow.contractType === "MTI") {
              updateData.hasP1 = true;
              updateData.hasP2 = true;
              updateData.hasP3 = true;
            } else if (previewRow.contractType === "PF") {
              updateData.hasP1 = true;
              updateData.hasP2 = true;
            }
          }

          // P2 values
          if (previewRow.p2?.p21 !== undefined) updateData.amountP21 = previewRow.p2.p21;
          if (previewRow.p2?.p22 !== undefined) updateData.amountP22 = previewRow.p2.p22;
          if (previewRow.p2?.p23 !== undefined) updateData.amountP23 = previewRow.p2.p23;
          if (previewRow.p2?.p24 !== undefined) updateData.amountP24 = previewRow.p2.p24;
          if (previewRow.p2?.p25 !== undefined) updateData.amountP25 = previewRow.p2.p25;
          if (previewRow.p2?.p26 !== undefined) updateData.amountP26 = previewRow.p2.p26;
          if (previewRow.p2?.total !== undefined) updateData.amountP2 = previewRow.p2.total;

          // P3 values
          if (previewRow.p3?.p31 !== undefined) updateData.amountP31 = previewRow.p3.p31;
          if (previewRow.p3?.p32 !== undefined) updateData.amountP32 = previewRow.p3.p32;
          if (previewRow.p3?.p33 !== undefined) updateData.amountP33 = previewRow.p3.p33;
          if (previewRow.p3?.p34 !== undefined) updateData.amountP34 = previewRow.p3.p34;
          if (previewRow.p3?.p35 !== undefined) updateData.amountP35 = previewRow.p3.p35;
          if (previewRow.p3?.p36 !== undefined) updateData.amountP36 = previewRow.p3.p36;
          if (previewRow.p3?.total !== undefined) updateData.amountP3 = previewRow.p3.total;

          if (Object.keys(updateData).length > 0) {
            await prisma.contractSite.update({
              where: { id: siteMatch.contractSiteId },
              data: updateData,
            });
            results.sitesUpdated++;
          }

          // Update/Create NB in HeatingSeason
          if (previewRow.nb) {
            const site = sites.find(s => s.id === siteMatch.siteId);
            const nbUnit = site ? getNbUnitForEnergyType(site.energyType) : "PCS";

            for (const [yearStr, nbValue] of Object.entries(previewRow.nb)) {
              const year = parseInt(yearStr);
              if (nbValue === null || nbValue <= 0) continue;

              const season = getSeasonForYear(year);

              const existing = await prisma.heatingSeason.findUnique({
                where: { siteId_season: { siteId: siteMatch.siteId!, season } },
              });

              if (existing) {
                await prisma.heatingSeason.update({
                  where: { id: existing.id },
                  data: { nb: nbValue, nbUnit },
                });
                results.seasonsUpdated++;
              } else {
                await prisma.heatingSeason.create({
                  data: {
                    siteId: siteMatch.siteId!,
                    season,
                    startDate: new Date(parseInt(season.split("-")[0]), 6, 1),
                    nb: nbValue,
                    nbUnit,
                  },
                });
                results.seasonsCreated++;
              }
            }
          }
        } catch (error) {
          results.errors.push({
            row: rowNum,
            site: siteName,
            error: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
          });
        }
      } else if (!siteMatch.contractSiteId) {
        results.skipped++;
      }
    }

    if (previewMode) {
      // Transform previewData to the format expected by the UI
      const resultsForUI = previewData.map(row => ({
        row: row.row,
        status: row.matchedSite ? "ok" as const : "error" as const,
        siteName: row.excelSiteName,
        siteId: row.matchedSite?.id,
        contractType: row.contractType,
        nbValues: row.nb ? Object.fromEntries(
          Object.entries(row.nb).filter(([_, v]) => v !== null).map(([k, v]) => [k, v as number])
        ) : undefined,
        p2Values: row.p2 ? {
          P21: row.p2.p21,
          P22: row.p2.p22,
          P23: row.p2.p23,
          P24: row.p2.p24,
          P25: row.p2.p25,
          P26: row.p2.p26,
        } : undefined,
        p3Values: row.p3 ? {
          P31: row.p3.p31,
          P32: row.p3.p32,
          P33: row.p3.p33,
          P34: row.p3.p34,
          P35: row.p3.p35,
          P36: row.p3.p36,
        } : undefined,
        message: row.matchedSite
          ? `Matché avec: ${row.matchedSite.name}`
          : "Site non trouvé dans le contrat",
      }));

      const valid = resultsForUI.filter(r => r.status === "ok").length;
      const errors = resultsForUI.filter(r => r.status === "error").length;

      return NextResponse.json({
        total: resultsForUI.length,
        valid,
        errors,
        warnings: 0,
        results: resultsForUI,
        contract: {
          id: contract.id,
          title: contract.title,
        },
        columns: {
          siteCol: siteColIndex,
          contractTypeCol: contractTypeColIndex,
          nbColumns: nbColumns.map(c => ({ year: c.year, index: c.index })),
        },
        availableSites: sites.map(s => ({ id: s.id, name: s.name })),
      });
    }

    return NextResponse.json({
      success: true,
      mode: "import",
      sitesUpdated: results.sitesUpdated,
      seasonsCreated: results.seasonsCreated,
      seasonsUpdated: results.seasonsUpdated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 20),
      totalErrors: results.errors.length,
    });
  } catch (error) {
    console.error("Error importing AE file:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import du fichier AE" },
      { status: 500 }
    );
  }
}

// Helper functions
function createSiteMatchers(
  sites: { id: string; name: string; contractSiteId: string }[],
  aliases: { alias: string; siteId: string; site: { name: string } }[]
) {
  const normalizedNames = new Map<string, { id: string; name: string; contractSiteId: string }>();
  const aliasMap = new Map<string, { id: string; name: string; contractSiteId: string }>();

  for (const alias of aliases) {
    const normalized = normalizeSiteName(alias.alias);
    const site = sites.find(s => s.id === alias.siteId);
    if (site) {
      aliasMap.set(normalized, { id: site.id, name: site.name, contractSiteId: site.contractSiteId });
    }
  }

  for (const site of sites) {
    const normalized = normalizeSiteName(site.name);
    normalizedNames.set(normalized, { id: site.id, name: site.name, contractSiteId: site.contractSiteId });
  }

  return { normalizedNames, aliasMap };
}

function normalizeSiteName(name: string): string {
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
): { siteId?: string; siteName?: string; contractSiteId?: string } {
  const normalized = normalizeSiteName(installationName);

  // 1. Try alias match
  const aliasMatch = matchers.aliasMap.get(normalized);
  if (aliasMatch) {
    return { siteId: aliasMatch.id, siteName: aliasMatch.name, contractSiteId: aliasMatch.contractSiteId };
  }

  // 2. Try exact match
  const exact = matchers.normalizedNames.get(normalized);
  if (exact) {
    return { siteId: exact.id, siteName: exact.name, contractSiteId: exact.contractSiteId };
  }

  // 3. Try partial match
  for (const [siteName, site] of matchers.normalizedNames) {
    if (normalized.includes(siteName) || siteName.includes(normalized)) {
      return { siteId: site.id, siteName: site.name, contractSiteId: site.contractSiteId };
    }
  }

  // 4. Try fuzzy match
  let bestMatch: { site: typeof matchers.normalizedNames extends Map<string, infer V> ? V : never; score: number } | null = null;
  for (const [siteName, site] of matchers.normalizedNames) {
    const score = similarity(normalized, siteName);
    if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { site, score };
    }
  }

  if (bestMatch) {
    return { siteId: bestMatch.site.id, siteName: bestMatch.site.name, contractSiteId: bestMatch.site.contractSiteId };
  }

  return {};
}
