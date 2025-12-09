import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/contracts/expiring
 * Retourne les contrats arrivant à échéance dans les prochains mois
 *
 * Query params:
 * - months: nombre de mois (défaut: 12)
 * - includeExpired: inclure les contrats déjà expirés (défaut: false)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const months = parseInt(searchParams.get("months") || "12");
    const includeExpired = searchParams.get("includeExpired") === "true";

    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + months);

    // Construire les conditions de date
    const dateConditions: { gte?: Date; lte: Date } = {
      lte: futureDate,
    };

    if (!includeExpired) {
      // Seulement les contrats pas encore expirés ou expirés depuis moins de 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateConditions.gte = thirtyDaysAgo;
    }

    const contracts = await prisma.contract.findMany({
      where: {
        organizationId: user.organizationId,
        endDate: dateConditions,
        status: "ACTIF", // Seulement les contrats actifs
      },
      include: {
        contractSites: {
          include: {
            site: {
              select: {
                id: true,
                name: true,
                city: true,
                type: true,
                _count: {
                  select: { equipments: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        endDate: "asc",
      },
    });

    // Calculer les infos de renouvellement
    const contractsWithRenewalInfo = contracts.map((contract) => {
      const endDate = new Date(contract.endDate);
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const monthsUntilExpiry = Math.ceil(daysUntilExpiry / 30);

      let urgency: "EXPIRED" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (daysUntilExpiry < 0) {
        urgency = "EXPIRED";
      } else if (daysUntilExpiry <= 30) {
        urgency = "CRITICAL";
      } else if (daysUntilExpiry <= 90) {
        urgency = "HIGH";
      } else if (daysUntilExpiry <= 180) {
        urgency = "MEDIUM";
      }

      const siteCount = contract.contractSites.length;
      const equipmentCount = contract.contractSites.reduce(
        (sum: number, cs) => sum + (cs.site._count?.equipments || 0),
        0
      );

      return {
        id: contract.id,
        reference: contract.reference,
        title: contract.title,
        provider: contract.provider,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        daysUntilExpiry,
        monthsUntilExpiry,
        urgency,
        siteCount,
        equipmentCount,
        sites: contract.contractSites.map((cs) => ({
          id: cs.site.id,
          name: cs.site.name,
          city: cs.site.city,
          type: cs.site.type,
          equipmentCount: cs.site._count?.equipments || 0,
          hasP2: cs.hasP2,
          hasP3: cs.hasP3,
        })),
      };
    });

    // Stats globales
    const stats = {
      total: contractsWithRenewalInfo.length,
      expired: contractsWithRenewalInfo.filter((c) => c.urgency === "EXPIRED").length,
      critical: contractsWithRenewalInfo.filter((c) => c.urgency === "CRITICAL").length,
      high: contractsWithRenewalInfo.filter((c) => c.urgency === "HIGH").length,
      medium: contractsWithRenewalInfo.filter((c) => c.urgency === "MEDIUM").length,
      low: contractsWithRenewalInfo.filter((c) => c.urgency === "LOW").length,
    };

    return NextResponse.json({
      contracts: contractsWithRenewalInfo,
      stats,
    });
  } catch (error) {
    console.error("Error fetching expiring contracts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contrats" },
      { status: 500 }
    );
  }
}
