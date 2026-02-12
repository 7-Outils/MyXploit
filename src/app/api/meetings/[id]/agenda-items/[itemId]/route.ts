import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * PATCH /api/meetings/[id]/agenda-items/[itemId]
 * Modifier notes, décision, order, titre
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: meetingId, itemId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    // Vérifier accès
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!meeting) {
      return NextResponse.json(
        { error: "Réunion non trouvée" },
        { status: 404 }
      );
    }

    const existing = await prisma.meetingAgendaItem.findFirst({
      where: { id: itemId, meetingId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Point ODJ non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, notes, decision, order } = body;

    const item = await prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: {
        ...(title !== undefined && { title }),
        ...(notes !== undefined && { notes }),
        ...(decision !== undefined && { decision }),
        ...(order !== undefined && { order }),
      },
      include: {
        ticket: {
          select: {
            id: true,
            reference: true,
            title: true,
            status: true,
            responsible: true,
            site: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PATCH /api/meetings/[id]/agenda-items/[itemId] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meetings/[id]/agenda-items/[itemId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: meetingId, itemId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!meeting) {
      return NextResponse.json(
        { error: "Réunion non trouvée" },
        { status: 404 }
      );
    }

    await prisma.meetingAgendaItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/meetings/[id]/agenda-items/[itemId] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
