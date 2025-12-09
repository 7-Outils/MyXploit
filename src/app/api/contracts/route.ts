import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/contracts - List all contracts
export async function GET() {
  try {
    const user = await requireAuth();

    const contracts = await prisma.contract.findMany({
      where: { organizationId: user.organizationId },
      include: {
        contractSites: {
          include: {
            site: {
              select: { id: true, name: true, type: true, energyType: true },
            },
          },
        },
        _count: {
          select: { contractSites: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contrats" },
      { status: 500 }
    );
  }
}

// POST /api/contracts - Create a new contract
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un contrat" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const contract = await prisma.contract.create({
      data: {
        reference: body.reference,
        title: body.title,
        provider: body.provider,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: body.status || "ACTIF",
        description: body.description,
        organizationId: user.organizationId,
        yearType: body.yearType || "HEATING_SEASON",
        billingFrequency: body.billingFrequency || "TRIMESTRIEL",
      },
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

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contrat" },
      { status: 500 }
    );
  }
}
