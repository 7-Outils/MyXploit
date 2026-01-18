import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for update
const updateRecommendationSchema = z.object({
  checklistItemId: z.string().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  defaultCostMin: z.number().min(0).nullable().optional(),
  defaultCostMax: z.number().min(0).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/recommendation-templates/[id]
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

    const recommendation = await prisma.recommendationTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        checklistItem: {
          select: {
            id: true,
            label: true,
            category: true,
            template: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: "Recommandation non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error fetching recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la recommandation" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/recommendation-templates/[id]
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

    // Vérifier que la recommandation appartient à l'organisation
    const existing = await prisma.recommendationTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recommandation non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateRecommendationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Si lié à un nouvel item, vérifier qu'il appartient à l'organisation
    if (
      validation.data.checklistItemId &&
      validation.data.checklistItemId !== existing.checklistItemId
    ) {
      const item = await prisma.checklistTemplateItem.findFirst({
        where: {
          id: validation.data.checklistItemId,
          template: { organizationId: user.organizationId },
        },
      });

      if (!item) {
        return NextResponse.json(
          { error: "Item de checklist non trouvé" },
          { status: 404 }
        );
      }
    }

    const recommendation = await prisma.recommendationTemplate.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de la recommandation" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/recommendation-templates/[id]
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

    // Vérifier que la recommandation appartient à l'organisation
    const existing = await prisma.recommendationTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recommandation non trouvée" },
        { status: 404 }
      );
    }

    await prisma.recommendationTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la recommandation" },
      { status: 500 }
    );
  }
}
