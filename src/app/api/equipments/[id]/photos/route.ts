import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { EquipmentPhotoKind } from "@/generated/prisma/enums";

// GET /api/equipments/[id]/photos - Photos de la fiche (équipement + plaque)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!equipment) {
      return NextResponse.json({ error: "Équipement non trouvé" }, { status: 404 });
    }

    const photos = await prisma.equipmentPhoto.findMany({
      where: { equipmentId },
      select: { id: true, url: true, kind: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error("Error fetching equipment photos:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des photos" },
      { status: 500 }
    );
  }
}

// POST /api/equipments/[id]/photos - Rattache une image déjà uploadée (/api/upload)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour ajouter une photo" },
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

    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "URL de la photo manquante" }, { status: 400 });
    }

    const kind = body.kind ?? "EQUIPMENT";
    if (!Object.prototype.hasOwnProperty.call(EquipmentPhotoKind, kind)) {
      return NextResponse.json({ error: "Type de photo invalide" }, { status: 400 });
    }

    const photo = await prisma.equipmentPhoto.create({
      data: { equipmentId, url, kind: kind as EquipmentPhotoKind },
      select: { id: true, url: true, kind: true },
    });

    // Règle de couverture : la vignette du parc reste `imageUrl`. La première
    // photo d'équipement l'alimente pour qu'une carte ne reste jamais vide.
    if (kind === "EQUIPMENT" && !equipment.imageUrl) {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: { imageUrl: url },
      });
    }

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment photo:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout de la photo" },
      { status: 500 }
    );
  }
}
