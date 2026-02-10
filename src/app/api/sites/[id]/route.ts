import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";

// GET /api/sites/[id] - Get a single site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const site = await prisma.site.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
      include: {
        contractSites: {
          include: {
            contract: {
              select: {
                id: true,
                reference: true,
                title: true,
              },
            },
          },
        },
        equipments: true,
        meters: {
          where: { parentId: null }, // Only root meters (tree structure)
          include: {
            children: {
              include: {
                children: true,
                _count: { select: { readings: true } },
              },
              orderBy: { name: "asc" },
            },
            _count: { select: { readings: true } },
          },
          orderBy: { name: "asc" },
        },
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
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
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
        organizationId: effectiveOrgId,
      },
    });

    if (!existingSite) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Geocode if address/city provided and no coordinates given
    let latitude = body.latitude ? parseFloat(body.latitude) : null;
    let longitude = body.longitude ? parseFloat(body.longitude) : null;

    const addressChanged = body.address !== existingSite.address || body.city !== existingSite.city;
    const needsGeocode = (!latitude && !longitude) && (body.address && body.city);

    if (needsGeocode || (addressChanged && !latitude && !longitude)) {
      const geoResult = await geocodeAddress(
        body.address || "",
        body.city || "",
        body.postalCode || ""
      );
      if (geoResult) {
        latitude = geoResult.latitude;
        longitude = geoResult.longitude;
      }
    }

    const site = await prisma.site.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        surface: body.surface ? parseFloat(body.surface) : null,
        surfaceChauffee: body.surfaceChauffee ? parseFloat(body.surfaceChauffee) : null,
        energyType: body.energyType,
        nb: body.nb ? parseFloat(body.nb) : null,
        nbUnit: body.nbUnit || null,
        pce: body.pce || null,
        pdl: body.pdl || null,
        rae: body.rae || null,
        annualBudget: body.annualBudget ? parseFloat(body.annualBudget) : null,
        latitude,
        longitude,
        image: body.image,
        // Caractéristiques bâtiment
        ...(body.constructionYear !== undefined && {
          constructionYear: body.constructionYear ? parseInt(body.constructionYear) : null,
        }),
        ...(body.numberOfFloors !== undefined && {
          numberOfFloors: body.numberOfFloors ? parseInt(body.numberOfFloors) : null,
        }),
        ...(body.buildingHeight !== undefined && {
          buildingHeight: body.buildingHeight ? parseFloat(body.buildingHeight) : null,
        }),
        ...(body.volumeChauffee !== undefined && {
          volumeChauffee: body.volumeChauffee ? parseFloat(body.volumeChauffee) : null,
        }),
        ...(body.insulationLevel !== undefined && { insulationLevel: body.insulationLevel || null }),
        ...(body.glazingType !== undefined && { glazingType: body.glazingType || null }),
        ...(body.ventilationType !== undefined && { ventilationType: body.ventilationType || null }),
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
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
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
        organizationId: effectiveOrgId,
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
