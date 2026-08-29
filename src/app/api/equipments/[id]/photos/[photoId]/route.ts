import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";

// Efface aussi le fichier R2 (best-effort : les clés sont des uuid uniques,
// une fois la ligne et la couverture re-pointée, plus rien ne référence l'url).
async function deleteFromR2(url: string) {
  try {
    const prefix = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/` : `https://${R2_BUCKET_NAME}.r2.dev/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (!key) return;
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
  } catch (error) {
    console.error("R2 delete failed (fichier orphelin conservé):", error);
  }
}

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
    await deleteFromR2(photo.url);

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
