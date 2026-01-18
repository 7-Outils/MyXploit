import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const updateRecommendationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().nullable().optional(),
  priceUnit: z.enum(["HT", "TTC"]).optional(),
  category: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/recommendation-library/[id]
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

    const recommendation = await prisma.recommendationLibrary.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: "Préconisation non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error fetching recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la préconisation" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/recommendation-library/[id]
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

    // Vérifier que la préconisation appartient à l'organisation
    const existing = await prisma.recommendationLibrary.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Préconisation non trouvée" },
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

    const recommendation = await prisma.recommendationLibrary.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la préconisation" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/recommendation-library/[id]
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

    // Vérifier que la préconisation appartient à l'organisation
    const existing = await prisma.recommendationLibrary.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Préconisation non trouvée" },
        { status: 404 }
      );
    }

    // Soft delete - on désactive au lieu de supprimer
    await prisma.recommendationLibrary.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la préconisation" },
      { status: 500 }
    );
  }
}
