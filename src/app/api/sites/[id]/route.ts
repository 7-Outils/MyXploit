import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sites/[id] - Get a single site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const site = await prisma.site.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        contracts: true,
        equipments: true,
        consumptions: {
          orderBy: { period: "desc" },
          take: 12,
        },
        alerts: {
          where: { isRead: false },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(site);
  } catch (error) {
    console.error("Error fetching site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du site" },
      { status: 500 }
    );
  }
}

// PUT /api/sites/[id] - Update a site
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier ce site" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const existingSite = await prisma.site.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingSite) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const site = await prisma.site.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        surface: body.surface ? parseFloat(body.surface) : null,
        energyType: body.energyType,
        annualBudget: body.annualBudget ? parseFloat(body.annualBudget) : null,
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        image: body.image,
      },
    });

    return NextResponse.json(site);
  } catch (error) {
    console.error("Error updating site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du site" },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id] - Delete a site
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Seuls les administrateurs peuvent supprimer un site" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const existingSite = await prisma.site.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingSite) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    await prisma.site.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du site" },
      { status: 500 }
    );
  }
}
