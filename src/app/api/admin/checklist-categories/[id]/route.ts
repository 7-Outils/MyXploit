import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for update
const updateCategorySchema = z.object({
  key: z.string().min(1).max(50).regex(/^[A-Z_]+$/, "La clé doit être en majuscules avec underscores").optional(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  icon: z.string().nullable().optional(),
});

// GET /api/admin/checklist-categories/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const category = await prisma.checklistCategory.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Catégorie non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la catégorie" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/checklist-categories/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    // Vérifier que la catégorie appartient à l'organisation
    const existing = await prisma.checklistCategory.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Catégorie non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Si la clé change, vérifier unicité
    if (validation.data.key && validation.data.key !== existing.key) {
      const keyExists = await prisma.checklistCategory.findFirst({
        where: {
          organizationId: user.organizationId,
          key: validation.data.key,
          id: { not: id },
        },
      });

      if (keyExists) {
        return NextResponse.json(
          { error: "Une catégorie avec cette clé existe déjà" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.checklistCategory.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de la catégorie" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/checklist-categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    // Vérifier que la catégorie appartient à l'organisation
    const existing = await prisma.checklistCategory.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Catégorie non trouvée" },
        { status: 404 }
      );
    }

    await prisma.checklistCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la catégorie" },
      { status: 500 }
    );
  }
}
