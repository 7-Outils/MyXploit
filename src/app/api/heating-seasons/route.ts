import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/heating-seasons - Liste des saisons de chauffage
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get("siteId");
    const season = searchParams.get("season");
    const contractId = searchParams.get("contractId");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (siteId) {
      // Verify site belongs to user's organization
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: effectiveOrgId },
      });
      if (!site) {
        return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
      }
      where.siteId = siteId;
    } else if (contractId) {
      // Get all site IDs for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      where.siteId = { in: contractSites.map((cs) => cs.siteId) };
    } else {
      // All sites of the organization
      const sites = await prisma.site.findMany({
        where: { organizationId: effectiveOrgId },
        select: { id: true },
      });
      where.siteId = { in: sites.map((s) => s.id) };
    }

    if (season) {
      where.season = season;
    }

    const heatingSeasons = await prisma.heatingSeason.findMany({
      where,
      include: {
        site: {
          select: {
            id: true,
            name: true,
            city: true,
            postalCode: true,
          },
        },
      },
      orderBy: [{ season: "desc" }, { startDate: "desc" }],
    });

    return NextResponse.json(heatingSeasons);
  } catch (error) {
    console.error("Error fetching heating seasons:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des saisons de chauffage" },
      { status: 500 }
    );
  }
}

// POST /api/heating-seasons - Créer une saison de chauffage
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();

    const { siteId, season, startDate, endDate, startIndex, startIndexUnit, endIndex, notes, nb, nbUnit, djuContractuel } = body;

    if (!siteId || !season) {
      return NextResponse.json(
        { error: "siteId et season sont requis" },
        { status: 400 }
      );
    }

    // Verify site belongs to user's organization
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
    });
    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    // Check if season already exists for this site
    const existing = await prisma.heatingSeason.findUnique({
      where: { siteId_season: { siteId, season } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Une saison existe déjà pour ce site et cette période" },
        { status: 409 }
      );
    }

    const heatingSeason = await prisma.heatingSeason.create({
      data: {
        siteId,
        season,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        startIndex: startIndex ? parseFloat(startIndex) : null,
        startIndexUnit,
        endIndex: endIndex ? parseFloat(endIndex) : null,
        notes,
        nb: nb !== null && nb !== undefined ? parseFloat(nb) : null,
        nbUnit: nb ? nbUnit : null,
        djuContractuel: djuContractuel !== null && djuContractuel !== undefined ? parseFloat(djuContractuel) : null,
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

    return NextResponse.json(heatingSeason, { status: 201 });
  } catch (error) {
    console.error("Error creating heating season:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la saison de chauffage" },
      { status: 500 }
    );
  }
}
