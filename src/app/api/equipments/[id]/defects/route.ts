import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/** Liste d'URLs de photos : on n'accepte que des chaînes non vides. */
function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

// GET /api/equipments/[id]/defects - Défauts constatés de la fiche
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

    const defects = await prisma.equipmentDefect.findMany({
      where: { equipmentId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(defects);
  } catch (error) {
    console.error("Error fetching equipment defects:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des défauts" },
      { status: 500 }
    );
  }
}

// POST /api/equipments/[id]/defects - Nouveau constat
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
        { error: "Vous n'avez pas les droits pour ajouter un défaut" },
        { status: 403 }
      );
    }

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!equipment) {
      return NextResponse.json({ error: "Équipement non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (!description) {
      return NextResponse.json({ error: "Le constat est obligatoire" }, { status: 400 });
    }

    // Rang suivant : les défauts se lisent dans l'ordre de saisie.
    const last = await prisma.equipmentDefect.findFirst({
      where: { equipmentId },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
    });

    const defect = await prisma.equipmentDefect.create({
      data: {
        equipmentId,
        description,
        preconisation:
          typeof body.preconisation === "string" && body.preconisation.trim()
            ? body.preconisation.trim()
            : null,
        photos: normalizePhotos(body.photos),
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(defect, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment defect:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du défaut" },
      { status: 500 }
    );
  }
}
