import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sites/[id]/meters/[meterId] - Get a single meter with readings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const meter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
      include: {
        parent: {
          select: { id: true, name: true, reference: true, fluid: true },
        },
        children: {
          select: { id: true, name: true, reference: true, fluid: true, isDeductedFromParent: true },
        },
        readings: {
          orderBy: { readingDate: "desc" },
          take: 24, // Last 24 readings (2 years if monthly)
        },
      },
    });

    if (!meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(meter);
  } catch (error) {
    console.error("Error fetching meter:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du compteur" },
      { status: 500 }
    );
  }
}

// PUT /api/sites/[id]/meters/[meterId] - Update a meter
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un compteur" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const existingMeter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
    });

    if (!existingMeter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate parent meter if specified
    if (body.parentId && body.parentId !== existingMeter.parentId) {
      // Prevent circular reference
      if (body.parentId === meterId) {
        return NextResponse.json(
          { error: "Un compteur ne peut pas être son propre parent" },
          { status: 400 }
        );
      }

      const parentMeter = await prisma.meter.findFirst({
        where: {
          id: body.parentId,
          siteId,
        },
      });

      if (!parentMeter) {
        return NextResponse.json(
          { error: "Compteur parent non trouvé" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.reference !== undefined) updateData.reference = body.reference;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.fluid !== undefined) updateData.fluid = body.fluid;
    if (body.dataSource !== undefined) updateData.dataSource = body.dataSource;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.parentId !== undefined) updateData.parentId = body.parentId || null;
    if (body.isDeductedFromParent !== undefined) updateData.isDeductedFromParent = body.isDeductedFromParent;
    if (body.conversionCoefficient !== undefined) {
      updateData.conversionCoefficient = body.conversionCoefficient ? parseFloat(body.conversionCoefficient) : null;
    }
    if (body.conversionUnit !== undefined) updateData.conversionUnit = body.conversionUnit;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const meter = await prisma.meter.update({
      where: { id: meterId },
      data: updateData,
      include: {
        parent: {
          select: { id: true, name: true, reference: true },
        },
        children: {
          select: { id: true, name: true, reference: true, fluid: true },
        },
      },
    });

    return NextResponse.json(meter);
  } catch (error) {
    console.error("Error updating meter:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du compteur" },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]/meters/[meterId] - Delete a meter
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un compteur" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const existingMeter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
      include: {
        children: true,
      },
    });

    if (!existingMeter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    // Check if meter has children
    if (existingMeter.children.length > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer un compteur qui a des sous-compteurs. Supprimez d'abord les sous-compteurs." },
        { status: 400 }
      );
    }

    await prisma.meter.delete({ where: { id: meterId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meter:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du compteur" },
      { status: 500 }
    );
  }
}
