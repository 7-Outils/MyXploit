import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Module } from "@/generated/prisma";

const ALL_MODULES: Module[] = [
  "ENERGY",
  "FINANCIER",
  "ADMINISTRATIF",
  "EXPLOITATION",
  "OUTILS",
  "CONTRACTS",
  "PRICING",
];

// POST /api/admin/seed-modules - Activer tous les modules pour toutes les organisations
export async function POST() {
  try {
    const user = await requireAuth();

    // Seul SUPER_ADMIN peut seeder les modules
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    // Récupérer toutes les organisations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    let totalCreated = 0;

    for (const org of organizations) {
      // Activer tous les modules pour cette organisation
      for (const module of ALL_MODULES) {
        const result = await prisma.organizationModule.upsert({
          where: {
            organizationId_module: {
              organizationId: org.id,
              module,
            },
          },
          create: {
            organizationId: org.id,
            module,
            isEnabled: true,
          },
          update: {
            isEnabled: true,
          },
        });

        if (result) totalCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Modules activés pour ${organizations.length} organisations`,
      totalModules: totalCreated,
    });
  } catch (error) {
    console.error("Error seeding modules:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'activation des modules" },
      { status: 500 }
    );
  }
}
