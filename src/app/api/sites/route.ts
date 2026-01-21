import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";

// GET /api/sites - List all sites for the organization
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const sites = await prisma.site.findMany({
      where: { organizationId: effectiveOrgId },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        city: true,
        postalCode: true,
        surface: true,
        surfaceChauffee: true,
        energyType: true,
        annualBudget: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        contractSites: {
          include: {
            contract: {
              select: { id: true, reference: true, title: true, provider: true, status: true },
            },
          },
        },
        _count: {
          select: {
            equipments: true,
            consumptions: true,
            alerts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sites);
  } catch (error) {
    console.error("Error fetching sites:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des sites" },
      { status: 500 }
    );
  }
}

// POST /api/sites - Create a new site
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un site" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check for duplicate (case-insensitive name + city match)
    const existingSite = await prisma.site.findFirst({
      where: {
        organizationId: effectiveOrgId,
        name: {
          equals: body.name,
          mode: "insensitive",
        },
        city: {
          equals: body.city || "",
          mode: "insensitive",
        },
      },
    });

    if (existingSite) {
      const cityInfo = body.city ? ` à ${body.city}` : "";
      return NextResponse.json(
        { error: `Un site "${body.name}"${cityInfo} existe déjà` },
        { status: 400 }
      );
    }

    // Geocode address if coordinates not provided
    let latitude = body.latitude ? parseFloat(body.latitude) : null;
    let longitude = body.longitude ? parseFloat(body.longitude) : null;

    if (!latitude && !longitude && body.address && body.city) {
      const geoResult = await geocodeAddress(
        body.address,
        body.city,
        body.postalCode || ""
      );
      if (geoResult) {
        latitude = geoResult.latitude;
        longitude = geoResult.longitude;
      }
    }

    const site = await prisma.site.create({
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
        organizationId: effectiveOrgId,
        createdById: user.id,
      },
    });

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    console.error("Error creating site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du site" },
      { status: 500 }
    );
  }
}
