import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/clients/[id] - Detail d'un client avec sites et contrats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        sites: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            city: true,
            postalCode: true,
            energyType: true,
            surface: true,
            _count: { select: { equipments: true, alerts: true } },
          },
          orderBy: { name: "asc" },
        },
        contracts: {
          select: {
            id: true,
            reference: true,
            provider: true,
            startDate: true,
            endDate: true,
            status: true,
            _count: { select: { contractSites: true } },
          },
          orderBy: { endDate: "asc" },
        },
        _count: { select: { sites: true, contracts: true } },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client non trouve" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation du client" },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Modifier un client
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
        { error: "Vous n'avez pas les droits pour modifier un client" },
        { status: 403 }
      );
    }

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Client non trouve" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Supprimer un client ET ses contrats, leurs sites et leurs données (cascade)
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
        { error: "Vous n'avez pas les droits pour supprimer un client" },
        { status: 403 }
      );
    }

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: { _count: { select: { sites: true, contracts: true, missions: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Client non trouve" },
        { status: 404 }
      );
    }


    // Les missions AMO referencent obligatoirement un client (pas de SetNull)
    if (existing._count.missions > 0) {
      return NextResponse.json(
        {
          error: `Ce client a ${existing._count.missions} mission(s). Supprimez ou reaffectez-les avant de supprimer le client.`,
        },
        { status: 409 }
      );
    }

    // Cascade : contrats du client, tous les sites de ces contrats, les sites directs du client, le client.
    const contracts = await prisma.contract.findMany({
      where: { clientId: id },
      select: { id: true, contractSites: { select: { siteId: true } } },
    });
    const contractIds = contracts.map((c) => c.id);
    const siteIds = Array.from(new Set(contracts.flatMap((c) => c.contractSites.map((cs) => cs.siteId))));

    await prisma.$transaction([
      ...(contractIds.length ? [prisma.contract.deleteMany({ where: { id: { in: contractIds } } })] : []),
      ...(siteIds.length ? [prisma.site.deleteMany({ where: { id: { in: siteIds } } })] : []),
      prisma.site.deleteMany({ where: { clientId: id } }),
      prisma.client.delete({ where: { id } }),
    ]);

    return NextResponse.json({
      success: true,
      deletedContracts: contractIds.length,
      deletedSites: siteIds.length,
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du client" },
      { status: 500 }
    );
  }
}
