import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sites/[id]/meters - List all meters for a site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId } = await params;

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

    const meters = await prisma.meter.findMany({
      where: { siteId },
      include: {
        parent: {
          select: { id: true, name: true, reference: true },
        },
        children: {
          select: { id: true, name: true, reference: true, fluid: true },
        },
        _count: {
          select: { readings: true },
        },
      },
      orderBy: [
        { type: "asc" }, // PRINCIPAL first
        { fluid: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(meters);
  } catch (error) {
    console.error("Error fetching meters:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des compteurs" },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/meters - Create a new meter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un compteur" },
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

    const body = await request.json();

    // Validate parent meter if specified
    if (body.parentId) {
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

    const meter = await prisma.meter.create({
      data: {
        siteId,
        name: body.name,
        reference: body.reference || null,
        type: body.type || "DIVISIONNAIRE",
        fluid: body.fluid,
        dataSource: body.dataSource || "MANUEL",
        unit: body.unit || "m3",
        parentId: body.parentId || null,
        isDeductedFromParent: body.isDeductedFromParent || false,
        conversionCoefficient: body.conversionCoefficient ? parseFloat(body.conversionCoefficient) : null,
        conversionUnit: body.conversionUnit || null,
        isActive: true,
      },
      include: {
        parent: {
          select: { id: true, name: true, reference: true },
        },
      },
    });

    return NextResponse.json(meter, { status: 201 });
  } catch (error) {
    console.error("Error creating meter:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compteur" },
      { status: 500 }
    );
  }
}
