import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { EnergyType, EnergyUsage } from "@/generated/prisma/client";

// POST /api/consumptions/import - Import consumptions from CSV
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer des données" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { data, mapping, options } = body;

    // data: array of rows from CSV
    // mapping: { site: "colName", period: "colName", quantity: "colName", ... }
    // options: { energyType: "GAZ", usage: "MIXTE", ... }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée à importer" },
        { status: 400 }
      );
    }

    if (!mapping || !mapping.site || !mapping.period || !mapping.quantity) {
      return NextResponse.json(
        { error: "Le mapping doit inclure au moins: site, period, quantity" },
        { status: 400 }
      );
    }

    // Get all sites for matching
    const sites = await prisma.site.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, pce: true, pdl: true },
    });

    // Create lookup maps
    const siteByName = new Map<string, string>();
    const siteByPce = new Map<string, string>();
    const siteByPdl = new Map<string, string>();

    sites.forEach((site) => {
      // Normalize name for matching
      const normalizedName = site.name.toLowerCase().trim();
      siteByName.set(normalizedName, site.id);

      // Also try without common prefixes
      const withoutPrefix = normalizedName
        .replace(/^(lycée|collège|école|mairie|gymnase|piscine)\s+/i, "")
        .trim();
      if (withoutPrefix !== normalizedName) {
        siteByName.set(withoutPrefix, site.id);
      }

      if (site.pce) siteByPce.set(site.pce, site.id);
      if (site.pdl) siteByPdl.set(site.pdl, site.id);
    });

    const results = {
      imported: 0,
      updated: 0,
      errors: [] as { row: number; site: string; error: string }[],
    };

    const defaultEnergyType = (options?.energyType || "GAZ") as EnergyType;
    const defaultUsage = (options?.usage || "MIXTE") as EnergyUsage;
    const defaultUnit = options?.unit || "kWh";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      try {
        // Extract values using mapping
        const siteValue = row[mapping.site]?.toString().trim();
        const periodValue = row[mapping.period]?.toString().trim();
        const quantityValue = row[mapping.quantity];

        if (!siteValue || !periodValue || quantityValue === undefined) {
          results.errors.push({
            row: rowNum,
            site: siteValue || "?",
            error: "Valeurs manquantes (site, période ou quantité)",
          });
          continue;
        }

        // Find site
        let siteId: string | undefined;

        // Try by PCE/PDL first (most reliable)
        if (mapping.pce && row[mapping.pce]) {
          siteId = siteByPce.get(row[mapping.pce].toString().trim());
        }
        if (!siteId && mapping.pdl && row[mapping.pdl]) {
          siteId = siteByPdl.get(row[mapping.pdl].toString().trim());
        }

        // Then try by name
        if (!siteId) {
          const normalizedSite = siteValue.toLowerCase().trim();
          siteId = siteByName.get(normalizedSite);

          // Try partial match if not found
          if (!siteId) {
            for (const [name, id] of siteByName) {
              if (name.includes(normalizedSite) || normalizedSite.includes(name)) {
                siteId = id;
                break;
              }
            }
          }
        }

        if (!siteId) {
          results.errors.push({
            row: rowNum,
            site: siteValue,
            error: "Site non trouvé",
          });
          continue;
        }

        // Parse period (support various formats)
        let period: Date;
        try {
          period = parsePeriod(periodValue);
        } catch {
          results.errors.push({
            row: rowNum,
            site: siteValue,
            error: `Format de période invalide: ${periodValue}`,
          });
          continue;
        }

        // Parse quantity
        const quantity = parseFloat(
          quantityValue.toString().replace(/\s/g, "").replace(",", ".")
        );
        if (isNaN(quantity)) {
          results.errors.push({
            row: rowNum,
            site: siteValue,
            error: `Quantité invalide: ${quantityValue}`,
          });
          continue;
        }

        // Optional fields
        const cost = mapping.cost && row[mapping.cost]
          ? parseFloat(row[mapping.cost].toString().replace(/\s/g, "").replace(",", "."))
          : null;

        const djuReel = mapping.dju && row[mapping.dju]
          ? parseFloat(row[mapping.dju].toString().replace(/\s/g, "").replace(",", "."))
          : null;

        const energyType = mapping.energyType && row[mapping.energyType]
          ? mapEnergyType(row[mapping.energyType].toString())
          : defaultEnergyType;

        const usage = mapping.usage && row[mapping.usage]
          ? mapUsage(row[mapping.usage].toString())
          : defaultUsage;

        const unit = mapping.unit && row[mapping.unit]
          ? row[mapping.unit].toString()
          : defaultUnit;

        // Upsert consumption
        const existing = await prisma.consumption.findUnique({
          where: {
            siteId_energyType_usage_period: {
              siteId,
              energyType,
              usage,
              period,
            },
          },
        });

        if (existing) {
          await prisma.consumption.update({
            where: { id: existing.id },
            data: {
              quantity,
              unit,
              cost: cost ?? existing.cost,
              djuReel: djuReel ?? existing.djuReel,
            },
          });
          results.updated++;
        } else {
          await prisma.consumption.create({
            data: {
              siteId,
              organizationId: user.organizationId,
              energyType,
              usage,
              period,
              quantity,
              unit,
              cost,
              djuReel,
            },
          });
          results.imported++;
        }
      } catch (error) {
        console.error(`Error importing row ${rowNum}:`, error);
        results.errors.push({
          row: rowNum,
          site: row[mapping.site]?.toString() || "?",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: results.imported,
      updated: results.updated,
      errors: results.errors.slice(0, 20), // Limit errors returned
      totalErrors: results.errors.length,
    });
  } catch (error) {
    console.error("Error importing consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des consommations" },
      { status: 500 }
    );
  }
}

