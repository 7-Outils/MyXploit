import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * POST /api/meetings/[id]/import-tickets
 * Import automatique des tickets ouverts/en cours dans l'ODJ
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
      include: {
        agendaItems: { select: { ticketId: true } },
      },
    });
    if (!meeting) {
      return NextResponse.json(
        { error: "Réunion non trouvée" },
        { status: 404 }
      );
    }

    // Tickets déjà dans l'ODJ
    const existingTicketIds = meeting.agendaItems
      .map((item) => item.ticketId)
      .filter(Boolean) as string[];

    // Chercher les tickets ouverts/en cours
    const where: any = {
      organizationId: effectiveOrgId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      id: { notIn: existingTicketIds },
    };

    // Filtrer par contrat si la réunion en a un
    if (meeting.contractId) {
      where.contractId = meeting.contractId;
    } else if (meeting.siteId) {
      // Sinon filtrer par site
      where.siteId = meeting.siteId;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { openedAt: "asc" },
      select: { id: true, reference: true, title: true },
    });

    if (tickets.length === 0) {
      return NextResponse.json({
        imported: 0,
        message: "Aucun nouveau ticket à importer",
      });
    }

    // Trouver le prochain order
    const maxOrder = await prisma.meetingAgendaItem.findFirst({
      where: { meetingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let nextOrder = (maxOrder?.order ?? 0) + 1;

    // Créer les items
    const items = await prisma.meetingAgendaItem.createMany({
      data: tickets.map((ticket) => ({
        meetingId,
        ticketId: ticket.id,
        order: nextOrder++,
        title: `${ticket.reference} - ${ticket.title}`,
      })),
    });

    return NextResponse.json({
      imported: items.count,
      message: `${items.count} ticket${items.count > 1 ? "s" : ""} importé${items.count > 1 ? "s" : ""}`,
    });
  } catch (error) {
    console.error("POST /api/meetings/[id]/import-tickets error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
