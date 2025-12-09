import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/contracts/[id] - Get a single contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const contract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
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
        organizationId: user.organizationId,
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

    if (body.reference) updateData.reference = body.reference;
    if (body.title) updateData.title = body.title;
    if (body.provider) updateData.provider = body.provider;
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.status) updateData.status = body.status;
    if (body.description !== undefined) updateData.description = body.description;
    // Year type and billing configuration
    if (body.yearType) updateData.yearType = body.yearType;
    if (body.yearStartMonth !== undefined) updateData.yearStartMonth = parseInt(body.yearStartMonth);
    if (body.yearStartDay !== undefined) updateData.yearStartDay = parseInt(body.yearStartDay);
    if (body.billingFrequency) updateData.billingFrequency = body.billingFrequency;

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
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un contrat" },
        { status: 403 }
      );
    }

    const existingContract = await prisma.contract.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingContract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    await prisma.contract.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contrat" },
      { status: 500 }
    );
  }
}
