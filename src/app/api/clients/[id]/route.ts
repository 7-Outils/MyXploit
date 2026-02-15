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
            title: true,
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
        name: body.name ?? existing.name,
        siret: body.siret !== undefined ? body.siret : existing.siret,
        contactName: body.contactName !== undefined ? body.contactName : existing.contactName,
        contactEmail: body.contactEmail !== undefined ? body.contactEmail : existing.contactEmail,
        contactPhone: body.contactPhone !== undefined ? body.contactPhone : existing.contactPhone,
        address: body.address !== undefined ? body.address : existing.address,
        city: body.city !== undefined ? body.city : existing.city,
        postalCode: body.postalCode !== undefined ? body.postalCode : existing.postalCode,
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

// DELETE /api/clients/[id] - Supprimer un client (detache sites/contrats)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut supprimer un client" },
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

    // Detacher sites et contrats avant suppression
    await prisma.$transaction([
      prisma.site.updateMany({ where: { clientId: id }, data: { clientId: null } }),
      prisma.contract.updateMany({ where: { clientId: id }, data: { clientId: null } }),
      prisma.client.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du client" },
      { status: 500 }
    );
  }
}
