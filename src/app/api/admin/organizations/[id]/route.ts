import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// PUT /api/admin/organizations/[id] - Modifier une organisation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Acces reserve aux super administrateurs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/organizations/[id] - Supprimer une organisation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Acces reserve aux super administrateurs" },
        { status: 403 }
      );
    }

    // Verifier que l'organisation existe
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organisation non trouvee" },
        { status: 404 }
      );
    }

    // Ne pas supprimer si c'est l'organisation du SUPER_ADMIN
    if (currentUser.organizationId === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre organisation" },
        { status: 400 }
      );
    }

    // Supprimer l'organisation (cascade supprimera les users et sites)
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
