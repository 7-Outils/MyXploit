import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// DELETE /api/team/[id] - Supprimer un membre de l'equipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut supprimer un membre" },
        { status: 403 }
      );
    }

    // Ne pas se supprimer soi-meme
    if (id === user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous supprimer vous-meme" },
        { status: 400 }
      );
    }

    // Verifier que le membre appartient a l'organisation
    const member = await prisma.user.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
        role: { not: "SUPER_ADMIN" },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Membre non trouve" },
        { status: 404 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting team member:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du membre" },
      { status: 500 }
    );
  }
}
