import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * Vérifie que le défaut visé appartient bien à un équipement de l'organisation
 * effective, et que l'utilisateur peut écrire. Renvoie une réponse d'erreur
 * prête à retourner, ou null si tout est en ordre.
 */
async function guard(
  equipmentId: string,
  defectId: string,
  role: string,
  effectiveOrgId: string,
  action: string
) {
  if (role === "READER") {
    return NextResponse.json(
      { error: `Vous n'avez pas les droits pour ${action}` },
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

  const defect = await prisma.equipmentDefect.findFirst({
    where: { id: defectId, equipmentId },
    select: { id: true },
  });
  if (!defect) {
    return NextResponse.json({ error: "Défaut non trouvé" }, { status: 404 });
  }

  return null;
}

// PATCH /api/equipments/[id]/defects/[defectId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; defectId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId, defectId } = await params;

    const denied = await guard(
      equipmentId,
      defectId,
      user.role,
      effectiveOrgId,
      "modifier ce défaut"
    );
    if (denied) return denied;

    const body = await request.json();
    const data: {
      description?: string;
      preconisation?: string | null;
      photos?: string[];
    } = {};

    if (body.description !== undefined) {
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      if (!description) {
        return NextResponse.json(
          { error: "Le constat est obligatoire" },
          { status: 400 }
        );
      }
      data.description = description;
    }

    if (body.preconisation !== undefined) {
      data.preconisation =
        typeof body.preconisation === "string" && body.preconisation.trim()
          ? body.preconisation.trim()
          : null;
    }

    if (body.photos !== undefined) {
      data.photos = Array.isArray(body.photos)
        ? body.photos
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [];
    }

    const defect = await prisma.equipmentDefect.update({
      where: { id: defectId },
      data,
    });

    return NextResponse.json(defect);
  } catch (error) {
    console.error("Error updating equipment defect:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du défaut" },
      { status: 500 }
    );
  }
}

// DELETE /api/equipments/[id]/defects/[defectId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; defectId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId, defectId } = await params;

    const denied = await guard(
      equipmentId,
      defectId,
      user.role,
      effectiveOrgId,
      "supprimer ce défaut"
    );
    if (denied) return denied;

    await prisma.equipmentDefect.delete({ where: { id: defectId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting equipment defect:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du défaut" },
      { status: 500 }
    );
  }
}
