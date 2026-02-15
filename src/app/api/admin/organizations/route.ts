import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/organizations - Lister toutes les organisations (SUPER_ADMIN uniquement)
export async function GET() {
  try {
    const user = await requireAuth();

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux super administrateurs" },
        { status: 403 }
      );
    }

    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            sites: true,
            contracts: true,
          },
        },
        modules: {
          select: {
            module: true,
            isEnabled: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des organisations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/organizations - Créer une organisation
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux super administrateurs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      );
    }

    const newOrg = await prisma.organization.create({
      data: {
        name,
        slug: `org-${Date.now()}`,
      },
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'organisation" },
      { status: 500 }
    );
  }
}
