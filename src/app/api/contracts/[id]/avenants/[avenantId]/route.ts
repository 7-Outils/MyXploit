import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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
    // 1. Delete price changes
    await prisma.contractSitePriceChange.deleteMany({
      where: { avenantId },
    });

    // 2. Remove sites that were added by this avenant
    for (const site of avenant.sitesEntrees) {
      await prisma.contractSite.delete({
        where: { id: site.id },
      });
    }

    // 3. Remove exitDate from sites that were removed by this avenant
    for (const site of avenant.sitesSorties) {
      await prisma.contractSite.update({
        where: { id: site.id },
        data: {
          exitDate: null,
          avenantSortieId: null,
        },
      });
    }

    // 4. Delete the avenant
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
