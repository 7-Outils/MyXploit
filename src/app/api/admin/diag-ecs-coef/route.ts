import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/diag-ecs-coef
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Retourne pour chaque site: ContractSite.coefficientQ + Meter ECS + leur
 * conversionCoefficient/Unit, pour comprendre pourquoi le qECS affiché est vide.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractSites = await prisma.contractSite.findMany({
    select: {
      siteId: true,
      coefficientQ: true,
      coefficientPCS: true,
      contract: { select: { id: true, title: true } },
      site: {
        select: {
          id: true,
          name: true,
          meters: {
            where: { fluid: { in: ["EAU_CHAUDE", "GAZ"] } },
            select: {
              id: true,
              name: true,
              fluid: true,
              unit: true,
              conversionCoefficient: true,
              conversionUnit: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    total: contractSites.length,
    sites: contractSites.map((cs) => ({
      siteName: cs.site.name,
      contract: cs.contract.title,
      contractSite: {
        coefficientQ: cs.coefficientQ,
        coefficientPCS: cs.coefficientPCS,
      },
      meters: cs.site.meters.map((m) => ({
        name: m.name,
        fluid: m.fluid,
        unit: m.unit,
        conversionCoefficient: m.conversionCoefficient,
        conversionUnit: m.conversionUnit,
      })),
    })),
  });
}
