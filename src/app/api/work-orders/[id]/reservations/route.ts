import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * POST /api/work-orders/[id]/reservations
 * Ajoute une réserve à un WorkOrder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls EDITOR, ADMIN et SUPER_ADMIN peuvent ajouter des réserves
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

    // Ne pas permettre l'ajout de réserves si WorkOrder clôturé
    if (workOrder.status === "CLOTURE") {
      return NextResponse.json(
        { error: "Impossible d'ajouter des réserves à un WorkOrder clôturé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { description, severity, detectedBy } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Description de la réserve requise" },
        { status: 400 }
      );
    }

    // Créer la réserve
    const reservation = await prisma.workReservation.create({
      data: {
        workOrderId: id,
        description,
        severity: severity || "MINEURE",
        detectedBy: detectedBy || user.email,
      },
    });

    // Créer un événement
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "RESERVATION_ADDED",
        newValue: JSON.stringify({
          description,
          severity: severity || "MINEURE",
        }),
        performedBy: user.id,
        notes: `Réserve ajoutée: ${description}`,
      },
    });

    // Si le WorkOrder est ATTENTE_ATTACHEMENT, passer à ATTENTE_LEVEE
    if (workOrder.status === "ATTENTE_ATTACHEMENT") {
      await prisma.workOrder.update({
        where: { id },
        data: { status: "ATTENTE_LEVEE" },
      });

      await prisma.workEvent.create({
        data: {
          workOrderId: id,
          eventType: "STATUS_CHANGE",
          oldValue: "ATTENTE_ATTACHEMENT",
          newValue: "ATTENTE_LEVEE",
          performedBy: "system",
          notes: "Transition automatique après ajout d'une réserve",
        },
      });
    }

    return NextResponse.json({
      success: true,
      reservation,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/work-orders/[id]/reservations error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout de la réserve" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/work-orders/[id]/reservations
 * Met à jour une réserve (marquer comme résolue ou non)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls EDITOR, ADMIN et SUPER_ADMIN peuvent modifier des réserves
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
    const { reservationId, isResolved, resolutionNotes } = body;

    if (!reservationId) {
      return NextResponse.json(
        { error: "reservationId requis" },
        { status: 400 }
      );
    }

    // Vérifier que la réserve existe et appartient à ce WorkOrder
    const reservation = await prisma.workReservation.findFirst({
      where: {
        id: reservationId,
        workOrderId: id,
        workOrder: {
          quote: {
            organizationId: effectiveOrgId,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Réserve introuvable" },
        { status: 404 }
      );
    }

    // Mettre à jour la réserve
    const updatedReservation = await prisma.workReservation.update({
      where: { id: reservationId },
      data: {
        isResolved: isResolved ?? reservation.isResolved,
        resolvedAt: isResolved ? new Date() : reservation.resolvedAt,
        resolvedBy: isResolved ? user.id : reservation.resolvedBy,
        resolutionNotes: resolutionNotes || reservation.resolutionNotes,
      },
    });

    // Créer un événement
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "RESERVATION_UPDATED",
        oldValue: JSON.stringify({ isResolved: reservation.isResolved }),
        newValue: JSON.stringify({ isResolved }),
        performedBy: user.id,
        notes: isResolved
          ? `Réserve résolue: ${reservation.description}`
          : `Réserve marquée comme non résolue: ${reservation.description}`,
      },
    });

    return NextResponse.json({
      success: true,
      reservation: updatedReservation,
    });
  } catch (error) {
    console.error("PUT /api/work-orders/[id]/reservations error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la réserve" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-orders/[id]/reservations
 * Supprime une réserve
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls ADMIN et SUPER_ADMIN peuvent supprimer des réserves
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Permission refusée. Seuls les ADMIN peuvent supprimer des réserves." },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json(
        { error: "reservationId requis" },
        { status: 400 }
      );
    }

    // Vérifier que la réserve existe et appartient à ce WorkOrder
    const reservation = await prisma.workReservation.findFirst({
      where: {
        id: reservationId,
        workOrderId: id,
        workOrder: {
          quote: {
            organizationId: effectiveOrgId,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Réserve introuvable" },
        { status: 404 }
      );
    }

    // Supprimer la réserve
    await prisma.workReservation.delete({
      where: { id: reservationId },
    });

    // Créer un événement
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "RESERVATION_REMOVED",
        oldValue: JSON.stringify({ description: reservation.description }),
        performedBy: user.id,
        notes: `Réserve supprimée: ${reservation.description}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Réserve supprimée",
    });
  } catch (error) {
    console.error("DELETE /api/work-orders/[id]/reservations error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la réserve" },
      { status: 500 }
    );
  }
}
