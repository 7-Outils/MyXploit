import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/missions/[id]/deliverables - Livrables d'une mission
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    // Verifier que la mission appartient a l'org
    const mission = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true, engineers: { select: { userId: true } } },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    // EDITOR doit etre assigne
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && !mission.engineers.some((e) => e.userId === user.id)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const deliverables = await prisma.deliverable.findMany({
      where: { missionId: id },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(deliverables);
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des livrables" },
      { status: 500 }
    );
  }
}

// POST /api/missions/[id]/deliverables - Ajouter un livrable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const mission = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true, engineers: { select: { userId: true } } },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    // ADMIN ou EDITOR assigne peut ajouter des livrables
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && !mission.engineers.some((e) => e.userId === user.id)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, dueDate, status } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Le titre du livrable est requis" },
        { status: 400 }
      );
    }

    const deliverable = await prisma.deliverable.create({
      data: {
        title: title.trim(),
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || "A_FAIRE",
        missionId: id,
      },
    });

    return NextResponse.json(deliverable, { status: 201 });
  } catch (error) {
    console.error("Error creating deliverable:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation du livrable" },
      { status: 500 }
    );
  }
}
