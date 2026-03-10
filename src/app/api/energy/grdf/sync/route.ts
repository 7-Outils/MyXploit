import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  getGRDFConsosPubliees,
  getGRDFDroitsAcces,
} from "@/lib/grdf";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";

// POST /api/energy/grdf/sync - Sync GRDF consumptions for all sites with PCE
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour synchroniser GRDF" },
        { status: 403 }
      );
    }

    // Get GRDF provider + fresh token
    const grdf = await getGRDFProviderAndToken(effectiveOrgId);

    if (!grdf) {
      return NextResponse.json(
        { error: "GRDF non connecté. Veuillez configurer vos identifiants." },
        { status: 400 }
      );
    }

    const { accessToken, environment } = grdf;

    // Get all sites with PCE
    const sites = await prisma.site.findMany({
      where: {
        organizationId: effectiveOrgId,
        pce: { not: null },
      },
      select: {
        id: true,
        name: true,
        pce: true,
      },
    });

    if (sites.length === 0) {
      return NextResponse.json(
        { error: "Aucun site avec un PCE configuré" },
        { status: 400 }
      );
    }

    // Optionally verify droits d'accès
    let droitsAcces: string[] = [];
    try {
      const droits = await getGRDFDroitsAcces(accessToken, environment);
      droitsAcces = droits
        .filter((d) => d.etat_droit_acces === "Active")
        .map((d) => d.id_pce);
    } catch {
      // Continue without verification
    }

    // Parse optional date range from body
    const body = await request.json().catch(() => ({}));
    const defaultDateFin = new Date().toISOString().split("T")[0];
    const defaultDateDebut = (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 3);
      return d.toISOString().split("T")[0];
    })();
    const dateFin = body.endDate || defaultDateFin;
    const dateDebut = body.startDate || defaultDateDebut;

    // Build a map of PCE → droit d'accès for date range fallback
    const droitsMap = new Map<string, { debut: string; fin: string }>();
    try {
      const allDroits = await getGRDFDroitsAcces(accessToken, environment);
      for (const d of allDroits) {
        if (d.etat_droit_acces === "Active" && d.perim_donnees_conso_debut && d.perim_donnees_conso_fin) {
          droitsMap.set(d.id_pce, {
            debut: d.perim_donnees_conso_debut,
            fin: d.perim_donnees_conso_fin,
          });
        }
      }
    } catch {
      // Continue with default dates
    }

    // Sync each site
    const results: Array<{
      siteId: string;
      siteName: string;
      pce: string;
      success: boolean;
      imported: number;
      error?: string;
    }> = [];

    for (const site of sites) {
      const pce = site.pce!;

      // Check if we have an active droit d'accès for this PCE
      if (droitsAcces.length > 0 && !droitsAcces.includes(pce)) {
        results.push({
          siteId: site.id,
          siteName: site.name,
          pce,
          success: false,
          imported: 0,
          error: "Pas de droit d'accès actif pour ce PCE",
        });
        continue;
      }

      try {
        // Determine date range from droit d'accès or defaults
        const droitDates = droitsMap.get(pce);
        const effectiveDateDebut = droitDates?.debut || dateDebut;
        const effectiveDateFin = droitDates?.fin || dateFin;

        // Fetch consos for each year in the range (GRDF supports "periode" param = year)
        const startYear = parseInt(effectiveDateDebut.substring(0, 4));
        const endYear = parseInt(effectiveDateFin.substring(0, 4));

        let allConsumptions: Awaited<ReturnType<typeof getGRDFConsosPubliees>> = [];
        for (let year = startYear; year <= endYear; year++) {
          try {
            const yearConsos = await getGRDFConsosPubliees(
              pce,
              accessToken,
              { periode: String(year) },
              environment
            );
            allConsumptions = allConsumptions.concat(yearConsos);
          } catch {
            // Some years may have no data, continue
          }
        }
        const consumptions = allConsumptions;

        let imported = 0;

        for (const conso of consumptions) {
          // Extract from nested GRDF response structure
          const consoData = conso.consommation;
          if (!consoData?.date_debut_consommation) continue;

          // Parse date to get the period (first day of month)
          const period = new Date(consoData.date_debut_consommation);
          period.setDate(1);

          // Use energie (kWh) if available, otherwise convert volume_brut * coeff_conversion
          const coeffConversion = consoData.coeff_calcul?.coeff_conversion || 11.2;
          const quantityKwh = consoData.energie || (consoData.volume_brut || 0) * coeffConversion;

          // Upsert consumption
          await prisma.consumption.upsert({
            where: {
              siteId_energyType_usage_period: {
                siteId: site.id,
                energyType: "GAZ",
                usage: "CHAUFFAGE",
                period: period,
              },
            },
            update: {
              quantity: quantityKwh,
              unit: "kWh",
              updatedAt: new Date(),
            },
            create: {
              siteId: site.id,
              organizationId: effectiveOrgId,
              energyType: "GAZ",
              usage: "CHAUFFAGE",
              period: period,
              quantity: quantityKwh,
              unit: "kWh",
            },
          });

          imported++;
        }

        results.push({
          siteId: site.id,
          siteName: site.name,
          pce,
          success: true,
          imported,
        });
      } catch (error) {
        results.push({
          siteId: site.id,
          siteName: site.name,
          pce,
          success: false,
          imported: 0,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    // Update provider last sync
    await prisma.energyProvider.update({
      where: { id: grdf.provider.id },
      data: {
        lastSyncAt: new Date(),
        lastError: results.some((r) => !r.success)
          ? `Erreurs sur ${results.filter((r) => !r.success).length} site(s)`
          : null,
      },
    });

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Synchronisation terminée: ${totalImported} relevés importés`,
      environment,
      sites: {
        total: sites.length,
        success: successCount,
        failed: sites.length - successCount,
      },
      results,
    });
  } catch (error) {
    console.error("Error syncing GRDF:", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation GRDF" },
      { status: 500 }
    );
  }
}
