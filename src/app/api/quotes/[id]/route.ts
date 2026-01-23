import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { handleQuoteStatusChange } from "@/lib/work-order-hooks";

// GET /api/quotes/[id] - Get a single quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const quote = await prisma.quote.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Devis non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du devis" },
      { status: 500 }
    );
  }
}

// PUT /api/quotes/[id] - Update a quote
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
        { error: "Vous n'avez pas les droits pour modifier un devis" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const existingQuote = await prisma.quote.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { error: "Devis non trouvé" },
        { status: 404 }
      );
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        ...(body.reference && { reference: body.reference }),
        ...(body.title && { title: body.title }),
        ...(body.provider && { provider: body.provider }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.amount && { amount: parseFloat(body.amount) }),
        ...(body.validUntil && { validUntil: new Date(body.validUntil) }),
      },
    });

    // Hook: Créer automatiquement un WorkOrder si le devis est accepté/commandé
    if (body.status && body.status !== existingQuote.status) {
      try {
        await handleQuoteStatusChange(id, body.status);
      } catch (error) {
        console.error("Erreur lors de la création du WorkOrder:", error);
        // Ne pas bloquer la mise à jour du devis si le WorkOrder échoue
      }
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du devis" },
      { status: 500 }
    );
  }
}

// DELETE /api/quotes/[id] - Delete a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un devis" },
        { status: 403 }
      );
    }

    const existingQuote = await prisma.quote.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { error: "Devis non trouvé" },
        { status: 404 }
      );
    }

    await prisma.quote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du devis" },
      { status: 500 }
    );
  }
}
