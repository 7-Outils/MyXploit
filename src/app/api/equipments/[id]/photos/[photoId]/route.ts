import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// DELETE /api/equipments/[id]/photos/[photoId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId, photoId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer une photo" },
        { status: 403 }
      );
    }

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId: effectiveOrgId },
      select: { id: true, imageUrl: true },
    });

    if (!equipment) {
      return NextResponse.json({ error: "Équipement non trouvé" }, { status: 404 });
    }

    const photo = await prisma.equipmentPhoto.findFirst({
      where: { id: photoId, equipmentId },
      select: { id: true, url: true },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo non trouvée" }, { status: 404 });
    }

    await prisma.equipmentPhoto.delete({ where: { id: photoId } });

    // La couverture pointait sur la photo supprimée : on repasse sur la plus
    // ancienne photo d'équipement restante, sinon la carte n'a plus de vignette.
    if (equipment.imageUrl && equipment.imageUrl === photo.url) {
      const fallback = await prisma.equipmentPhoto.findFirst({
        where: { equipmentId, kind: "EQUIPMENT" },
        select: { url: true },
        orderBy: { createdAt: "asc" },
      });
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { imageUrl: fallback?.url ?? null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting equipment photo:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la photo" },
      { status: 500 }
    );
  }
}
