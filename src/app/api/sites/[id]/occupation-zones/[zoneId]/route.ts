import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * PUT /api/sites/[id]/occupation-zones/[zoneId]
 * Modifier une zone d'occupation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id, zoneId } = await params;

    // Vérifier accès au site
    const site = await prisma.site.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que la zone appartient au site
    const existing = await prisma.occupationZone.findFirst({
      where: { id: zoneId, siteId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Zone non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, surface, tempConsigne, tempReduit, weeklySchedule } = body;

    const zone = await prisma.occupationZone.update({
      where: { id: zoneId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(surface !== undefined && {
          surface: surface ? parseFloat(surface) : null,
        }),
        ...(tempConsigne !== undefined && {
          tempConsigne: parseFloat(tempConsigne),
        }),
        ...(tempReduit !== undefined && {
          tempReduit: parseFloat(tempReduit),
        }),
        ...(weeklySchedule !== undefined && { weeklySchedule }),
      },
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error("PUT /api/sites/[id]/occupation-zones/[zoneId] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sites/[id]/occupation-zones/[zoneId]
 * Supprimer une zone d'occupation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id, zoneId } = await params;

    // Vérifier accès au site
    const site = await prisma.site.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que la zone appartient au site
    const existing = await prisma.occupationZone.findFirst({
      where: { id: zoneId, siteId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Zone non trouvée" },
        { status: 404 }
      );
    }

    await prisma.occupationZone.delete({
      where: { id: zoneId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sites/[id]/occupation-zones/[zoneId] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
