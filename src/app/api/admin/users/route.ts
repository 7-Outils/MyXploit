import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/admin/users - Lister tous les utilisateurs (SUPER_ADMIN uniquement)
export async function GET() {
  try {
    const user = await requireAuth();

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux super administrateurs" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      include: {
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Créer un utilisateur (SUPER_ADMIN uniquement)
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
    const { email, firstName, lastName, role, organizationId, organizationName } = body;

    if (!email) {
      return NextResponse.json(
        { error: "L'email est requis" },
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Créer ou utiliser l'organisation
    let orgId = organizationId;

    if (!orgId && organizationName) {
      // Créer une nouvelle organisation
      const newOrg = await prisma.organization.create({
        data: {
          name: organizationName,
          slug: `org-${Date.now()}`,
        },
      });
      orgId = newOrg.id;
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Une organisation est requise" },
        { status: 400 }
      );
    }

    // Créer l'utilisateur (sans clerkId - sera lié lors de la première connexion)
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || "READER",
        organizationId: orgId,
        clerkId: null, // Sera rempli lors de la connexion via Clerk
      },
      include: {
        organization: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'utilisateur" },
      { status: 500 }
    );
  }
}
