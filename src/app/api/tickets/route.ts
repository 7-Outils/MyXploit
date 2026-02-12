import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/tickets
 * Liste des tickets avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");
    const status = searchParams.get("status");
    const responsible = searchParams.get("responsible");

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: effectiveOrgId,
        ...(siteId && { siteId }),
        ...(contractId && { contractId }),
        ...(status && { status: status as any }),
        ...(responsible && {
          responsible: { contains: responsible, mode: "insensitive" as const },
        }),
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
        contract: {
          select: { id: true, reference: true, title: true, provider: true },
        },
        _count: { select: { agendaItems: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Créer un ticket
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { siteId, contractId, title, description, source, responsible, dueDate } =
      body;

    if (!siteId || !title?.trim()) {
      return NextResponse.json(
        { error: "Site et titre requis" },
        { status: 400 }
      );
    }

    // Vérifier accès au site
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Générer la référence : TKT-YYYY-NNNN
    const year = new Date().getFullYear();
    const lastTicket = await prisma.ticket.findFirst({
      where: {
        reference: { startsWith: `TKT-${year}-` },
      },
      orderBy: { reference: "desc" },
      select: { reference: true },
    });

    let seq = 1;
    if (lastTicket) {
      const parts = lastTicket.reference.split("-");
      seq = parseInt(parts[2], 10) + 1;
    }
    const reference = `TKT-${year}-${String(seq).padStart(4, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        reference,
        organizationId: effectiveOrgId,
        siteId,
        contractId: contractId || null,
        title: title.trim(),
        description: description?.trim() || null,
        source: source || "EMAIL",
        responsible: responsible?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: user.id,
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
        contract: {
          select: { id: true, reference: true, title: true, provider: true },
        },
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
