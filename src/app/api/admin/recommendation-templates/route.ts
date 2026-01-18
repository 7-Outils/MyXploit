import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createRecommendationSchema = z.object({
  checklistItemId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  defaultCostMin: z.number().min(0).nullable().optional(),
  defaultCostMax: z.number().min(0).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  category: z.string().nullable().optional(),
});

// GET /api/admin/recommendation-templates - Liste toutes les recommandations
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const checklistItemId = searchParams.get("checklistItemId");

    const where: { organizationId: string; checklistItemId?: string | null } = {
      organizationId: user.organizationId,
    };

    if (checklistItemId) {
      where.checklistItemId = checklistItemId;
    }

    const recommendations = await prisma.recommendationTemplate.findMany({
      where,
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
      orderBy: [{ priority: "asc" }, { title: "asc" }],
    });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des recommandations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/recommendation-templates - Créer une nouvelle recommandation
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
    const validation = createRecommendationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Si lié à un item, vérifier qu'il appartient à l'organisation
    if (validation.data.checklistItemId) {
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

    const recommendation = await prisma.recommendationTemplate.create({
      data: {
        ...validation.data,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(recommendation, { status: 201 });
  } catch (error) {
    console.error("Error creating recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la recommandation" },
      { status: 500 }
    );
  }
}
