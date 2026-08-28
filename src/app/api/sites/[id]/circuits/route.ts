import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { CircuitRegulationType } from "@/generated/prisma/enums";

// Caractéristiques libres du circuit : chaînes telles que saisies dans l'app.
const CHARACTERISTIC_FIELDS = [
  "power",
  "designFlowTemp",
  "designReturnTemp",
  "heatingCurveHighTemp",
  "heatingCurveLowTemp",
] as const;

type CharacteristicField = (typeof CHARACTERISTIC_FIELDS)[number];

async function requireSite(id: string, organizationId: string) {
  return prisma.site.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
}

function isRegulationType(value: unknown): value is CircuitRegulationType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CircuitRegulationType, value)
  );
}

function trimmedOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// GET /api/sites/[id]/circuits - Circuits du site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (!(await requireSite(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const circuits = await prisma.circuit.findMany({
      where: { siteId: id },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { equipments: true } },
        sourceRoom: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(circuits);
  } catch (error) {
    console.error("Error fetching circuits:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des circuits" },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/circuits - Créer un circuit
export async function POST(
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

    if (!(await requireSite(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    if (body.regulationType !== undefined && !isRegulationType(body.regulationType)) {
      return NextResponse.json(
        { error: "Type de régulation invalide" },
        { status: 400 }
      );
    }

    // Le local source doit être un local du même site, sinon on croise deux
    // topologies (un circuit du site A partant d'une chaufferie du site B).
    let sourceRoomId: string | null = null;
    if (body.sourceRoomId) {
      const room = await prisma.technicalRoom.findFirst({
        where: { id: body.sourceRoomId, siteId: id },
        select: { id: true },
      });
      if (!room) {
        return NextResponse.json(
          { error: "Local technique source introuvable sur ce site" },
          { status: 400 }
        );
      }
      sourceRoomId = room.id;
    }

    const characteristics: Partial<Record<CharacteristicField, string | null>> = {};
    for (const field of CHARACTERISTIC_FIELDS) {
      characteristics[field] = trimmedOrNull(body[field]);
    }

    const circuit = await prisma.circuit.create({
      data: {
        siteId: id,
        name,
        regulationType: isRegulationType(body.regulationType)
          ? body.regulationType
          : "REGULE",
        sourceRoomId,
        ...characteristics,
      },
      include: {
        _count: { select: { equipments: true } },
        sourceRoom: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(circuit, { status: 201 });
  } catch (error) {
    console.error("Error creating circuit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du circuit" },
      { status: 500 }
    );
  }
}
