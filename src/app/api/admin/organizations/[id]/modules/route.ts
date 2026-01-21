import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Module } from "@/generated/prisma/client";

// GET /api/admin/organizations/[id]/modules - Liste des modules d'une org
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: orgId } = await params;

    // Seul SUPER_ADMIN peut gérer les modules
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    const modules = await prisma.organizationModule.findMany({
      where: { organizationId: orgId },
      orderBy: { module: "asc" },
    });

    return NextResponse.json({ modules: modules.map(m => m.module) });
  } catch (error) {
    console.error("Error fetching org modules:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des modules" },
      { status: 500 }
    );
  }
}

// POST /api/admin/organizations/[id]/modules - Activer un module
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: orgId } = await params;

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    const { module } = await request.json();

    if (!module) {
      return NextResponse.json(
        { error: "Module requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'organisation existe
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Activer le module (ou le réactiver s'il existe)
    const orgModule = await prisma.organizationModule.upsert({
      where: {
        organizationId_module: {
          organizationId: orgId,
          module: module as Module,
        },
      },
      create: {
        organizationId: orgId,
        module: module as Module,
        isEnabled: true,
      },
      update: {
        isEnabled: true,
      },
    });

    return NextResponse.json({ success: true, module: orgModule });
  } catch (error) {
    console.error("Error enabling module:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'activation du module" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/organizations/[id]/modules - Désactiver un module
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: orgId } = await params;

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    const { module } = await request.json();

    if (!module) {
      return NextResponse.json(
        { error: "Module requis" },
        { status: 400 }
      );
    }

    // Désactiver le module
    await prisma.organizationModule.updateMany({
      where: {
        organizationId: orgId,
        module: module as Module,
      },
      data: {
        isEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling module:", error);
    return NextResponse.json(
      { error: "Erreur lors de la désactivation du module" },
      { status: 500 }
    );
  }
}
