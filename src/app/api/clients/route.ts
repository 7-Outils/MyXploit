import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// Résumé des marchés d'un client, lu par le portefeuille /clients
// (exploitant, statut, échéance) sans charger la fiche complète.
const contractSummarySelect = {
  id: true,
  reference: true,
  title: true,
  provider: true,
  status: true,
  startDate: true,
  endDate: true,
  _count: { select: { contractSites: true } },
} as const;

// GET /api/clients - Liste des clients de l'organisation, avec leurs marchés
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const clients = await prisma.client.findMany({
      where: { organizationId: effectiveOrgId },
      include: {
        contracts: {
          select: contractSummarySelect,
          orderBy: { endDate: "asc" },
        },
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
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Le nom du client est requis" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name: String(name).trim(),
        organizationId: effectiveOrgId,
      },
      include: {
        contracts: { select: contractSummarySelect },
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
