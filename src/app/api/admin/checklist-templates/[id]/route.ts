import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for update
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().min(1).optional(),
  equipmentTypes: z.array(z.string()).min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/checklist-templates/[id] - Récupérer un template
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

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            recommendations: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du template" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/checklist-templates/[id] - Modifier un template
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

    // Vérifier que le template appartient à l'organisation
    const existing = await prisma.checklistTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Si le nom change, vérifier unicité
    if (validation.data.name && validation.data.name !== existing.name) {
      const nameExists = await prisma.checklistTemplate.findFirst({
        where: {
          organizationId: user.organizationId,
          name: validation.data.name,
          id: { not: id },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: "Un template avec ce nom existe déjà" },
          { status: 400 }
        );
      }
    }

    const template = await prisma.checklistTemplate.update({
      where: { id },
      data: validation.data,
      include: { items: true },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du template" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/checklist-templates/[id] - Supprimer un template
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

    // Vérifier que le template appartient à l'organisation
    const existing = await prisma.checklistTemplate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template non trouvé" },
        { status: 404 }
      );
    }

    await prisma.checklistTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du template" },
      { status: 500 }
    );
  }
}
