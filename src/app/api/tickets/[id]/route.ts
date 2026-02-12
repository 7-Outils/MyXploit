import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/tickets/[id]
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

    const ticket = await prisma.ticket.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        site: { select: { id: true, name: true, city: true, address: true } },
        contract: {
          select: { id: true, reference: true, title: true, provider: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        agendaItems: {
          include: {
            meeting: {
              select: { id: true, title: true, date: true, type: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("GET /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tickets/[id]
 * Modifier un ticket (statut, infos, etc.)
 */
export async function PATCH(
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

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, status, responsible, source, dueDate, contractId } = body;

    // Si on passe à RESOLVED, mettre resolvedAt
    const resolvedAt =
      status === "RESOLVED" && existing.status !== "RESOLVED"
        ? new Date()
        : status !== "RESOLVED" && status !== undefined
          ? null
          : undefined;

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(status !== undefined && { status }),
        ...(responsible !== undefined && {
          responsible: responsible?.trim() || null,
        }),
        ...(source !== undefined && { source }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(contractId !== undefined && { contractId: contractId || null }),
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
        contract: {
          select: { id: true, reference: true, title: true, provider: true },
        },
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tickets/[id]
 */
export async function DELETE(
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

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
