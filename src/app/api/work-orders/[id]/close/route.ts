import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * POST /api/work-orders/[id]/close
 * Clôture un WorkOrder (travaux terminés)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const workOrder = await prisma.workOrder.findFirst({
      where: { id, quote: { organizationId: effectiveOrgId } },
      include: { quote: { select: { reference: true, amountHT: true, siteId: true } } },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "WorkOrder introuvable" }, { status: 404 });
    }

    if (workOrder.status === "CLOTURE") {
      return NextResponse.json({ error: "Déjà clôturé" }, { status: 400 });
    }

    await prisma.workOrder.update({
      where: { id },
      data: {
        status: "CLOTURE",
        closedAt: new Date(),
        closedBy: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/work-orders/[id]/close error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
