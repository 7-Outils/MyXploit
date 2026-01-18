import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().min(1),
  equipmentTypes: z.array(z.string()).min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/admin/checklist-templates - Liste tous les templates
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const templates = await prisma.checklistTemplate.findMany({
      where: { organizationId: user.organizationId },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { items: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des templates" },
      { status: 500 }
    );
  }
}

// POST /api/admin/checklist-templates - Créer un nouveau template
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
    const validation = createTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Vérifier unicité du nom
    const existing = await prisma.checklistTemplate.findFirst({
      where: {
        organizationId: user.organizationId,
        name: validation.data.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un template avec ce nom existe déjà" },
        { status: 400 }
      );
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        ...validation.data,
        organizationId: user.organizationId,
      },
      include: { items: true },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du template" },
      { status: 500 }
    );
  }
}
