import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  getGRDFAccessToken,
  getGRDFConsosPubliees,
  getGRDFDroitsAcces,
  GRDFEnvironment,
} from "@/lib/grdf";

/**
 * Parse le refreshToken stocké en DB pour extraire env + credentials
 * Format: "environment|clientId|clientSecret" (nouveau)
 *      ou "clientId:clientSecret" (ancien, fallback prod)
 */
function parseCredentials(refreshToken: string): {
  environment: GRDFEnvironment;
  clientId: string;
  clientSecret: string;
} {
  if (refreshToken.includes("|")) {
    const [environment, clientId, ...rest] = refreshToken.split("|");
    return {
      environment: environment as GRDFEnvironment,
      clientId,
      clientSecret: rest.join("|"), // Le secret peut contenir |
    };
  }
  // Ancien format: clientId:clientSecret
  const [clientId, ...rest] = refreshToken.split(":");
  return {
    environment: "production",
    clientId,
    clientSecret: rest.join(":"),
  };
}

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

    // Get GRDF provider config
    const provider = await prisma.energyProvider.findUnique({
      where: {
        organizationId_provider: {
          organizationId: effectiveOrgId,
          provider: "GRDF",
        },
      },
    });

    if (!provider || !provider.isConnected || !provider.refreshToken) {
      return NextResponse.json(
        { error: "GRDF non connecté. Veuillez configurer vos identifiants." },
        { status: 400 }
      );
    }

    const { environment, clientId, clientSecret } = parseCredentials(provider.refreshToken);

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Identifiants GRDF invalides" },
        { status: 400 }
      );
    }

    // Get fresh token
    let accessToken: string;
    try {
      const tokenResponse = await getGRDFAccessToken({
        clientId,
        clientSecret,
        environment,
      });
      accessToken = tokenResponse.access_token;

      // Update token in database
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
      await prisma.energyProvider.update({
        where: { id: provider.id },
        data: {
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: expiresAt,
        },
      });
    } catch {
      await prisma.energyProvider.update({
        where: { id: provider.id },
        data: {
          isConnected: false,
          lastError: "Échec de l'authentification GRDF",
        },
      });
      return NextResponse.json(
        { error: "Échec de l'authentification GRDF" },
        { status: 401 }
      );
    }

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
    const dateFin = body.endDate || new Date().toISOString().split("T")[0];
    const dateDebut = body.startDate || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split("T")[0];
    })();

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
        const consumptions = await getGRDFConsosPubliees(
          pce,
          accessToken,
          { dateDebut, dateFin },
          environment
        );

        let imported = 0;

        for (const conso of consumptions) {
          // Parse date to get the period (first day of month)
          const period = new Date(conso.date_debut_consommation);
          period.setDate(1);

          // Use energie (kWh) if available, otherwise convert m³ * 11.2
          const quantityKwh = conso.energie || conso.consommation * 11.2;

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
      where: { id: provider.id },
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
