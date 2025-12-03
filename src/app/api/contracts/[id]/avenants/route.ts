import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/contracts/[id]/avenants - List all avenants for a contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

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

    const avenants = await prisma.avenant.findMany({
      where: { contractId },
      include: {
        priceChanges: {
          include: {
            contractSite: {
              include: {
                site: {
                  select: { id: true, name: true },
                },
              },
            },
          },
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
      orderBy: { effectiveDate: "desc" },
    });

    return NextResponse.json(avenants);
  } catch (error) {
    console.error("Error fetching avenants:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des avenants" },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/avenants - Create a new avenant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un avenant" },
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

    // Prevent modifications on terminated or expired contracts
    if (contract.status === "RESILIE" || contract.status === "EXPIRE") {
      return NextResponse.json(
        { error: "Impossible de modifier un contrat résilié ou expiré" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Create the avenant
    const avenant = await prisma.avenant.create({
      data: {
        contractId,
        reference: body.reference,
        type: body.type,
        effectiveDate: new Date(body.effectiveDate),
        description: body.description,
        documentUrl: body.documentUrl,
      },
    });

    // If there are price changes for existing sites, create them
    if (body.priceChanges && Array.isArray(body.priceChanges)) {
      for (const change of body.priceChanges) {
        // Get current amounts from contractSite
        const contractSite = await prisma.contractSite.findUnique({
          where: { id: change.contractSiteId },
        });

        if (contractSite) {
          // Calculate new amounts (for reference in priceChange record)
          const newAmountP1 = change.deltaP1
            ? (contractSite.amountP1 || 0) + parseFloat(change.deltaP1)
            : contractSite.amountP1;
          const newAmountP2 = change.deltaP2
            ? (contractSite.amountP2 || 0) + parseFloat(change.deltaP2)
            : contractSite.amountP2;
          const newAmountP3 = change.deltaP3
            ? (contractSite.amountP3 || 0) + parseFloat(change.deltaP3)
            : contractSite.amountP3;

          // Create price change record
          // Note: On ne modifie PAS contractSite.amountP2/P3 - ce sont les montants de BASE
          await prisma.contractSitePriceChange.create({
            data: {
              contractSiteId: change.contractSiteId,
              avenantId: avenant.id,
              effectiveDate: new Date(body.effectiveDate),
              amountP1: newAmountP1,
              amountP2: newAmountP2,
              amountP3: newAmountP3,
              deltaP1: change.deltaP1 ? parseFloat(change.deltaP1) : null,
              deltaP2: change.deltaP2 ? parseFloat(change.deltaP2) : null,
              deltaP3: change.deltaP3 ? parseFloat(change.deltaP3) : null,
              reason: change.reason,
            },
          });
        }
      }
    }

    // Ajouter de nouveaux sites au contrat via l'avenant
    if (body.newSites && Array.isArray(body.newSites)) {
      for (const newSite of body.newSites) {
        // Vérifier que le site existe et appartient à l'organisation
        const site = await prisma.site.findFirst({
          where: {
            id: newSite.siteId,
            organizationId: user.organizationId,
          },
        });

        if (site) {
          // Créer le ContractSite avec integrationDate = date d'effet de l'avenant
          await prisma.contractSite.create({
            data: {
              contractId,
              siteId: newSite.siteId,
              contractType: newSite.contractType || "MC",
              hasP1: newSite.hasP1 || false,
              hasP2: newSite.hasP2 || false,
              hasP3: newSite.hasP3 || false,
              hasP4: newSite.hasP4 || false,
              amountP1: newSite.amountP1 ? parseFloat(newSite.amountP1) : null,
              amountP2: newSite.amountP2 ? parseFloat(newSite.amountP2) : null,
              amountP3: newSite.amountP3 ? parseFloat(newSite.amountP3) : null,
              integrationDate: new Date(body.effectiveDate),
              avenantEntreeId: avenant.id,
            },
          });
        }
      }
    }

    // Retirer des sites du contrat via l'avenant (mettre exitDate)
    if (body.removedSites && Array.isArray(body.removedSites)) {
      for (const removedSite of body.removedSites) {
        await prisma.contractSite.update({
          where: { id: removedSite.contractSiteId },
          data: {
            exitDate: new Date(body.effectiveDate),
            avenantSortieId: avenant.id,
          },
        });
      }
    }

    // Return the created avenant with relations
    const createdAvenant = await prisma.avenant.findUnique({
      where: { id: avenant.id },
      include: {
        priceChanges: {
          include: {
            contractSite: {
              include: {
                site: {
                  select: { id: true, name: true },
                },
              },
            },
          },
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

    return NextResponse.json(createdAvenant, { status: 201 });
  } catch (error) {
    console.error("Error creating avenant:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'avenant" },
      { status: 500 }
    );
  }
}
