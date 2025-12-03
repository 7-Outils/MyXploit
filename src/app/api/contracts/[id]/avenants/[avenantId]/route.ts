import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/contracts/[id]/avenants/[avenantId] - Get a single avenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; avenantId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId, avenantId } = await params;

    // Verify contract exists and belongs to organization
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: user.organizationId,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    const avenant = await prisma.avenant.findFirst({
      where: {
        id: avenantId,
        contractId,
      },
      include: {
        items: {
          include: {
            contractSite: {
              include: {
                site: {
                  select: { id: true, name: true, type: true },
                },
              },
            },
            equipment: {
              select: { id: true, name: true, type: true },
            },
          },
          orderBy: { effectiveDate: "asc" },
        },
        sitesEntrees: {
          include: {
            site: {
              select: { id: true, name: true, type: true },
            },
          },
        },
        sitesSorties: {
          include: {
            site: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    });

    if (!avenant) {
      return NextResponse.json(
        { error: "Avenant non trouvé" },
        { status: 404 }
      );
    }

    // Calculate totals
    const totalDeltaP1 = avenant.items.reduce((sum, item) => sum + (item.deltaP1 || 0), 0);
    const totalDeltaP2 = avenant.items.reduce((sum, item) => sum + (item.deltaP2 || 0), 0);
    const totalDeltaP3 = avenant.items.reduce((sum, item) => sum + (item.deltaP3 || 0), 0);

    return NextResponse.json({
      ...avenant,
      _totals: {
        deltaP1: totalDeltaP1,
        deltaP2: totalDeltaP2,
        deltaP3: totalDeltaP3,
        total: totalDeltaP1 + totalDeltaP2 + totalDeltaP3,
      },
    });
  } catch (error) {
    console.error("Error fetching avenant:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'avenant" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id]/avenants/[avenantId] - Delete an avenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; avenantId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId, avenantId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un avenant" },
        { status: 403 }
      );
    }

    // Verify contract exists and belongs to organization
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: user.organizationId,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Verify avenant exists and belongs to this contract
    const avenant = await prisma.avenant.findFirst({
      where: {
        id: avenantId,
        contractId,
      },
      include: {
        items: true,
        priceChanges: true,
        sitesEntrees: true,
        sitesSorties: true,
      },
    });

    if (!avenant) {
      return NextResponse.json(
        { error: "Avenant non trouvé" },
        { status: 404 }
      );
    }

    // Rollback changes made by this avenant
    // 1. Delete avenant items (cascade will handle this, but explicit for clarity)
    await prisma.avenantItem.deleteMany({
      where: { avenantId },
    });

    // 2. Delete price changes
    await prisma.contractSitePriceChange.deleteMany({
      where: { avenantId },
    });

    // 3. Remove sites that were added by this avenant
    for (const site of avenant.sitesEntrees) {
      await prisma.contractSite.delete({
        where: { id: site.id },
      });
    }

    // 4. Remove exitDate from sites that were removed by this avenant
    for (const site of avenant.sitesSorties) {
      await prisma.contractSite.update({
        where: { id: site.id },
        data: {
          exitDate: null,
          avenantSortieId: null,
        },
      });
    }

    // 5. Delete the avenant
    await prisma.avenant.delete({
      where: { id: avenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting avenant:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'avenant" },
      { status: 500 }
    );
  }
}