// Helper: parse period string to Date (first day of month)
function parsePeriod(value: string): Date {
  // Try various formats

  // MM/YYYY or MM-YYYY
  let match = value.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1);
  }

  // YYYY/MM or YYYY-MM
  match = value.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
  }

  // DD/MM/YYYY (take month)
  match = value.match(/^\d{1,2}[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1);
  }

  // French month names: "janvier 2024", "janv. 2024"
  const frenchMonths: Record<string, number> = {
    janvier: 0, janv: 0, jan: 0,
    février: 1, fevrier: 1, fév: 1, fev: 1,
    mars: 2, mar: 2,
    avril: 3, avr: 3,
    mai: 4,
    juin: 5, jun: 5,
    juillet: 6, juil: 6, jul: 6,
    août: 7, aout: 7, aou: 7,
    septembre: 8, sept: 8, sep: 8,
    octobre: 9, oct: 9,
    novembre: 10, nov: 10,
    décembre: 11, decembre: 11, déc: 11, dec: 11,
  };

  match = value.toLowerCase().match(/([a-zéûô]+)\.?\s*(\d{4})/);
  if (match) {
    const monthNum = frenchMonths[match[1]];
    if (monthNum !== undefined) {
      return new Date(parseInt(match[2]), monthNum, 1);
    }
  }

  // Try native parsing as last resort
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }

  throw new Error(`Format de période non reconnu: ${value}`);
}

// Helper: map energy type string to enum
function mapEnergyType(value: string): EnergyType {
  const normalized = value.toUpperCase().trim();

  const mappings: Record<string, EnergyType> = {
    GAZ: "GAZ",
    NATUREL: "GAZ",
    "GAZ NATUREL": "GAZ",
    ELECTRICITE: "ELECTRICITE",
    ÉLECTRICITÉ: "ELECTRICITE",
    ELEC: "ELECTRICITE",
    FIOUL: "FIOUL",
    FUEL: "FIOUL",
    BOIS: "BOIS",
    GRANULES: "BOIS",
    PELLETS: "BOIS",
    RCU: "RESEAU_CHALEUR",
    "RESEAU CHALEUR": "RESEAU_CHALEUR",
    "RÉSEAU CHALEUR": "RESEAU_CHALEUR",
    CHALEUR: "RESEAU_CHALEUR",
    EAU: "EAU",
    AUTRE: "AUTRE",
  };

  return mappings[normalized] || "AUTRE";
}

// Helper: map usage string to enum
function mapUsage(value: string): EnergyUsage {
  const normalized = value.toUpperCase().trim();

  const mappings: Record<string, EnergyUsage> = {
    CHAUFFAGE: "CHAUFFAGE",
    CHAUF: "CHAUFFAGE",
    CH: "CHAUFFAGE",
    ECS: "ECS",
    "EAU CHAUDE": "ECS",
    SANITAIRE: "ECS",
    MIXTE: "MIXTE",
    "CHAUF+ECS": "MIXTE",
    GLOBAL: "MIXTE",
    TOTAL: "MIXTE",
    AUTRE: "AUTRE",
  };

  return mappings[normalized] || "MIXTE";
}
