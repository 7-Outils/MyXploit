import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  estimateG,
  calculateRealG,
  comparerG,
  estimatePowerAndConsumption,
} from "@/lib/thermal-profile";

/**
 * GET /api/sites/[id]/thermal-profile
 * Calcule le profil thermique complet d'un site :
 * - G estimé (depuis caractéristiques bâtiment)
 * - G réel (depuis consommations + DJU)
 * - Diagnostic comparatif
 * - Estimations de puissance et consommation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id } = await params;

    // Récupérer le site avec ses données
    const site = await prisma.site.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        occupationZones: true,
        contractSites: {
          select: {
            rendementChaudiere: true,
          },
        },
        heatingSeasons: {
          orderBy: { season: "desc" },
          take: 3, // 3 dernières saisons
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // ========== G ESTIMÉ ==========
    const gEstimation = estimateG({
      insulationLevel: site.insulationLevel as any,
      constructionYear: site.constructionYear,
      glazingType: site.glazingType as any,
      ventilationType: site.ventilationType as any,
      siteType: site.type as any,
    });

    // ========== VOLUME CHAUFFÉ ==========
    const volumeChauffee =
      site.volumeChauffee ||
      (site.surfaceChauffee && site.buildingHeight
        ? site.surfaceChauffee * site.buildingHeight
        : null);

    // ========== G RÉEL (par saison) ==========
    const rendement =
      site.contractSites[0]?.rendementChaudiere || 0.9;
    const djuContractuel = site.djuContractuel || 0;

    const gReelBySeason = [];

    for (const season of site.heatingSeasons) {
      // Récupérer les consommations chauffage de la saison
      const [startYear] = season.season.split("-").map(Number);
      const seasonStart = new Date(startYear, 9, 1); // 1er octobre
      const seasonEnd = new Date(startYear + 1, 4, 30); // 31 mai

      const consumptions = await prisma.consumption.findMany({
        where: {
          siteId: id,
          energyType: site.energyType,
          usage: { in: ["CHAUFFAGE", "MIXTE"] },
          period: {
            gte: seasonStart,
            lte: seasonEnd,
          },
        },
      });

      if (consumptions.length === 0 || !volumeChauffee) continue;

      // Sommer les consommations et DJU
      const totalKwh = consumptions.reduce((sum, c) => {
        // Pour MIXTE, utiliser quantityChauffage si dispo, sinon quantity
        const qty = c.quantityChauffage || c.quantity;
        // Convertir en kWh si nécessaire
        return sum + (c.unit === "MWh" ? qty * 1000 : qty);
      }, 0);

      const totalDjuReel = consumptions.reduce(
        (sum, c) => sum + (c.djuReel || 0),
        0
      );

      if (totalDjuReel <= 0 || totalKwh <= 0) continue;

      const gReal = calculateRealG({
        heatingConsumptionKwh: totalKwh,
        heatedVolume: volumeChauffee,
        djuReal: totalDjuReel,
        boilerEfficiency: rendement,
      });

      gReelBySeason.push({
        season: season.season,
        ...gReal,
        consumptionKwh: Math.round(totalKwh),
        djuReal: Math.round(totalDjuReel),
      });
    }

    // Prendre le G réel le plus récent avec fiabilité suffisante
    const bestGReal =
      gReelBySeason.find((g) => g.reliability !== "LOW") ||
      gReelBySeason[0] ||
      null;

    // ========== DIAGNOSTIC ==========
    const diagnostic = bestGReal
      ? comparerG(gEstimation.gTypical, bestGReal.value)
      : null;

    // ========== ESTIMATIONS ==========
    const estimations =
      volumeChauffee && djuContractuel
        ? {
            fromEstimated: estimatePowerAndConsumption(
              gEstimation.gTypical,
              volumeChauffee,
              djuContractuel,
              -7,
              19,
              rendement
            ),
            fromReal: bestGReal
              ? estimatePowerAndConsumption(
                  bestGReal.value,
                  volumeChauffee,
                  djuContractuel,
                  -7,
                  19,
                  rendement
                )
              : null,
          }
        : null;

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        type: site.type,
        constructionYear: site.constructionYear,
        surfaceChauffee: site.surfaceChauffee,
        volumeChauffee,
        insulationLevel: site.insulationLevel,
        glazingType: site.glazingType,
        ventilationType: site.ventilationType,
        buildingHeight: site.buildingHeight,
        numberOfFloors: site.numberOfFloors,
        djuContractuel,
        rendement,
      },
      gEstimation,
      gReelBySeason,
      bestGReal,
      diagnostic,
      estimations,
      occupationZones: site.occupationZones,
    });
  } catch (error) {
    console.error("GET /api/sites/[id]/thermal-profile error:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul du profil thermique" },
      { status: 500 }
    );
  }
}
