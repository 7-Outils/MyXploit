import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// PUT /api/deliverables/[id] - Modifier un livrable
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const deliverable = await prisma.deliverable.findFirst({
      where: { id },
      include: {
        mission: {
          select: {
            organizationId: true,
            engineers: { select: { userId: true } },
          },
        },
      },
    });

    if (!deliverable || deliverable.mission.organizationId !== effectiveOrgId) {
      return NextResponse.json({ error: "Livrable introuvable" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isAssigned = deliverable.mission.engineers.some((e) => e.userId === user.id);

    if (!isAdmin && !isAssigned) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    // EDITOR peut changer le statut, ADMIN peut tout modifier
    if (body.status !== undefined) {
      data.status = body.status;
      // Auto-remplir les dates selon le statut
      if (body.status === "PRODUIT" && !body.completedDate) {
        data.completedDate = new Date();
      }
      if (body.status === "TRANSMIS" && !body.transmittedDate) {
        data.transmittedDate = new Date();
      }
    }

    if (isAdmin) {
      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.completedDate !== undefined) data.completedDate = body.completedDate ? new Date(body.completedDate) : null;
      if (body.transmittedDate !== undefined) data.transmittedDate = body.transmittedDate ? new Date(body.transmittedDate) : null;
      if (body.fileUrl !== undefined) data.fileUrl = body.fileUrl;
    }

    // EDITOR peut aussi mettre a jour le fileUrl
    if (!isAdmin && body.fileUrl !== undefined) {
      data.fileUrl = body.fileUrl;
    }

    const updated = await prisma.deliverable.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating deliverable:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du livrable" },
      { status: 500 }
    );
  }
}

// DELETE /api/deliverables/[id] - Supprimer un livrable
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Seul le dirigeant peut supprimer des livrables" }, { status: 403 });
    }

    const deliverable = await prisma.deliverable.findFirst({
      where: { id },
      include: { mission: { select: { organizationId: true } } },
    });

    if (!deliverable || deliverable.mission.organizationId !== effectiveOrgId) {
      return NextResponse.json({ error: "Livrable introuvable" }, { status: 404 });
    }

    await prisma.deliverable.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du livrable" },
      { status: 500 }
    );
  }
}
