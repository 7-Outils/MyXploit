import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createRecommendationSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(200),
  description: z.string().optional(),
  price: z.number().positive("Le prix doit être positif").optional(),
  priceUnit: z.enum(["HT", "TTC"]).default("HT"),
  category: z.string().optional(),
  priority: z.number().int().min(1).max(4).default(3),
});

// GET /api/admin/recommendation-library - Liste toutes les préconisations
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
    const category = searchParams.get("category");

    const recommendations = await prisma.recommendationLibrary.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des préconisations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/recommendation-library - Créer une nouvelle préconisation
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

    const recommendation = await prisma.recommendationLibrary.create({
      data: {
        ...validation.data,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(recommendation, { status: 201 });
  } catch (error) {
    console.error("Error creating recommendation:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la préconisation" },
      { status: 500 }
    );
  }
}
