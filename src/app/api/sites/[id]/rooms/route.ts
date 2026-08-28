import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { RoomType } from "@/generated/prisma/enums";

// Le site doit appartenir à l'organisation courante (même règle que les
// contacts de contrat : on ne révèle pas l'existence d'un site voisin).
async function requireSite(id: string, organizationId: string) {
  return prisma.site.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
}

function isRoomType(value: unknown): value is RoomType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RoomType, value)
  );
}

// GET /api/sites/[id]/rooms - Locaux techniques du site
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

    const rooms = await prisma.technicalRoom.findMany({
      where: { siteId: id },
      orderBy: { name: "asc" },
      include: { _count: { select: { equipments: true } } },
    });
    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching technical rooms:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des locaux techniques" },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/rooms - Créer un local technique
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
        { error: "Vous n'avez pas les droits pour modifier les locaux techniques" },
        { status: 403 }
      );
    }

    if (!(await requireSite(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    if (body.type !== undefined && !isRoomType(body.type)) {
      return NextResponse.json(
        { error: "Type de local invalide" },
        { status: 400 }
      );
    }

    const room = await prisma.technicalRoom.create({
      data: {
        siteId: id,
        name,
        type: isRoomType(body.type) ? body.type : "CHAUFFERIE",
        location: location || null,
      },
      include: { _count: { select: { equipments: true } } },
    });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error("Error creating technical room:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du local technique" },
      { status: 500 }
    );
  }
}
