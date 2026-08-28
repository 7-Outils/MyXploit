import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { CircuitRegulationType } from "@/generated/prisma/enums";

const CHARACTERISTIC_FIELDS = [
  "power",
  "designFlowTemp",
  "designReturnTemp",
  "heatingCurveHighTemp",
  "heatingCurveLowTemp",
] as const;

type CharacteristicField = (typeof CHARACTERISTIC_FIELDS)[number];

// Le circuit doit appartenir à un site de l'organisation courante.
async function findScopedCircuit(circuitId: string, organizationId: string) {
  return prisma.circuit.findFirst({
    where: { id: circuitId, site: { organizationId } },
    select: { id: true, siteId: true },
  });
}

function isRegulationType(value: unknown): value is CircuitRegulationType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CircuitRegulationType, value)
  );
}

// PATCH /api/circuits/[id] - Modifier un circuit
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier les circuits" },
        { status: 403 }
      );
    }

    const existing = await findScopedCircuit(id, effectiveOrgId);
    if (!existing) {
      return NextResponse.json({ error: "Circuit introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
      data.name = name;
    }
    if (body.regulationType !== undefined) {
      if (!isRegulationType(body.regulationType)) {
        return NextResponse.json(
          { error: "Type de régulation invalide" },
          { status: 400 }
        );
      }
      data.regulationType = body.regulationType;
    }
    if (body.sourceRoomId !== undefined) {
      if (body.sourceRoomId === null || body.sourceRoomId === "") {
        data.sourceRoomId = null;
      } else {
        const room = await prisma.technicalRoom.findFirst({
          where: { id: body.sourceRoomId, siteId: existing.siteId },
          select: { id: true },
        });
        if (!room) {
          return NextResponse.json(
            { error: "Local technique source introuvable sur ce site" },
            { status: 400 }
          );
        }
        data.sourceRoomId = room.id;
      }
    }
    for (const field of CHARACTERISTIC_FIELDS as readonly CharacteristicField[]) {
      if (body[field] !== undefined) {
        data[field] =
          typeof body[field] === "string" && body[field].trim()
            ? body[field].trim()
            : null;
      }
    }

    const circuit = await prisma.circuit.update({
      where: { id },
      data,
      include: {
        _count: { select: { equipments: true } },
        sourceRoom: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(circuit);
  } catch (error) {
    console.error("Error updating circuit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du circuit" },
      { status: 500 }
    );
  }
}

// DELETE /api/circuits/[id] - Supprimer un circuit
// Sans danger : Equipment.circuitId est en ON DELETE SET NULL, les équipements
// du circuit sont conservés et perdent seulement leur rattachement.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un circuit" },
        { status: 403 }
      );
    }

    if (!(await findScopedCircuit(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Circuit introuvable" }, { status: 404 });
    }

    await prisma.circuit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting circuit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du circuit" },
      { status: 500 }
    );
  }
}
