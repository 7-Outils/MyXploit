import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { RoomType } from "@/generated/prisma/enums";

// Le local doit appartenir à un site de l'organisation courante.
async function findScopedRoom(roomId: string, organizationId: string) {
  return prisma.technicalRoom.findFirst({
    where: { id: roomId, site: { organizationId } },
    select: { id: true },
  });
}

function isRoomType(value: unknown): value is RoomType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RoomType, value)
  );
}

// PATCH /api/rooms/[id] - Modifier un local technique
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
        { error: "Vous n'avez pas les droits pour modifier les locaux techniques" },
        { status: 403 }
      );
    }

    if (!(await findScopedRoom(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Local technique introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; type?: RoomType; location?: string | null } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
      data.name = name;
    }
    if (body.type !== undefined) {
      if (!isRoomType(body.type)) {
        return NextResponse.json({ error: "Type de local invalide" }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.location !== undefined) {
      data.location =
        typeof body.location === "string" && body.location.trim()
          ? body.location.trim()
          : null;
    }

    const room = await prisma.technicalRoom.update({
      where: { id },
      data,
      include: { _count: { select: { equipments: true } } },
    });
    return NextResponse.json(room);
  } catch (error) {
    console.error("Error updating technical room:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du local technique" },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[id] - Supprimer un local technique
// Sans danger pour le patrimoine : Equipment.roomId et Circuit.sourceRoomId
// sont en ON DELETE SET NULL, les équipements du local sont conservés et
// perdent seulement leur rattachement.
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
        { error: "Vous n'avez pas les droits pour supprimer un local technique" },
        { status: 403 }
      );
    }

    if (!(await findScopedRoom(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Local technique introuvable" }, { status: 404 });
    }

    await prisma.technicalRoom.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting technical room:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du local technique" },
      { status: 500 }
    );
  }
}
