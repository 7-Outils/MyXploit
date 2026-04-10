import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/consumptions - List all consumptions
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");

    const where: Record<string, unknown> = { organizationId: effectiveOrgId };

    // Filter by source (e.g. source=EXPLOITANT,MANUAL)
    const sourceParam = searchParams.get("source");
    if (sourceParam) {
      const sources = sourceParam.split(",").map((s) => s.trim());
      where.source = sources.length === 1 ? sources[0] : { in: sources };
    }

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

    const consumptions = await prisma.consumption.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { period: "desc" },
    });

    return NextResponse.json(consumptions);
  } catch (error) {
    console.error("Error fetching consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des consommations" },
      { status: 500 }
    );
  }
}

// POST /api/consumptions - Create a new consumption record
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour ajouter une consommation" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const consumption = await prisma.consumption.create({
      data: {
        siteId: body.siteId,
        energyType: body.energyType,
        usage: body.usage || "MIXTE",
        source: "MANUAL",
        period: new Date(body.period),
        quantity: parseFloat(body.quantity),
        unit: body.unit,
        cost: body.cost ? parseFloat(body.cost) : null,
        djuReel: body.djuReel ? parseFloat(body.djuReel) : null,
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json(consumption, { status: 201 });
  } catch (error) {
    console.error("Error creating consumption:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout de la consommation" },
      { status: 500 }
    );
  }
}

// DELETE /api/consumptions - Delete consumptions by contract or site
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer des consommations" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");

    if (!siteId && !contractId) {
      return NextResponse.json(
        { error: "Veuillez spécifier un siteId ou contractId" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { organizationId: effectiveOrgId };

    // Collect siteIds for HeatingSeason deletion
    let affectedSiteIds: string[] = [];

    if (siteId) {
      where.siteId = siteId;
      affectedSiteIds = [siteId];
    } else if (contractId) {
      // Get all sites for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      affectedSiteIds = contractSites.map((cs) => cs.siteId);
      where.siteId = { in: affectedSiteIds };
    }

    // Delete consumptions
    const result = await prisma.consumption.deleteMany({ where });

    // Reset heating season dates (but keep engagement data: nb, nbUnit, djuContractuel)
    // This allows re-import to set new startDate/endDate while preserving per-season engagements
    if (affectedSiteIds.length > 0) {
      const seasons = await prisma.heatingSeason.findMany({
        where: { siteId: { in: affectedSiteIds } },
        select: { id: true },
      });

      for (const season of seasons) {
        await prisma.heatingSeason.update({
          where: { id: season.id },
          data: {
            startDate: null,
            endDate: null,
            lastReleveDate: null,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} consommation(s) supprimée(s), dates de chauffage réinitialisées`,
    });
  } catch (error) {
    console.error("Error deleting consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression des consommations" },
      { status: 500 }
    );
  }
}
