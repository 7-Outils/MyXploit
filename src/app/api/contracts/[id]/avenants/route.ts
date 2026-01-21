import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { AvenantItemType } from "@/generated/prisma/enums";

// GET /api/contracts/[id]/avenants - List all avenants for a contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    // Verify contract exists and belongs to organization
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: effectiveOrgId,
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
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals for each avenant
    const avenantsWithTotals = avenants.map((avenant) => {
      const totalDeltaP1 = avenant.items.reduce((sum, item) => sum + (item.deltaP1 || 0), 0);
      const totalDeltaP2 = avenant.items.reduce((sum, item) => sum + (item.deltaP2 || 0), 0);
      const totalDeltaP3 = avenant.items.reduce((sum, item) => sum + (item.deltaP3 || 0), 0);
      const totalDelta = totalDeltaP1 + totalDeltaP2 + totalDeltaP3;

      return {
        ...avenant,
        _totals: {
          deltaP1: totalDeltaP1,
          deltaP2: totalDeltaP2,
          deltaP3: totalDeltaP3,
          total: totalDelta,
        },
      };
    });

    return NextResponse.json(avenantsWithTotals);
  } catch (error) {
    console.error("Error fetching avenants:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des avenants" },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/avenants - Create a new avenant with items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
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
        organizationId: effectiveOrgId,
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
        signatureDate: body.signatureDate ? new Date(body.signatureDate) : null,
        description: body.description,
        documentUrl: body.documentUrl,
      },
    });

    // Process each item in the avenant
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        const itemType = item.type as AvenantItemType;
        const effectiveDate = new Date(item.effectiveDate);

        // Create the avenant item
        const avenantItem = await prisma.avenantItem.create({
          data: {
            avenantId: avenant.id,
            type: itemType,
            effectiveDate,
            description: item.description,
            contractSiteId: item.contractSiteId || null,
            equipmentId: item.equipmentId || null,
            deltaP1: item.deltaP1 ? parseFloat(item.deltaP1) : null,
            deltaP2: item.deltaP2 ? parseFloat(item.deltaP2) : null,
            deltaP3: item.deltaP3 ? parseFloat(item.deltaP3) : null,
            newAmountP1: item.newAmountP1 ? parseFloat(item.newAmountP1) : null,
            newAmountP2: item.newAmountP2 ? parseFloat(item.newAmountP2) : null,
            newAmountP3: item.newAmountP3 ? parseFloat(item.newAmountP3) : null,
          },
        });

        // Handle specific item types
        switch (itemType) {
          case "AJOUT_SITE":
            // Add a new site to the contract
            if (item.siteId) {
              // Verify site exists and belongs to organization
              const site = await prisma.site.findFirst({
                where: {
                  id: item.siteId,
                  organizationId: effectiveOrgId,
                },
              });

              if (site) {
                await prisma.contractSite.create({
                  data: {
                    contractId,
                    siteId: item.siteId,
                    contractType: item.contractType || "MC",
                    hasP1: item.hasP1 || false,
                    hasP2: item.hasP2 || false,
                    hasP3: item.hasP3 || false,
                    hasP4: item.hasP4 || false,
                    amountP1: item.amountP1 ? parseFloat(item.amountP1) : null,
                    amountP2: item.amountP2 ? parseFloat(item.amountP2) : null,
                    amountP3: item.amountP3 ? parseFloat(item.amountP3) : null,
                    integrationDate: effectiveDate,
                    avenantEntreeId: avenant.id,
                  },
                });
              }
            }
            break;

          case "RETRAIT_SITE":
            // Remove a site from the contract
            if (item.contractSiteId) {
              await prisma.contractSite.update({
                where: { id: item.contractSiteId },
                data: {
                  exitDate: effectiveDate,
                  avenantSortieId: avenant.id,
                },
              });
            }
            break;

          case "MODIFICATION_PRIX_P1":
          case "MODIFICATION_PRIX_P2":
          case "MODIFICATION_PRIX_P3":
            // Create price change record for historical tracking
            if (item.contractSiteId) {
              const contractSite = await prisma.contractSite.findUnique({
                where: { id: item.contractSiteId },
              });

              if (contractSite) {
                // Calculate new amounts based on deltas
                const newAmountP1 = item.deltaP1
                  ? (contractSite.amountP1 || 0) + parseFloat(item.deltaP1)
                  : contractSite.amountP1;
                const newAmountP2 = item.deltaP2
                  ? (contractSite.amountP2 || 0) + parseFloat(item.deltaP2)
                  : contractSite.amountP2;
                const newAmountP3 = item.deltaP3
                  ? (contractSite.amountP3 || 0) + parseFloat(item.deltaP3)
                  : contractSite.amountP3;

                // Create legacy price change record
                await prisma.contractSitePriceChange.create({
                  data: {
                    contractSiteId: item.contractSiteId,
                    avenantId: avenant.id,
                    effectiveDate,
                    amountP1: newAmountP1,
                    amountP2: newAmountP2,
                    amountP3: newAmountP3,
                    deltaP1: item.deltaP1 ? parseFloat(item.deltaP1) : null,
                    deltaP2: item.deltaP2 ? parseFloat(item.deltaP2) : null,
                    deltaP3: item.deltaP3 ? parseFloat(item.deltaP3) : null,
                    reason: item.description,
                  },
                });

                // Update avenantItem with new amounts
                await prisma.avenantItem.update({
                  where: { id: avenantItem.id },
                  data: {
                    newAmountP1,
                    newAmountP2,
                    newAmountP3,
                  },
                });
              }
            }
            break;

          // Other types don't need special handling for now
          default:
            break;
        }
      }
    }

    // Return the created avenant with all relations
    const createdAvenant = await prisma.avenant.findUnique({
      where: { id: avenant.id },
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

    // Calculate totals
    const totalDeltaP1 = createdAvenant?.items.reduce((sum, item) => sum + (item.deltaP1 || 0), 0) || 0;
    const totalDeltaP2 = createdAvenant?.items.reduce((sum, item) => sum + (item.deltaP2 || 0), 0) || 0;
    const totalDeltaP3 = createdAvenant?.items.reduce((sum, item) => sum + (item.deltaP3 || 0), 0) || 0;

    return NextResponse.json({
      ...createdAvenant,
      _totals: {
        deltaP1: totalDeltaP1,
        deltaP2: totalDeltaP2,
        deltaP3: totalDeltaP3,
        total: totalDeltaP1 + totalDeltaP2 + totalDeltaP3,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating avenant:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'avenant" },
      { status: 500 }
    );
  }
}
