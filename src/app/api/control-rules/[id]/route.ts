import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { EquipmentType } from "@/generated/prisma/enums";

// PATCH /api/control-rules/[id] — modifier une règle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier une règle" },
        { status: 403 }
      );
    }

    const existing = await prisma.equipmentControlRule.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Règle non trouvée" }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      equipmentType?: string;
      name?: string;
      frequencyMonths?: number;
    } = {};

    if (body.equipmentType !== undefined) {
      if (
        typeof body.equipmentType !== "string" ||
        !Object.prototype.hasOwnProperty.call(EquipmentType, body.equipmentType)
      ) {
        return NextResponse.json(
          { error: "Type d'équipement invalide" },
          { status: 400 }
        );
      }
      data.equipmentType = body.equipmentType;
    }

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "Le nom du contrôle est obligatoire" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.frequencyMonths !== undefined) {
      const frequencyMonths = Number(body.frequencyMonths);
      if (
        !Number.isInteger(frequencyMonths) ||
        frequencyMonths < 1 ||
        frequencyMonths > 120
      ) {
        return NextResponse.json(
          { error: "La fréquence doit être un nombre de mois entre 1 et 120" },
          { status: 400 }
        );
      }
      data.frequencyMonths = frequencyMonths;
    }

    const rule = await prisma.equipmentControlRule.update({
      where: { id },
      data,
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("PATCH /api/control-rules/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/control-rules/[id] — supprimer une règle (et ses contrôles)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer une règle" },
        { status: 403 }
      );
    }

    const existing = await prisma.equipmentControlRule.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Règle non trouvée" }, { status: 404 });
    }

    await prisma.equipmentControlRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/control-rules/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
