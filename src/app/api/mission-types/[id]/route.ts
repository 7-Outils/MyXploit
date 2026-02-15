import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// PUT /api/mission-types/[id] - Modifier un type de mission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut modifier les types de missions" },
        { status: 403 }
      );
    }

    const existing = await prisma.missionType.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Type de mission introuvable" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, isActive } = body;

    const updated = await prisma.missionType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating mission type:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du type de mission" },
      { status: 500 }
    );
  }
}

// DELETE /api/mission-types/[id] - Supprimer un type de mission
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut supprimer les types de missions" },
        { status: 403 }
      );
    }

    const existing = await prisma.missionType.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: { _count: { select: { missions: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Type de mission introuvable" },
        { status: 404 }
      );
    }

    if (existing._count.missions > 0) {
      return NextResponse.json(
        { error: `Ce type est utilise par ${existing._count.missions} mission(s). Desactivez-le plutot.` },
        { status: 400 }
      );
    }

    await prisma.missionType.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting mission type:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du type de mission" },
      { status: 500 }
    );
  }
}
