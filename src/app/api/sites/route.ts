import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sites - List all sites for the organization
export async function GET() {
  try {
    const user = await requireAuth();

    const sites = await prisma.site.findMany({
      where: { organizationId: user.organizationId },
      include: {
        contractSites: {
          include: {
            contract: {
              select: { id: true, reference: true, provider: true, status: true },
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

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un site" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check for duplicate (case-insensitive name match)
    const existingSite = await prisma.site.findFirst({
      where: {
        organizationId: user.organizationId,
        name: {
          equals: body.name,
          mode: "insensitive",
        },
      },
    });

    if (existingSite) {
      return NextResponse.json(
        { error: `Un site avec le nom "${body.name}" existe déjà` },
        { status: 400 }
      );
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
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        image: body.image,
        organizationId: user.organizationId,
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
