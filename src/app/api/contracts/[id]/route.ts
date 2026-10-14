import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/contracts/[id] - Get a single contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const contract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
      include: {
        contractSites: {
          include: {
            site: {
              include: {
                equipments: true,
              },
            },
            priceChanges: {
              orderBy: { effectiveDate: "desc" },
              take: 5, // Derniers changements
            },
          },
        },
        avenants: {
          orderBy: { createdAt: "desc" },
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
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Add totals to each avenant
    const contractWithTotals = {
      ...contract,
      avenants: contract.avenants.map((avenant) => {
        const totalDeltaP1 = avenant.items.reduce((sum, item) => sum + (item.deltaP1 || 0), 0);
        const totalDeltaP2 = avenant.items.reduce((sum, item) => sum + (item.deltaP2 || 0), 0);
        const totalDeltaP3 = avenant.items.reduce((sum, item) => sum + (item.deltaP3 || 0), 0);
        return {
          ...avenant,
          _totals: {
            deltaP1: totalDeltaP1,
            deltaP2: totalDeltaP2,
            deltaP3: totalDeltaP3,
            total: totalDeltaP1 + totalDeltaP2 + totalDeltaP3,
          },
        };
      }),
    };

    return NextResponse.json(contractWithTotals);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du contrat" },
      { status: 500 }
    );
  }
}

// PUT /api/contracts/[id] - Update a contract
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un contrat" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const existingContract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Champs facultatifs : undefined = inchangé, "" ou null = effacé
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const date = (v: unknown) => {
      if (typeof v !== "string" || !v.trim()) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    if (body.reference !== undefined) updateData.reference = text(body.reference);
    if (body.title !== undefined) updateData.title = text(body.title);
    if (body.provider !== undefined) updateData.provider = text(body.provider);
    if (body.startDate !== undefined) updateData.startDate = date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = date(body.endDate);
    if (body.status) updateData.status = body.status;
    else if (existingContract.status === "EN_ATTENTE") {
      // Un contrat en attente devient actif dès qu'il a ses deux dates
      const start = updateData.startDate !== undefined ? updateData.startDate : existingContract.startDate;
      const end = updateData.endDate !== undefined ? updateData.endDate : existingContract.endDate;
      if (start && end) updateData.status = "ACTIF";
    }
    if (body.description !== undefined) updateData.description = body.description;
    // Year type and billing configuration
    if (body.yearType) updateData.yearType = body.yearType;
    if (body.yearStartMonth !== undefined) updateData.yearStartMonth = parseInt(body.yearStartMonth);
    if (body.yearStartDay !== undefined) updateData.yearStartDay = parseInt(body.yearStartDay);
    if (body.billingFrequency) updateData.billingFrequency = body.billingFrequency;
    if (body.djuContractuel !== undefined) updateData.djuContractuel = body.djuContractuel ? parseFloat(body.djuContractuel) : null;
    // Rattachement à un client (collectivité). null = détacher.
    const clientChanged = body.clientId !== undefined;
    if (clientChanged) updateData.clientId = body.clientId || null;

    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        contractSites: {
          include: {
            site: {
              select: { id: true, name: true, type: true, energyType: true },
            },
          },
        },
      },
    });

    // Quand on (dé)rattache le contrat à un client, on propage le client à tous
    // ses sites — c'est ce qui fait remonter le compteur "X sites" sur la fiche client.
    if (clientChanged) {
      const siteIds = contract.contractSites.map((cs) => cs.site.id);
      if (siteIds.length > 0) {
        await prisma.site.updateMany({
          where: { id: { in: siteIds }, organizationId: effectiveOrgId },
          data: { clientId: body.clientId || null },
        });
      }
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contrat" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id] - Delete a contract
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un contrat" },
        { status: 403 }
      );
    }

    const existingContract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
      include: {
        contractSites: {
          select: { siteId: true }
        }
      }
    });

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }


    // Le contrat et tous ses sites (avec leurs données) sont supprimés.
    const sitesToDelete = existingContract.contractSites.map((cs) => cs.siteId);

    await prisma.contract.delete({ where: { id } });
    if (sitesToDelete.length > 0) {
      await prisma.site.deleteMany({ where: { id: { in: sitesToDelete } } });
    }

    return NextResponse.json({
      success: true,
      deletedSites: sitesToDelete.length
    });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contrat" },
      { status: 500 }
    );
  }
}
