import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/consumptions - List all consumptions
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");

    const where: Record<string, unknown> = { organizationId: user.organizationId };
    if (siteId) {
      where.siteId = siteId;
    }

    const consumptions = await prisma.consumption.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { period: "desc" },
    });

    return NextResponse.json(consumptions);
  } catch (error) {
    console.error("Error fetching consumptions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des consommations" },
      { status: 500 }
    );
  }
}

// POST /api/consumptions - Create a new consumption record
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour ajouter une consommation" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const consumption = await prisma.consumption.create({
      data: {
        siteId: body.siteId,
        energyType: body.energyType,
        usage: body.usage || "MIXTE",
        period: new Date(body.period),
        quantity: parseFloat(body.quantity),
        unit: body.unit,
        cost: body.cost ? parseFloat(body.cost) : null,
        djuReel: body.djuReel ? parseFloat(body.djuReel) : null,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(consumption, { status: 201 });
  } catch (error) {
    console.error("Error creating consumption:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout de la consommation" },
      { status: 500 }
    );
  }
}
