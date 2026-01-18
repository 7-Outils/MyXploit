import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createItemSchema = z.object({
  itemKey: z.string().min(1).max(100),
  label: z.string().min(1).max(500),
  category: z.string().min(1),
  description: z.string().nullable().optional(),
  conformeText: z.string().min(1),
  nonConformeText: z.string().min(1),
  regulatoryReference: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
});

// GET /api/admin/checklist-templates/[id]/items - Liste les items d'un template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: templateId } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    // Vérifier que le template appartient à l'organisation
    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: user.organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template non trouvé" },
        { status: 404 }
      );
    }

    const items = await prisma.checklistTemplateItem.findMany({
      where: { templateId },
      orderBy: { sortOrder: "asc" },
      include: {
        recommendations: true,
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des items" },
      { status: 500 }
    );
  }
}

// POST /api/admin/checklist-templates/[id]/items - Créer un nouvel item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: templateId } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    // Vérifier que le template appartient à l'organisation
    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: user.organizationId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Vérifier unicité de l'itemKey dans le template
    const existing = await prisma.checklistTemplateItem.findFirst({
      where: {
        templateId,
        itemKey: validation.data.itemKey,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un item avec cette clé existe déjà dans ce template" },
        { status: 400 }
      );
    }

    // Déterminer le sortOrder si non fourni
    let sortOrder = validation.data.sortOrder;
    if (sortOrder === undefined) {
      const lastItem = await prisma.checklistTemplateItem.findFirst({
        where: { templateId },
        orderBy: { sortOrder: "desc" },
      });
      sortOrder = (lastItem?.sortOrder ?? -1) + 1;
    }

    const item = await prisma.checklistTemplateItem.create({
      data: {
        ...validation.data,
        templateId,
        sortOrder,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'item" },
      { status: 500 }
    );
  }
}
