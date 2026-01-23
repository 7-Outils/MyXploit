import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { canCloseWorkOrder } from "@/lib/work-order-validation";

/**
 * POST /api/work-orders/[id]/close
 * Clôture un WorkOrder
 *
 * Conditions requises:
 * - Status = TERMINE
 * - Au moins 1 attachement
 * - Toutes réserves résolues
 * - Permission: ADMIN ou SUPER_ADMIN uniquement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls ADMIN et SUPER_ADMIN peuvent clôturer (impact financier P3)
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Permission refusée. Seuls les ADMIN peuvent clôturer des travaux (impact sur décompte P3).",
        },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    const body = await request.json();
    const { closureNotes } = body;

    // Vérifier que le WorkOrder existe et appartient à l'organisation
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        quote: {
          organizationId: effectiveOrgId,
        },
      },
      include: {
        quote: {
          select: {
            reference: true,
            amountHT: true,
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "WorkOrder introuvable" },
        { status: 404 }
      );
    }

    // Vérifier si déjà clôturé
    if (workOrder.status === "CLOTURE") {
      return NextResponse.json(
        { error: "Ce WorkOrder est déjà clôturé" },
        { status: 400 }
      );
    }

    // Valider les conditions de clôture
    const validation = await canCloseWorkOrder(id);

    if (!validation.canClose) {
      return NextResponse.json(
        {
          error: "Impossible de clôturer ce WorkOrder",
          reasons: validation.reasons,
        },
        { status: 400 }
      );
    }

    // Clôturer le WorkOrder
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        status: "CLOTURE",
        closedAt: new Date(),
        closedBy: user.id,
      },
      include: {
        quote: {
          include: {
            site: true,
            contract: true,
          },
        },
        attachements: true,
        reservations: true,
      },
    });

    // Créer un événement de clôture dans l'historique
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "CLOSED",
        oldValue: workOrder.status,
        newValue: "CLOTURE",
        performedBy: user.id,
        notes: closureNotes || `Travaux clôturés par ${user.email}`,
      },
    });

    // TODO: Créer une alerte pour notifier l'équipe financière
    // que ce WorkOrder est maintenant compté dans le décompte P3
    try {
      await prisma.alert.create({
        data: {
          type: "AUTRE",
          priority: "MOYENNE",
          title: `Travaux clôturés: ${workOrder.quote.reference}`,
          message: `Les travaux du devis ${workOrder.quote.reference} ont été clôturés et sont maintenant comptés dans le décompte P3 (${workOrder.quote.amountHT}€ HT).`,
          organizationId: effectiveOrgId,
          siteId: updatedWorkOrder.quote.siteId,
        },
      });
    } catch (alertError) {
      console.error("Erreur création alerte:", alertError);
      // Ne pas bloquer la clôture si l'alerte échoue
    }

    return NextResponse.json({
      success: true,
      message: "WorkOrder clôturé avec succès",
      workOrder: updatedWorkOrder,
    });
  } catch (error) {
    console.error("POST /api/work-orders/[id]/close error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la clôture du WorkOrder" },
      { status: 500 }
    );
  }
}
