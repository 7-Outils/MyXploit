import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// POST /api/mission-types/seed - Seed initial depuis l'onboarding
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut configurer les types de missions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { types } = body;

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json(
        { error: "Au moins un type de mission est requis" },
        { status: 400 }
      );
    }

    // Creer les types en batch, ignorer les doublons
    const created = [];
    for (let i = 0; i < types.length; i++) {
      const name = types[i]?.trim();
      if (!name) continue;

      try {
        const mt = await prisma.missionType.create({
          data: {
            name,
            organizationId: effectiveOrgId,
            sortOrder: i,
          },
        });
        created.push(mt);
      } catch {
        // Ignore les doublons (unique constraint)
      }
    }

    return NextResponse.json({ created: created.length, types: created }, { status: 201 });
  } catch (error) {
    console.error("Error seeding mission types:", error);
    return NextResponse.json(
      { error: "Erreur lors de la configuration des types de missions" },
      { status: 500 }
    );
  }
}
