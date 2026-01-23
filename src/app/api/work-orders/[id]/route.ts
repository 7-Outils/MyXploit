import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { canChangeStatus, validateWorkOrderData } from "@/lib/work-order-validation";

/**
 * GET /api/work-orders/[id]
 * Récupère les détails d'un WorkOrder spécifique
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        quote: {
          organizationId: effectiveOrgId,
        },
      },
      include: {
        quote: {
          include: {
            site: true,
            contract: true,
          },
        },
        attachements: {
          orderBy: {
            uploadedAt: "desc",
          },
        },
        reservations: {
          orderBy: {
            detectedAt: "desc",
          },
        },
        levees: {
          orderBy: {
            leveeDate: "desc",
          },
          include: {
            meeting: true,
            technicalAudit: true,
          },
        },
        events: {
          orderBy: {
            performedAt: "desc",
          },
          take: 50, // Limiter l'historique aux 50 derniers événements
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "WorkOrder introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workOrder });
  } catch (error) {
    console.error("GET /api/work-orders/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du WorkOrder" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/work-orders/[id]
 * Met à jour un WorkOrder (statut, dates, notes)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls EDITOR, ADMIN et SUPER_ADMIN peuvent modifier
    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permission refusée" },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    const body = await request.json();
    const {
      status: newStatus,
      planifiedDate,
      startDate,
      completionDate,
      internalNotes,
    } = body;

    // Vérifier que le WorkOrder existe et appartient à l'organisation
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        quote: {
          organizationId: effectiveOrgId,
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "WorkOrder introuvable" },
        { status: 404 }
      );
    }

    // Valider le changement de statut si demandé
    if (newStatus && newStatus !== workOrder.status) {
      const statusValidation = canChangeStatus(workOrder.status, newStatus);
      if (!statusValidation.canClose) {
        return NextResponse.json(
          { error: statusValidation.reasons.join(", ") },
          { status: 400 }
        );
      }
    }

    // Valider les dates
    const dateValidation = await validateWorkOrderData({
      planifiedDate: planifiedDate ? new Date(planifiedDate) : workOrder.planifiedDate,
      startDate: startDate ? new Date(startDate) : workOrder.startDate,
      completionDate: completionDate ? new Date(completionDate) : workOrder.completionDate,
    });

    if (!dateValidation.canClose) {
      return NextResponse.json(
        { error: dateValidation.reasons.join(", ") },
        { status: 400 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (newStatus !== undefined) updateData.status = newStatus;
    if (planifiedDate !== undefined)
      updateData.planifiedDate = planifiedDate ? new Date(planifiedDate) : null;
    if (startDate !== undefined)
      updateData.startDate = startDate ? new Date(startDate) : null;
    if (completionDate !== undefined)
      updateData.completionDate = completionDate ? new Date(completionDate) : null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    // Mettre à jour le WorkOrder
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        quote: {
          include: {
            site: true,
          },
        },
        attachements: true,
        reservations: true,
      },
    });

    // Créer un événement si le statut a changé
    if (newStatus && newStatus !== workOrder.status) {
      await prisma.workEvent.create({
        data: {
          workOrderId: id,
          eventType: "STATUS_CHANGE",
          oldValue: workOrder.status,
          newValue: newStatus,
          performedBy: user.id,
          notes: `Changement de statut: ${workOrder.status} → ${newStatus}`,
        },
      });
    }

    return NextResponse.json({ workOrder: updatedWorkOrder });
  } catch (error) {
    console.error("PUT /api/work-orders/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du WorkOrder" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-orders/[id]
 * Supprime un WorkOrder (ADMIN uniquement)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls ADMIN et SUPER_ADMIN peuvent supprimer
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Permission refusée. Seuls les ADMIN peuvent supprimer des WorkOrders." },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    // Vérifier que le WorkOrder existe et appartient à l'organisation
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        quote: {
          organizationId: effectiveOrgId,
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "WorkOrder introuvable" },
        { status: 404 }
      );
    }

    // Ne pas permettre la suppression si le WorkOrder est clôturé
    if (workOrder.status === "CLOTURE") {
      return NextResponse.json(
        { error: "Impossible de supprimer un WorkOrder clôturé" },
        { status: 400 }
      );
    }

    // Supprimer le WorkOrder (cascade supprimera attachements, réserves, levées, events)
    await prisma.workOrder.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "WorkOrder supprimé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/work-orders/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du WorkOrder" },
      { status: 500 }
    );
  }
}
