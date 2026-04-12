import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/heating-periods?contractId=... - List all heating periods for a contract
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");

    if (!contractId) {
      return NextResponse.json({ error: "contractId requis" }, { status: 400 });
    }

    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      select: { siteId: true },
    });
    const siteIds = contractSites.map((cs) => cs.siteId);

    const periods = await prisma.heatingPeriod.findMany({
      where: {
        siteId: { in: siteIds },
        site: { organizationId: effectiveOrgId },
      },
      include: { site: { select: { id: true, name: true } } },
      orderBy: [{ siteId: "asc" }, { startDate: "desc" }],
    });

    return NextResponse.json(periods);
  } catch (error) {
    console.error("Error fetching heating periods:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/heating-periods - Create a heating period (allumage/arrêt)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();
    const { siteId, startDate, endDate, notes } = body;

    if (!siteId || !startDate) {
      return NextResponse.json({ error: "siteId et startDate requis" }, { status: 400 });
    }

    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
    });
    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const period = await prisma.heatingPeriod.create({
      data: {
        siteId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json(period, { status: 201 });
  } catch (error) {
    console.error("Error creating heating period:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
