import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getGRDFAccessToken, getGRDFMonthlyConsumptions } from "@/lib/grdf";

// POST /api/energy/grdf/sync - Sync GRDF consumptions for all sites with PCE
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

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
          organizationId: user.organizationId,
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

    // Parse credentials from refreshToken (clientId:clientSecret)
    const [clientId, clientSecret] = provider.refreshToken.split(":");
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Identifiants GRDF invalides" },
        { status: 400 }
      );
    }

    // Get all sites with PCE
    const sites = await prisma.site.findMany({
      where: {
        organizationId: user.organizationId,
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

    // Get fresh token
    let accessToken: string;
    try {
      const tokenResponse = await getGRDFAccessToken({ clientId, clientSecret });
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
    } catch (error) {
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

    // Parse optional date range from body
    const body = await request.json().catch(() => ({}));
    const endDate = body.endDate || new Date().toISOString().split("T")[0];
    const startDate = body.startDate || (() => {
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
      try {
        const consumptions = await getGRDFMonthlyConsumptions(
          site.pce!,
          startDate,
          endDate,
          accessToken
        );

        let imported = 0;

        for (const conso of consumptions) {
          // Parse date to get the period (first day of month)
          const period = new Date(conso.dateDebutConsommation);
          period.setDate(1); // First day of month

          // Convert to kWh if in m³ (gaz: 1 m³ ≈ 11.2 kWh PCS)
          const quantityKwh =
            conso.unite === "m3" || conso.unite === "m³"
              ? conso.energieConsommee * 11.2
              : conso.energieConsommee;

          // Upsert consumption
          await prisma.consumption.upsert({
            where: {
              siteId_energyType_period: {
                siteId: site.id,
                energyType: "GAZ",
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
              organizationId: user.organizationId,
              energyType: "GAZ",
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
          pce: site.pce!,
          success: true,
          imported,
        });
      } catch (error) {
        results.push({
          siteId: site.id,
          siteName: site.name,
          pce: site.pce!,
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
