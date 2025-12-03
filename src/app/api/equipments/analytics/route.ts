import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/equipments/analytics - Get renewal plan and risk matrix data
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");

    // Get sites for the contract
    let siteIds: string[] = [];
    if (contractId) {
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      siteIds = contractSites.map((cs) => cs.siteId);
    }

    // Get all equipment with year and power data
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (siteIds.length > 0) {
      where.siteId = { in: siteIds };
    }

    const equipments = await prisma.equipment.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true, city: true },
        },
        audits: {
          orderBy: { auditDate: "desc" },
          take: 1,
        },
      },
    });

    const currentYear = new Date().getFullYear();

    // Calculate age and renewal data for each equipment
    const equipmentData = equipments.map((eq) => {
      const year = eq.year || (eq.installDate ? eq.installDate.getFullYear() : null);
      const age = year ? currentYear - year : null;
      const lifespan = eq.theoreticalLifespan || 15;
      const remainingYears = age !== null ? lifespan - age : null;
      const renewalYear = remainingYears !== null && remainingYears > 0
        ? currentYear + remainingYears
        : (remainingYears !== null ? currentYear : null);
      const isOverdue = age !== null && age >= lifespan;
      const isNearEnd = age !== null && age >= lifespan - 3; // Within 3 years of end

      return {
        id: eq.id,
        name: eq.name,
        type: eq.type,
        brand: eq.brand,
        model: eq.model,
        serialNumber: eq.serialNumber,
        year,
        age,
        power: eq.power,
        theoreticalLifespan: lifespan,
        remainingYears,
        renewalYear,
        isOverdue,
        isNearEnd,
        status: eq.status,
        location: eq.location,
        level: eq.level,
        site: eq.site,
        latestAudit: eq.audits[0] || null,
      };
    });

    // Filter boilers (CHAUDIERE) for risk matrix
    const boilers = equipmentData.filter((eq) => eq.type === "CHAUDIERE");

    // Calculate weighted average age by power for boilers
    let totalPower = 0;
    let weightedAgeSum = 0;
    for (const boiler of boilers) {
      if (boiler.power && boiler.age !== null) {
        totalPower += boiler.power;
        weightedAgeSum += boiler.age * boiler.power;
      }
    }
    const weightedAverageAge = totalPower > 0 ? weightedAgeSum / totalPower : null;

    // Calculate renewal plan by year
    const renewalByYear: Record<number, typeof equipmentData> = {};
    for (const eq of equipmentData) {
      if (eq.renewalYear) {
        if (!renewalByYear[eq.renewalYear]) {
          renewalByYear[eq.renewalYear] = [];
        }
        renewalByYear[eq.renewalYear].push(eq);
      }
    }

    // Sort years and create summary
    const renewalPlan = Object.entries(renewalByYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([year, eqs]) => ({
        year: parseInt(year),
        count: eqs.length,
        totalPower: eqs.reduce((sum, eq) => sum + (eq.power || 0), 0),
        equipments: eqs,
      }));

    // Risk matrix for boilers: group by risk level
    const riskMatrix = {
      critical: boilers.filter((b) => b.isOverdue), // Age >= 20 years
      high: boilers.filter((b) => !b.isOverdue && b.isNearEnd), // 17-19 years
      medium: boilers.filter((b) => b.age !== null && b.age >= 10 && !b.isNearEnd), // 10-16 years
      low: boilers.filter((b) => b.age !== null && b.age < 10), // < 10 years
    };

    // Recommendations for maintaining weighted average age between 10-12 years
    const recommendations: string[] = [];
    if (weightedAverageAge !== null) {
      if (weightedAverageAge > 12) {
        recommendations.push(
          `L'âge moyen pondéré du parc chaudières est de ${weightedAverageAge.toFixed(1)} ans. ` +
          `Il est recommandé de planifier des remplacements pour ramener cet indicateur sous 12 ans.`
        );
      } else if (weightedAverageAge < 10) {
        recommendations.push(
          `L'âge moyen pondéré du parc chaudières est de ${weightedAverageAge.toFixed(1)} ans. ` +
          `Le parc est relativement jeune, les remplacements peuvent être étalés.`
        );
      } else {
        recommendations.push(
          `L'âge moyen pondéré du parc chaudières est de ${weightedAverageAge.toFixed(1)} ans, ` +
          `dans la plage cible de 10-12 ans.`
        );
      }
    }

    // Check for year concentration (too many replacements same year)
    for (const plan of renewalPlan) {
      const boilersThisYear = plan.equipments.filter((eq) => eq.type === "CHAUDIERE");
      if (boilersThisYear.length > 2) {
        recommendations.push(
          `Attention: ${boilersThisYear.length} chaudières prévues au remplacement en ${plan.year}. ` +
          `Envisagez d'étaler les remplacements pour limiter l'impact budgétaire.`
        );
      }
    }

    return NextResponse.json({
      summary: {
        totalEquipments: equipmentData.length,
        totalBoilers: boilers.length,
        totalPower,
        weightedAverageAge,
        overdueCount: equipmentData.filter((eq) => eq.isOverdue).length,
        nearEndCount: equipmentData.filter((eq) => eq.isNearEnd && !eq.isOverdue).length,
      },
      equipments: equipmentData,
      renewalPlan,
      riskMatrix,
      recommendations,
    });
  } catch (error) {
    console.error("Error fetching equipment analytics:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse des équipements" },
      { status: 500 }
    );
  }
}
