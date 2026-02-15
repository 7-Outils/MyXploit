import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/clients - Liste des clients de l'organisation
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const clients = await prisma.client.findMany({
      where: { organizationId: effectiveOrgId },
      include: {
        _count: {
          select: {
            sites: true,
            contracts: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des clients" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Creer un client
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour creer un client" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, siret, contactName, contactEmail, contactPhone, address, city, postalCode } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Le nom du client est requis" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name,
        siret: siret || null,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        organizationId: effectiveOrgId,
      },
      include: {
        _count: {
          select: { sites: true, contracts: true },
        },
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation du client" },
      { status: 500 }
    );
  }
}
