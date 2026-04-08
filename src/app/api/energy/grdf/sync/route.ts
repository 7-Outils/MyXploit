import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  getGRDFConsosInformatives,
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

    // Parse optional filters from body
    const body = await request.json().catch(() => ({}));
    const filterClientId: string | undefined = body.clientId;
    const filterContractId: string | undefined = body.contractId;

    // Build site filter — restrict to a client or contract if specified
    const siteWhere: {
      organizationId: string;
      pce: { not: null };
      clientId?: string;
      contractSites?: { some: { contractId: string } };
    } = {
      organizationId: effectiveOrgId,
      pce: { not: null },
    };
    if (filterClientId) {
      siteWhere.clientId = filterClientId;
    }
    if (filterContractId) {
      siteWhere.contractSites = { some: { contractId: filterContractId } };
    }

    // Get sites matching the filter
    const sites = await prisma.site.findMany({
      where: siteWhere,
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

    // Default date range — 3 years rolling up to today
    const defaultDateFin = new Date().toISOString().split("T")[0];
    const defaultDateDebut = (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 3);
      return d.toISOString().split("T")[0];
    })();
    const dateFin = body.endDate || defaultDateFin;
    const dateDebut = body.startDate || defaultDateDebut;

    // Single call to /droits_acces — extract both the active PCE list AND
    // the per-PCE date range in one pass to avoid duplicate API requests
    // (which previously contributed to GRDF rate limiting).
    const droitsAcces: string[] = [];
    const droitsMap = new Map<string, { debut: string; fin: string }>();
    try {
      const allDroits = await getGRDFDroitsAcces(accessToken, environment);
      for (const d of allDroits) {
        if (d.etat_droit_acces !== "Active") continue;
        droitsAcces.push(d.id_pce);
        if (d.perim_donnees_conso_debut && d.perim_donnees_conso_fin) {
          droitsMap.set(d.id_pce, {
            debut: d.perim_donnees_conso_debut,
            fin: d.perim_donnees_conso_fin,
          });
        }
      }
    } catch {
      // Continue without verification (PCEs will all be queried)
    }

    // Helper: pause between API calls to respect GRDF rate limits
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Helper: call informatives with retry on 429 (rate limit)
    const fetchConsosWithRetry = async (
      pce: string,
      debut: string,
      fin: string
    ) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await getGRDFConsosInformatives(
            pce,
            accessToken,
            { dateDebut: debut, dateFin: fin },
            environment
          );
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : "";
          // Only retry on 429 (rate limit)
          if (!msg.includes("429")) throw err;
          // Exponential backoff: 3s, 6s, 12s
          await sleep(3000 * Math.pow(2, attempt));
        }
      }
      throw lastError;
    };

    // Sync each site
    const results: Array<{
      siteId: string;
      siteName: string;
      pce: string;
      success: boolean;
      imported: number;
      error?: string;
    }> = [];

    let pceCallCount = 0;
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

      // Throttle: wait 2s between PCE calls (skip the wait on the first call)
      if (pceCallCount > 0) {
        await sleep(2000);
      }
      pceCallCount++;

      try {
        // Determine date range from droit d'accès or defaults
        const droitDates = droitsMap.get(pce);
        const effectiveDateDebut = droitDates?.debut || dateDebut;
        const effectiveDateFin = droitDates?.fin || dateFin;

        // GRDF informatives endpoint accepts up to 3 years of date range in
        // a single call and returns daily readings for Gazpar meters.
        // Wrapped in retry-on-429 helper to handle GRDF rate limits gracefully.
        const consumptions = await fetchConsosWithRetry(
          pce,
          effectiveDateDebut,
          effectiveDateFin
        );

        // Cleanup existing GAZ records for this site within the synced range
        // to avoid mixing legacy monthly data with new daily data.
        await prisma.consumption.deleteMany({
          where: {
            siteId: site.id,
            energyType: "GAZ",
            period: {
              gte: new Date(effectiveDateDebut),
              lte: new Date(effectiveDateFin),
            },
          },
        });

        let imported = 0;

        for (const conso of consumptions) {
          const consoData = conso.consommation;
          if (!consoData?.date_debut_consommation) continue;

          // Daily granularity: period = exact start day (no setDate(1))
          const period = new Date(consoData.date_debut_consommation);

          // Prefer pre-calculated energie (kWh) if available
          const coeffConversion = consoData.coeff_calcul?.coeff_conversion || 11.2;
          const quantityKwh =
            consoData.energie || (consoData.volume_brut || 0) * coeffConversion;

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
