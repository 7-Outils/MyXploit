import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/heating-seasons/[id] - Récupérer une saison de chauffage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const heatingSeason = await prisma.heatingSeason.findUnique({
      where: { id },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            city: true,
            postalCode: true,
            organizationId: true,
          },
        },
      },
    });

    if (!heatingSeason) {
      return NextResponse.json({ error: "Saison non trouvée" }, { status: 404 });
    }

    // Check organization
    if (heatingSeason.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(heatingSeason);
  } catch (error) {
    console.error("Error fetching heating season:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la saison de chauffage" },
      { status: 500 }
    );
  }
}

// PUT /api/heating-seasons/[id] - Mettre à jour une saison de chauffage
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Get existing record
    const existing = await prisma.heatingSeason.findUnique({
      where: { id },
      include: {
        site: {
          select: { organizationId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Saison non trouvée" }, { status: 404 });
    }

    // Check organization
    if (existing.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { startDate, endDate, startIndex, startIndexUnit, endIndex, notes, nb, nbUnit, djuContractuel } = body;

    const heatingSeason = await prisma.heatingSeason.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : endDate === null ? null : undefined,
        startIndex: startIndex !== undefined ? (startIndex ? parseFloat(startIndex) : null) : undefined,
        startIndexUnit: startIndexUnit !== undefined ? startIndexUnit : undefined,
        endIndex: endIndex !== undefined ? (endIndex ? parseFloat(endIndex) : null) : undefined,
        notes: notes !== undefined ? notes : undefined,
        nb: nb !== undefined ? (nb !== null ? parseFloat(nb) : null) : undefined,
        nbUnit: nbUnit !== undefined ? nbUnit : undefined,
        djuContractuel: djuContractuel !== undefined ? (djuContractuel !== null ? parseFloat(djuContractuel) : null) : undefined,
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json(heatingSeason);
  } catch (error) {
    console.error("Error updating heating season:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la saison de chauffage" },
      { status: 500 }
    );
  }
}

// DELETE /api/heating-seasons/[id] - Supprimer une saison de chauffage
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Get existing record
    const existing = await prisma.heatingSeason.findUnique({
      where: { id },
      include: {
        site: {
          select: { organizationId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Saison non trouvée" }, { status: 404 });
    }

    // Check organization
    if (existing.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.heatingSeason.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting heating season:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la saison de chauffage" },
      { status: 500 }
    );
  }
}
