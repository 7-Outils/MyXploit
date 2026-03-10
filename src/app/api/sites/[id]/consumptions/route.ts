import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/sites/[id]/consumptions - Consommations du site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: siteId } = await params;

    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "24");

    const consumptions = await prisma.consumption.findMany({
      where: { siteId },
      select: {
        id: true,
        period: true,
        quantity: true,
        unit: true,
        energyType: true,
        usage: true,
        cost: true,
      },
      orderBy: { period: "desc" },
      take: limit,
    });

    return NextResponse.json({ consumptions });
  } catch (error) {
    console.error("Error fetching consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des consommations" },
      { status: 500 }
    );
  }
}
