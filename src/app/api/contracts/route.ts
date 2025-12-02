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
        sites: {
          select: { id: true, name: true, type: true },
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

    // siteIds peut être un tableau ou un seul ID (rétrocompatibilité)
    const siteIds: string[] = Array.isArray(body.siteIds)
      ? body.siteIds
      : body.siteId
        ? [body.siteId]
        : [];

    const contract = await prisma.contract.create({
      data: {
        reference: body.reference,
        title: body.title,
        provider: body.provider,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        amountP1: parseFloat(body.amountP1),
        amountP2: parseFloat(body.amountP2),
        amountP3: parseFloat(body.amountP3),
        status: body.status || "ACTIF",
        description: body.description,
        sites: {
          connect: siteIds.map((id: string) => ({ id })),
        },
        organizationId: user.organizationId,
      },
      include: {
        sites: {
          select: { id: true, name: true, type: true },
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
