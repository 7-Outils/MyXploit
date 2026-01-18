import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Type pour un constat/finding
const findingSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  isConform: z.boolean(),
  recommendationId: z.string().nullable().optional(),
  reportText: z.string().optional(),
});

// Type pour un champ de valeur
const valueFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().optional(),
  type: z.enum(["number", "date", "text"]),
  thresholdMin: z.number().optional(),
  thresholdMax: z.number().optional(),
  interpretation: z.object({
    belowMin: z.string().optional(),
    withinRange: z.string().optional(),
    aboveMax: z.string().optional(),
  }).optional(),
});

// Validation schema
const updateCheckPointSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  category: z.enum(["REGLEMENTAIRE", "CONFORMITE", "SECURITE", "PERIODIQUE"]).optional(),
  description: z.string().nullable().optional(),
  responseType: z.enum(["YES_NO", "MULTI_CHOICE", "YES_NO_DATE", "YES_NO_VALUES"]).optional(),
  findings: z.array(findingSchema).optional(),
  valueFields: z.array(valueFieldSchema).nullable().optional(),
  regulatoryRef: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/audit-checkpoints/[id]
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

    const checkpoint = await prisma.auditCheckPoint.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!checkpoint) {
      return NextResponse.json(
        { error: "Point de contrôle non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(checkpoint);
  } catch (error) {
    console.error("Error fetching checkpoint:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du point de contrôle" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/audit-checkpoints/[id]
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

    // Vérifier que le checkpoint appartient à l'organisation
    const existing = await prisma.auditCheckPoint.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Point de contrôle non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateCheckPointSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Handle null values for JSON fields
    const updateData = {
      ...validation.data,
      valueFields: validation.data.valueFields === null
        ? Prisma.JsonNull
        : validation.data.valueFields,
    };

    const checkpoint = await prisma.auditCheckPoint.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(checkpoint);
  } catch (error) {
    console.error("Error updating checkpoint:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du point de contrôle" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/audit-checkpoints/[id]
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

    // Vérifier que le checkpoint appartient à l'organisation
    const existing = await prisma.auditCheckPoint.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Point de contrôle non trouvé" },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.auditCheckPoint.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting checkpoint:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du point de contrôle" },
      { status: 500 }
    );
  }
}
