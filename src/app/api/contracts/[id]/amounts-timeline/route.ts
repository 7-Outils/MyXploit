import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

type PType = "P1" | "P2" | "P3";
const P_TYPES: PType[] = ["P1", "P2", "P3"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const startYear = new Date(contract.startDate).getFullYear();
    const endYear = new Date(contract.endDate).getFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: {
        site: { select: { id: true, name: true, city: true } },
        priceChanges: {
          orderBy: { effectiveDate: "asc" },
        },
      },
      orderBy: { site: { name: "asc" } },
    });

    const totalsByP: Record<PType, Record<number, number>> = { P1: {}, P2: {}, P3: {} };
    for (const p of P_TYPES) for (const y of years) totalsByP[p][y] = 0;

    const sites = contractSites.map((cs) => {
      const baseByP: Record<PType, number | null> = {
        P1: cs.amountP1Base ?? cs.amountP1 ?? null,
        P2: cs.amountP2Base ?? cs.amountP2 ?? null,
        P3: cs.amountP3Base ?? cs.amountP3 ?? null,
      };

      const amountsByP: Record<PType, Record<number, number | null>> = { P1: {}, P2: {}, P3: {} };

      for (const p of P_TYPES) {
        const field = `amount${p}` as "amountP1" | "amountP2" | "amountP3";
        const base = baseByP[p];

        for (const year of years) {
          const cutoff = new Date(year, 0, 1);
          // Dernier price change avec effectiveDate <= Jan 1 de l'année et amount<p> non null
          let applicable: number | null = null;
          for (const pc of cs.priceChanges) {
            if (pc.effectiveDate <= cutoff && pc[field] != null) {
              applicable = pc[field] as number;
            }
          }
          const value = applicable ?? base;
          amountsByP[p][year] = value;
          if (value != null) totalsByP[p][year] += value;
        }
      }

      return {
        contractSiteId: cs.id,
        siteId: cs.site.id,
        siteName: cs.site.name,
        siteCity: cs.site.city,
        baseByP,
        amountsByP,
      };
    });

    return NextResponse.json({
      startYear,
      endYear,
      years,
      sites,
      totalsByP,
    });
  } catch (error) {
    console.error("Error fetching amounts timeline:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
