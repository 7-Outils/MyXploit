import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/sites/[id]/tickets - Tickets du site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: siteId } = await params;

    // Vérifier que le site appartient à l'organisation
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const tickets = await prisma.ticket.findMany({
      where: { siteId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        source: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des tickets" }, { status: 500 });
  }
}
