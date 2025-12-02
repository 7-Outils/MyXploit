import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/equipments - List all equipments
export async function GET() {
  try {
    const user = await requireAuth();

    const equipments = await prisma.equipment.findMany({
      where: { organizationId: user.organizationId },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(equipments);
  } catch (error) {
    console.error("Error fetching equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des équipements" },
      { status: 500 }
    );
  }
}

// POST /api/equipments - Create a new equipment
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un équipement" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Verify the site belongs to the user's organization
    const site = await prisma.site.findFirst({
      where: {
        id: body.siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const equipment = await prisma.equipment.create({
      data: {
        name: body.name,
        type: body.type || "AUTRE",
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        power: body.power ? parseFloat(body.power) : null,
        status: body.status || "OPERATIONNEL",
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
        siteId: body.siteId,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'équipement" },
      { status: 500 }
    );
  }
}
