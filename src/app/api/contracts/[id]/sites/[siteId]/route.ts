import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// PUT /api/contracts/[id]/sites/[siteId] - Update a site's contract type and prestations
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; siteId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId, siteId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un contrat" },
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

    // Find the contract-site relationship
    const existingContractSite = await prisma.contractSite.findUnique({
      where: {
        contractId_siteId: {
          contractId,
          siteId,
        },
      },
    });

    if (!existingContractSite) {
      return NextResponse.json(
        { error: "Ce site n'est pas dans ce contrat" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Update the contract-site relationship
    const contractSite = await prisma.contractSite.update({
      where: {
        contractId_siteId: {
          contractId,
          siteId,
        },
      },
      data: {
        contractType: body.contractType,
        hasP1: body.hasP1,
        hasP2: body.hasP2,
        hasP3: body.hasP3,
        hasP4: body.hasP4,
        amountP1: body.amountP1 !== undefined ? (body.amountP1 ? parseFloat(body.amountP1) : null) : undefined,
        amountP2: body.amountP2 !== undefined ? (body.amountP2 ? parseFloat(body.amountP2) : null) : undefined,
        amountP3: body.amountP3 !== undefined ? (body.amountP3 ? parseFloat(body.amountP3) : null) : undefined,
        coefficientPCS: body.coefficientPCS !== undefined ? (body.coefficientPCS ? parseFloat(body.coefficientPCS) : null) : undefined,
      },
      include: {
        site: {
          select: { id: true, name: true, type: true, energyType: true },
        },
      },
    });

    return NextResponse.json(contractSite);
  } catch (error) {
    console.error("Error updating contract site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du site dans le contrat" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id]/sites/[siteId] - Remove a site from a contract
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; siteId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId, siteId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un contrat" },
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

    // Delete the contract-site relationship
    await prisma.contractSite.delete({
      where: {
        contractId_siteId: {
          contractId,
          siteId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing site from contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du site du contrat" },
      { status: 500 }
    );
  }
}
