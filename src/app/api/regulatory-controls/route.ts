import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/regulatory-controls
 * Liste des contrôles réglementaires avec filtres
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
    const typeId = searchParams.get("typeId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const overdue = searchParams.get("overdue"); // "true" pour les en retard

    const now = new Date();

    const controls = await prisma.regulatoryControl.findMany({
      where: {
        organizationId: effectiveOrgId,
        ...(siteId && { siteId }),
        ...(typeId && { typeId }),
        ...(status && { status: status as any }),
        ...(category && { type: { category: category as any } }),
        ...(overdue === "true" && {
          dueDate: { lt: now },
          status: { in: ["A_PLANIFIER", "PLANIFIE"] },
        }),
      },
      include: {
        type: {
          select: {
            id: true,
            name: true,
            category: true,
            frequency: true,
            regulatoryRef: true,
          },
        },
        site: { select: { id: true, name: true, city: true } },
        equipment: { select: { id: true, name: true, type: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    // Enrichir avec un flag isOverdue
    const enriched = controls.map((c) => ({
      ...c,
      isOverdue:
        (c.status === "A_PLANIFIER" || c.status === "PLANIFIE") &&
        new Date(c.dueDate) < now,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/regulatory-controls error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regulatory-controls
 * Créer un contrôle réglementaire (planifier)
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
    const { typeId, siteId, equipmentId, dueDate, performer, notes } = body;

    if (!typeId || !siteId || !dueDate) {
      return NextResponse.json(
        { error: "Type, site et échéance requis" },
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

    const control = await prisma.regulatoryControl.create({
      data: {
        typeId,
        siteId,
        equipmentId: equipmentId || null,
        organizationId: effectiveOrgId,
        dueDate: new Date(dueDate),
        status: "A_PLANIFIER",
        performer: performer?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        type: {
          select: { id: true, name: true, category: true, frequency: true },
        },
        site: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error("POST /api/regulatory-controls error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
