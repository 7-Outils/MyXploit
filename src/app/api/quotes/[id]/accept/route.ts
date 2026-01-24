import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour accepter un devis" },
        { status: 403 }
      );
    }

    // Check if quote exists and belongs to user's organization
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
      select: { organizationId: true, status: true },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { error: "Devis introuvable" },
        { status: 404 }
      );
    }

    if (existingQuote.organizationId !== effectiveOrgId) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Update quote status to ACCEPTE
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        status: "ACCEPTE",
        acceptedBy: user.id,
        acceptedAt: new Date(),
      },
      include: {
        site: { select: { id: true, name: true } },
        contract: { select: { id: true, reference: true } },
      },
    });

    return NextResponse.json(updatedQuote);
  } catch (error) {
    console.error("Error accepting quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'acceptation du devis" },
      { status: 500 }
    );
  }
}
