import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/meetings/[id]/agenda-items
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
    const { id: meetingId } = await params;

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

    const items = await prisma.meetingAgendaItem.findMany({
      where: { meetingId },
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
      orderBy: { order: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/meetings/[id]/agenda-items error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meetings/[id]/agenda-items
 * Ajouter un point à l'ODJ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: meetingId } = await params;

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

    const body = await request.json();
    const { ticketId, title } = body;

    if (!title?.trim() && !ticketId) {
      return NextResponse.json(
        { error: "Titre ou ticket requis" },
        { status: 400 }
      );
    }

    // Déterminer le titre depuis le ticket si fourni
    let itemTitle = title?.trim() || "";
    if (ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { title: true, reference: true },
      });
      if (ticket) {
        itemTitle = itemTitle || `${ticket.reference} - ${ticket.title}`;
      }
    }

    // Trouver le prochain order
    const maxOrder = await prisma.meetingAgendaItem.findFirst({
      where: { meetingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const item = await prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        ticketId: ticketId || null,
        order: (maxOrder?.order ?? 0) + 1,
        title: itemTitle,
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

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/meetings/[id]/agenda-items error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
