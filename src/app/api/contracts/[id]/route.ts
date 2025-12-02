import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/contracts/[id] - Get a single contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const contract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        sites: {
          include: {
            equipments: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du contrat" },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - Update a contract
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un contrat" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const existingContract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.reference) updateData.reference = body.reference;
    if (body.title) updateData.title = body.title;
    if (body.provider) updateData.provider = body.provider;
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.amountP1) updateData.amountP1 = parseFloat(body.amountP1);
    if (body.amountP2) updateData.amountP2 = parseFloat(body.amountP2);
    if (body.amountP3) updateData.amountP3 = parseFloat(body.amountP3);
    if (body.status) updateData.status = body.status;
    if (body.description !== undefined) updateData.description = body.description;

    // Handle sites update (many-to-many)
    if (body.siteIds !== undefined) {
      updateData.sites = {
        set: body.siteIds.map((siteId: string) => ({ id: siteId })),
      };
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        sites: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contrat" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - Delete a contract
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un contrat" },
        { status: 403 }
      );
    }

    const existingContract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    await prisma.contract.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contrat" },
      { status: 500 }
    );
  }
}
