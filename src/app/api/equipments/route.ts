import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Default theoretical lifespan by equipment type (years)
const DEFAULT_LIFESPAN: Record<string, number> = {
  CHAUDIERE: 20,
  CLIMATISATION: 15,
  VMC: 15,
  PAC: 20,
  RADIATEUR: 30,
  PLANCHER_CHAUFFANT: 50,
  CTA: 20,
  AUTRE: 15,
};

// GET /api/equipments - List all equipments (optionally filter by siteId or contractId)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };

    if (siteId) {
      where.siteId = siteId;
    } else if (contractId) {
      // Get all sites for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      where.siteId = { in: contractSites.map((cs) => cs.siteId) };
    }

    const equipments = await prisma.equipment.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true, city: true },
        },
        audits: {
          orderBy: { auditDate: "desc" },
          take: 1, // Only latest audit
        },
        _count: {
          select: { audits: true },
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

    // Get default lifespan based on type if not provided
    const type = body.type || "AUTRE";
    const theoreticalLifespan = body.theoreticalLifespan
      ? parseInt(body.theoreticalLifespan)
      : DEFAULT_LIFESPAN[type] || 15;

    const equipment = await prisma.equipment.create({
      data: {
        name: body.name,
        type,
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        year: body.year ? parseInt(body.year) : null,
        power: body.power ? parseFloat(body.power) : null,
        location: body.location || null,
        level: body.level || null,
        theoreticalLifespan,
        status: body.status || "OPERATIONNEL",
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
        siteId: body.siteId,
        organizationId: user.organizationId,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
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
