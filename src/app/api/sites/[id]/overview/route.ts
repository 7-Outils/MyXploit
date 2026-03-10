import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/sites/[id]/overview - Get overview stats for a site dashboard
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    // Verify site belongs to user's organization
    const site = await prisma.site.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Run all queries in parallel
    const [
      consumptionTotal,
      lastConsumption,
      openTickets,
      inProgressTickets,
      totalTickets,
      equipmentCount,
      alertCount,
    ] = await Promise.all([
      prisma.consumption.count({ where: { siteId: id } }),
      prisma.consumption.findFirst({
        where: { siteId: id },
        orderBy: { period: "desc" },
        select: { quantity: true },
      }),
      prisma.ticket.count({ where: { siteId: id, status: "OPEN" } }),
      prisma.ticket.count({ where: { siteId: id, status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { siteId: id } }),
      prisma.equipment.count({ where: { siteId: id } }),
      prisma.alert.count({ where: { siteId: id } }),
    ]);

    return NextResponse.json({
      consumptions: {
        total: consumptionTotal,
        lastMonth: lastConsumption?.quantity ?? null,
        trend: null,
      },
      tickets: {
        open: openTickets,
        inProgress: inProgressTickets,
        total: totalTickets,
      },
      equipmentCount,
      alertCount,
      contractInfo: null,
    });
  } catch (error) {
    console.error("Error fetching site overview:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'aperçu du site" },
      { status: 500 }
    );
  }
}
