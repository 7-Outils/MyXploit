import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/equipments/[id] - Get a single equipment with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        site: {
          select: { id: true, name: true, city: true, address: true },
        },
        audits: {
          orderBy: { auditDate: "desc" },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'équipement" },
      { status: 500 }
    );
  }
}

// PUT /api/equipments/[id] - Update an equipment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier cet équipement" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const existingEquipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingEquipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        name: body.name || null,
        domain: body.domain,
        type: body.type,
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        year: body.year ? parseInt(body.year) : null,
        power: body.power ? parseFloat(body.power) : null,
        quantity: body.quantity ? parseInt(body.quantity) : null,
        location: body.location || null,
        level: body.level || null,
        theoreticalLifespan: body.theoreticalLifespan
          ? parseInt(body.theoreticalLifespan)
          : null,
        status: body.status,
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error updating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'équipement" },
      { status: 500 }
    );
  }
}

// DELETE /api/equipments/[id] - Delete an equipment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Seuls les administrateurs peuvent supprimer un équipement" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const existingEquipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingEquipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    await prisma.equipment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'équipement" },
      { status: 500 }
    );
  }
}
