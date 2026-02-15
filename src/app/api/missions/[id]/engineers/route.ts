import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// POST /api/missions/[id]/engineers - Affecter un ingenieur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const mission = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "L'identifiant de l'ingenieur est requis" }, { status: 400 });
    }

    // Verifier que l'utilisateur appartient a l'org
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: effectiveOrgId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur introuvable dans l'organisation" }, { status: 404 });
    }

    const assignment = await prisma.userMissionAssignment.create({
      data: { userId, missionId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error("Error assigning engineer:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'affectation de l'ingenieur" },
      { status: 500 }
    );
  }
}

// DELETE /api/missions/[id]/engineers - Retirer un ingenieur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const mission = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "L'identifiant de l'ingenieur est requis" }, { status: 400 });
    }

    await prisma.userMissionAssignment.deleteMany({
      where: { userId, missionId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing engineer:", error);
    return NextResponse.json(
      { error: "Erreur lors du retrait de l'ingenieur" },
      { status: 500 }
    );
  }
}
