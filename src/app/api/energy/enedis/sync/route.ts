import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  getEnedisDailyConsumptions,
  refreshEnedisToken,
  aggregateToMonthly,
  whToKwh,
} from "@/lib/enedis";

// POST /api/energy/enedis/sync - Sync Enedis consumptions for all sites with PDL
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour synchroniser Enedis" },
        { status: 403 }
      );
    }

    // Get Enedis provider config
    const provider = await prisma.energyProvider.findUnique({
      where: {
        organizationId_provider: {
          organizationId: effectiveOrgId,
          provider: "ENEDIS",
        },
      },
    });

    if (!provider || !provider.isConnected || !provider.accessToken) {
      return NextResponse.json(
        { error: "Enedis non connecté. Veuillez vous connecter via le bouton Enedis." },
        { status: 400 }
      );
    }

    // Check if token needs refresh
    let accessToken = provider.accessToken;
    if (provider.tokenExpiresAt && provider.tokenExpiresAt < new Date()) {
      // Token expired, try to refresh
      if (!provider.refreshToken) {
        await prisma.energyProvider.update({
          where: { id: provider.id },
          data: {
            isConnected: false,
            lastError: "Token expiré, reconnexion nécessaire",
          },
        });
        return NextResponse.json(
          { error: "Token Enedis expiré. Veuillez vous reconnecter." },
          { status: 401 }
        );
      }

      try {
        const clientId = process.env.ENEDIS_CLIENT_ID;
        const clientSecret = process.env.ENEDIS_CLIENT_SECRET;
        const redirectUri = process.env.ENEDIS_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
          throw new Error("Configuration Enedis manquante");
        }

        const newToken = await refreshEnedisToken(provider.refreshToken, {
          clientId,
          clientSecret,
          redirectUri,
        });

        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + newToken.expires_in);

        await prisma.energyProvider.update({
          where: { id: provider.id },
          data: {
            accessToken: newToken.access_token,
            refreshToken: newToken.refresh_token || provider.refreshToken,
            tokenExpiresAt: expiresAt,
          },
        });

        accessToken = newToken.access_token;
      } catch (error) {
        await prisma.energyProvider.update({
          where: { id: provider.id },
          data: {
            isConnected: false,
            lastError: "Échec du rafraîchissement du token",
          },
        });
        return NextResponse.json(
          { error: "Échec du rafraîchissement du token Enedis. Veuillez vous reconnecter." },
          { status: 401 }
        );
      }
    }

    // Get all sites with PDL
    const sites = await prisma.site.findMany({
      where: {
        organizationId: effectiveOrgId,
        pdl: { not: null },
      },
      select: {
        id: true,
        name: true,
        pdl: true,
      },
    });

    if (sites.length === 0) {
      return NextResponse.json(
        { error: "Aucun site avec un PDL configuré" },
        { status: 400 }
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
      pdl: string;
      success: boolean;
      imported: number;
      error?: string;
    }> = [];

    for (const site of sites) {
      try {
        const meteringData = await getEnedisDailyConsumptions(
          site.pdl!,
          startDate,
          endDate,
          accessToken
        );

        // Aggregate daily to monthly
        const monthlyData = aggregateToMonthly(meteringData.interval_reading);

        let imported = 0;

        // Pré-charger les consommations existantes du site en un findMany
        // (évite un upsert par mois), puis séparer créations / mises à jour
        const periods = monthlyData.map((month) => new Date(month.month));
        const existingConsumptions = periods.length > 0
          ? await prisma.consumption.findMany({
              where: {
                siteId: site.id,
                energyType: "ELECTRICITE",
                usage: "CHAUFFAGE",
                source: "TELERELEVE",
                period: { in: periods },
              },
              select: { id: true, period: true },
            })
          : [];
        const existingIdByPeriod = new Map(
          existingConsumptions.map((c) => [c.period.getTime(), c.id])
        );

        const creates: {
          siteId: string;
          organizationId: string;
          energyType: "ELECTRICITE";
          usage: "CHAUFFAGE";
          period: Date;
          quantity: number;
          unit: string;
          source: "TELERELEVE";
        }[] = [];
        const updates: { id: string; quantity: number }[] = [];

        for (const month of monthlyData) {
          const period = new Date(month.month);
          const quantityKwh = whToKwh(month.value);
          const existingId = existingIdByPeriod.get(period.getTime());

          if (existingId) {
            updates.push({ id: existingId, quantity: quantityKwh });
          } else {
            creates.push({
              siteId: site.id,
              organizationId: effectiveOrgId,
              energyType: "ELECTRICITE",
              usage: "CHAUFFAGE",
              period: period,
              quantity: quantityKwh,
              unit: "kWh",
              source: "TELERELEVE",
            });
          }

          imported++;
        }

        if (creates.length > 0) {
          await prisma.consumption.createMany({ data: creates });
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          await prisma.$transaction(
            batch.map((u) =>
              prisma.consumption.update({
                where: { id: u.id },
                data: { quantity: u.quantity, unit: "kWh", updatedAt: new Date() },
              })
            )
          );
        }

        results.push({
          siteId: site.id,
          siteName: site.name,
          pdl: site.pdl!,
          success: true,
          imported,
        });
      } catch (error) {
        results.push({
          siteId: site.id,
          siteName: site.name,
          pdl: site.pdl!,
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
    console.error("Error syncing Enedis:", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation Enedis" },
      { status: 500 }
    );
  }
}
