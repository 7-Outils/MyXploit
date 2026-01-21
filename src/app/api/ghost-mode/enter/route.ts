import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/ghost-mode/enter - Entrer en mode fantôme (SUPER_ADMIN uniquement)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Seul SUPER_ADMIN peut utiliser le mode fantôme
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le Super Administrateur peut utiliser le mode fantôme" },
        { status: 403 }
      );
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "ID de l'organisation requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'organisation existe
    const targetOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!targetOrg) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Supprimer les sessions fantômes existantes pour cet admin
    await prisma.ghostSession.deleteMany({
      where: { superAdminId: user.id },
    });

    // Créer une nouvelle session (expire après 4 heures)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    await prisma.ghostSession.create({
      data: {
        superAdminId: user.id,
        targetOrganizationId: organizationId,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      organizationId: targetOrg.id,
      organizationName: targetOrg.name,
      expiresAt,
    });
  } catch (error) {
    console.error("Error entering ghost mode:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'activation du mode fantôme" },
      { status: 500 }
    );
  }
}
