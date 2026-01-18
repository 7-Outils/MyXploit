import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createCategorySchema = z.object({
  key: z.string().min(1).max(50).regex(/^[A-Z_]+$/, "La clé doit être en majuscules avec underscores"),
  label: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  icon: z.string().nullable().optional(),
});

// GET /api/admin/checklist-categories - Liste toutes les catégories
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const categories = await prisma.checklistCategory.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des catégories" },
      { status: 500 }
    );
  }
}

// POST /api/admin/checklist-categories - Créer une nouvelle catégorie
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Vérifier unicité de la clé
    const existing = await prisma.checklistCategory.findFirst({
      where: {
        organizationId: user.organizationId,
        key: validation.data.key,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Une catégorie avec cette clé existe déjà" },
        { status: 400 }
      );
    }

    // Déterminer le sortOrder si non fourni
    let sortOrder = validation.data.sortOrder;
    if (sortOrder === undefined) {
      const lastCategory = await prisma.checklistCategory.findFirst({
        where: { organizationId: user.organizationId },
        orderBy: { sortOrder: "desc" },
      });
      sortOrder = (lastCategory?.sortOrder ?? -1) + 1;
    }

    const category = await prisma.checklistCategory.create({
      data: {
        ...validation.data,
        organizationId: user.organizationId,
        sortOrder,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la catégorie" },
      { status: 500 }
    );
  }
}
