import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/quotes - List all quotes
export async function GET() {
  try {
    const user = await requireAuth();

    const quotes = await prisma.quote.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des devis" },
      { status: 500 }
    );
  }
}

// POST /api/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un devis" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const quote = await prisma.quote.create({
      data: {
        reference: body.reference,
        title: body.title,
        provider: body.provider,
        amount: parseFloat(body.amount),
        status: body.status || "BROUILLON",
        validUntil: new Date(body.validUntil),
        description: body.description,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du devis" },
      { status: 500 }
    );
  }
}
