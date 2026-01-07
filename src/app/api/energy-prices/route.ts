import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { PriceType } from "@/generated/prisma/client";

// GET /api/energy-prices - Get latest reference prices
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type") as PriceType | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 12;

    // Build query filters
    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    // Get prices ordered by date desc
    const prices = await prisma.energyPrice.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
    });

    // Get latest price for each type
    const latestPrices = await prisma.energyPrice.groupBy({
      by: ["type"],
      _max: {
        date: true,
      },
    });

    const latestByType: Record<string, unknown> = {};
    for (const item of latestPrices) {
      const latest = await prisma.energyPrice.findFirst({
        where: {
          type: item.type,
          date: item._max.date || undefined,
        },
        orderBy: { date: "desc" },
      });
      if (latest) {
        latestByType[item.type] = latest;
      }
    }

    return NextResponse.json({
      success: true,
      prices,
      latest: latestByType,
    });
  } catch (error) {
    console.error("Error fetching energy prices:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des prix" },
      { status: 500 }
    );
  }
}

// POST /api/energy-prices - Add new price entry
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour ajouter des prix" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, value, date, source, notes } = body;

    if (!type || !value || !date) {
      return NextResponse.json(
        { error: "Type, valeur et date sont obligatoires" },
        { status: 400 }
      );
    }

    // Validate type
    if (!Object.values(PriceType).includes(type)) {
      return NextResponse.json(
        { error: "Type de prix invalide" },
        { status: 400 }
      );
    }

    const price = await prisma.energyPrice.create({
      data: {
        type,
        value: parseFloat(value),
        date: new Date(date),
        source,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      price,
    });
  } catch (error) {
    console.error("Error creating energy price:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du prix" },
      { status: 500 }
    );
  }
}

// DELETE /api/energy-prices?id=... - Delete price entry
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer des prix" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID obligatoire" },
        { status: 400 }
      );
    }

    await prisma.energyPrice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting energy price:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du prix" },
      { status: 500 }
    );
  }
}
