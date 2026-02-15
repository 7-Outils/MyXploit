import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/mission-types - Liste des types de missions de l'organisation
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const types = await prisma.missionType.findMany({
      where: {
        organizationId: effectiveOrgId,
        isActive: true,
      },
      include: {
        _count: { select: { missions: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error("Error fetching mission types:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des types de missions" },
      { status: 500 }
    );
  }
}

// POST /api/mission-types - Creer un type de mission
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut creer des types de missions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom du type de mission est requis" },
        { status: 400 }
      );
    }

    // Verifier l'unicite
    const existing = await prisma.missionType.findUnique({
      where: {
        organizationId_name: {
          organizationId: effectiveOrgId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ce type de mission existe deja" },
        { status: 400 }
      );
    }

    const missionType = await prisma.missionType.create({
      data: {
        name: name.trim(),
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json(missionType, { status: 201 });
  } catch (error) {
    console.error("Error creating mission type:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation du type de mission" },
      { status: 500 }
    );
  }
}
