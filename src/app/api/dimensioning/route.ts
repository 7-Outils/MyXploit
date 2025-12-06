import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  calculateMarketDimensioning,
  EquipmentForPricing,
} from "@/lib/pricing/equipment-pricing";

// GET /api/dimensioning - Calculate market dimensioning for a contract or sites
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const contractId = searchParams.get("contractId");
    const siteIds = searchParams.get("siteIds")?.split(",").filter(Boolean);
    const duration = parseInt(searchParams.get("duration") || "8"); // Durée du marché en années
    const startYear = parseInt(searchParams.get("startYear") || new Date().getFullYear().toString());

    // Build query to get equipments
    let equipments;

    if (contractId) {
      // Get equipments from all sites in the contract
      const contract = await prisma.contract.findFirst({
        where: {
          id: contractId,
          organizationId: user.organizationId,
        },
        include: {
          contractSites: {
            include: {
              site: {
                include: {
                  equipments: {
                    include: {
                      audits: {
                        orderBy: { auditDate: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!contract) {
        return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
      }

      equipments = contract.contractSites.flatMap((cs) =>
        cs.site.equipments.map((eq) => ({
          ...eq,
          siteName: cs.site.name,
          siteId: cs.site.id,
        }))
      );
    } else if (siteIds && siteIds.length > 0) {
      // Get equipments from specified sites
      const sites = await prisma.site.findMany({
        where: {
          id: { in: siteIds },
          organizationId: user.organizationId,
        },
        include: {
          equipments: {
            include: {
              audits: {
                orderBy: { auditDate: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      equipments = sites.flatMap((site) =>
        site.equipments.map((eq) => ({
          ...eq,
          siteName: site.name,
          siteId: site.id,
        }))
      );
    } else {
      // Get all equipments from organization
      equipments = await prisma.equipment.findMany({
        where: { organizationId: user.organizationId },
        include: {
          site: { select: { id: true, name: true } },
          audits: {
            orderBy: { auditDate: "desc" },
            take: 1,
          },
        },
      });

      equipments = equipments.map((eq) => ({
        ...eq,
        siteName: eq.site.name,
        siteId: eq.site.id,
      }));
    }

    // Transform to EquipmentForPricing
    const equipmentsForPricing: (EquipmentForPricing & { siteName: string; siteId: string })[] = equipments.map((eq) => {
      const latestAudit = eq.audits?.[0];

      return {
        id: eq.id,
        type: eq.type,
        domain: eq.domain,
        power: eq.power,
        quantity: eq.quantity,
        year: eq.year,
        installDate: eq.installDate,
        theoreticalLifespan: eq.theoreticalLifespan,
        status: eq.status,
        auditRating: latestAudit?.visualState || undefined,
        auditVisualState: latestAudit?.visualState || undefined,
        auditPerformance: latestAudit?.performance || undefined,
        siteName: eq.siteName,
        siteId: eq.siteId,
      };
    });

    // Calculate dimensioning
    const dimensioning = calculateMarketDimensioning(
      equipmentsForPricing,
      duration,
      startYear
    );

    // Group by site for better display
    const bySite = new Map<string, {
      siteId: string;
      siteName: string;
      equipmentCount: number;
      p2Annual: number;
      p3GEAnnual: number;
      p3RAnnual: number;
      hoursP2: number;
      renewalsCount: number;
    }>();

    for (const eq of equipmentsForPricing) {
      const existing = bySite.get(eq.siteId) || {
        siteId: eq.siteId,
        siteName: eq.siteName,
        equipmentCount: 0,
        p2Annual: 0,
        p3GEAnnual: 0,
        p3RAnnual: 0,
        hoursP2: 0,
        renewalsCount: 0,
      };

      existing.equipmentCount++;

      const p2 = dimensioning.p2Details.find((p) => p.equipmentId === eq.id);
      const p3GE = dimensioning.p3GEDetails.find((p) => p.equipmentId === eq.id);
      const p3R = dimensioning.p3RDetails.find((p) => p.equipmentId === eq.id);

      if (p2) {
        existing.p2Annual += p2.annualCost;
        existing.hoursP2 += p2.hoursPerYear;
      }
      if (p3GE) existing.p3GEAnnual += p3GE.annualCost;
      if (p3R) {
        existing.p3RAnnual += p3R.annualProvision;
        if (p3R.renewalNeeded) existing.renewalsCount++;
      }

      bySite.set(eq.siteId, existing);
    }

    return NextResponse.json({
      params: {
        contractId,
        siteIds,
        duration,
        startYear,
      },
      summary: {
        equipmentCount: equipmentsForPricing.length,
        siteCount: bySite.size,
        totalP2Annual: dimensioning.totalP2Annual,
        totalP3GEAnnual: dimensioning.totalP3GEAnnual,
        totalP3RAnnual: dimensioning.totalP3RAnnual,
        totalP3Annual: dimensioning.totalP3Annual,
        totalAnnual: dimensioning.totalAnnual,
        totalHoursP2: dimensioning.totalHoursP2,
        // Sur la durée du marché
        totalP2Contract: dimensioning.totalP2Annual * duration,
        totalP3GEContract: dimensioning.totalP3GEAnnual * duration,
        totalP3RContract: dimensioning.totalP3RAnnual * duration,
        totalP3Contract: dimensioning.totalP3Annual * duration,
        totalContract: dimensioning.totalAnnual * duration,
        // Renouvellements
        renewalsCount: dimensioning.renewalsNeeded.length,
        mandatoryWorksCount: dimensioning.mandatoryWorks.length,
        totalRenewalCost: dimensioning.renewalsNeeded.reduce((sum, r) => sum + r.estimate.replacementCost, 0),
        totalMandatoryWorksCost: dimensioning.mandatoryWorks.reduce((sum, r) => sum + r.estimate.replacementCost, 0),
      },
      bySite: Array.from(bySite.values()),
      renewals: dimensioning.renewalsNeeded.map((r) => ({
        ...r.estimate,
        equipmentType: r.equipment.type,
        siteName: (r.equipment as typeof equipmentsForPricing[0]).siteName,
        siteId: (r.equipment as typeof equipmentsForPricing[0]).siteId,
      })),
      mandatoryWorks: dimensioning.mandatoryWorks.map((r) => ({
        ...r.estimate,
        equipmentType: r.equipment.type,
        siteName: (r.equipment as typeof equipmentsForPricing[0]).siteName,
        siteId: (r.equipment as typeof equipmentsForPricing[0]).siteId,
      })),
      details: {
        p2: dimensioning.p2Details.map((p) => {
          const eq = equipmentsForPricing.find((e) => e.id === p.equipmentId);
          return { ...p, siteName: eq?.siteName, siteId: eq?.siteId };
        }),
        p3GE: dimensioning.p3GEDetails.map((p) => {
          const eq = equipmentsForPricing.find((e) => e.id === p.equipmentId);
          return { ...p, siteName: eq?.siteName, siteId: eq?.siteId };
        }),
        p3R: dimensioning.p3RDetails.map((p) => {
          const eq = equipmentsForPricing.find((e) => e.id === p.equipmentId);
          return { ...p, siteName: eq?.siteName, siteId: eq?.siteId };
        }),
      },
    });
  } catch (error) {
    console.error("Error calculating dimensioning:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul du dimensionnement" },
      { status: 500 }
    );
  }
}
