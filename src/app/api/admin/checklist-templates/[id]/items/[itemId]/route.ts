import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for update
const updateItemSchema = z.object({
  itemKey: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(500).optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  conformeText: z.string().min(1).optional(),
  nonConformeText: z.string().min(1).optional(),
  regulatoryReference: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/checklist-templates/[id]/items/[itemId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: templateId, itemId } = await params;

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

    const item = await prisma.checklistTemplateItem.findFirst({
      where: {
        id: itemId,
        templateId,
      },
      include: {
        recommendations: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'item" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/checklist-templates/[id]/items/[itemId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: templateId, itemId } = await params;

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

    // Vérifier que l'item existe
    const existing = await prisma.checklistTemplateItem.findFirst({
      where: {
        id: itemId,
        templateId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Item non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Si l'itemKey change, vérifier unicité
    if (validation.data.itemKey && validation.data.itemKey !== existing.itemKey) {
      const keyExists = await prisma.checklistTemplateItem.findFirst({
        where: {
          templateId,
          itemKey: validation.data.itemKey,
          id: { not: itemId },
        },
      });

      if (keyExists) {
        return NextResponse.json(
          { error: "Un item avec cette clé existe déjà dans ce template" },
          { status: 400 }
        );
      }
    }

    const item = await prisma.checklistTemplateItem.update({
      where: { id: itemId },
      data: validation.data,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'item" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/checklist-templates/[id]/items/[itemId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: templateId, itemId } = await params;

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

    // Vérifier que l'item existe
    const existing = await prisma.checklistTemplateItem.findFirst({
      where: {
        id: itemId,
        templateId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Item non trouvé" },
        { status: 404 }
      );
    }

    await prisma.checklistTemplateItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'item" },
      { status: 500 }
    );
  }
}
