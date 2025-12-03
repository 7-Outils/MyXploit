import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/contracts/[id]/sites - Add a site to a contract with its type and prestations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

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

    const body = await request.json();

    // Check if site exists and belongs to organization
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

    // Check if site is already in contract
    const existingContractSite = await prisma.contractSite.findUnique({
      where: {
        contractId_siteId: {
          contractId,
          siteId: body.siteId,
        },
      },
    });

    if (existingContractSite) {
      return NextResponse.json(
        { error: "Ce site est déjà dans ce contrat" },
        { status: 400 }
      );
    }

    // Create the contract-site relationship
    const contractSite = await prisma.contractSite.create({
      data: {
        contractId,
        siteId: body.siteId,
        contractType: body.contractType || "MC",
        hasP1: body.hasP1 || false,
        hasP2: body.hasP2 || false,
        hasP3: body.hasP3 || false,
        hasP4: body.hasP4 || false,
        amountP1: body.amountP1 ? parseFloat(body.amountP1) : null,
        amountP2: body.amountP2 ? parseFloat(body.amountP2) : null,
        amountP3: body.amountP3 ? parseFloat(body.amountP3) : null,
      },
      include: {
        site: {
          select: { id: true, name: true, type: true, energyType: true },
        },
      },
    });

    return NextResponse.json(contractSite, { status: 201 });
  } catch (error) {
    console.error("Error adding site to contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du site au contrat" },
      { status: 500 }
    );
  }
}
