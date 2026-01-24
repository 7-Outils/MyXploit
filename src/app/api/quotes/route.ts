import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/quotes - List all quotes
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");

    const quotes = await prisma.quote.findMany({
      where: {
        organizationId: effectiveOrgId,
        ...(contractId && { contractId }),
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
        contract: { select: { id: true, reference: true, provider: true } },
        items: true,
      },
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
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un devis" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Récupérer le fournisseur du contrat si non fourni
    let provider = body.provider;
    if (!provider && body.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: body.contractId },
        select: { provider: true },
      });
      provider = contract?.provider || "Fournisseur";
    }

    const quote = await prisma.quote.create({
      data: {
        reference: body.reference || "DEV-" + Date.now(),
        title: body.title || "Devis importé",
        provider: provider || "Fournisseur",
        client: body.client || null,
        quoteType: body.quoteType || null,
        amountHT: parseFloat(body.amountHT || body.amount || 0),
        amountTVA: body.amountTVA ? parseFloat(body.amountTVA) : null,
        amountTTC: parseFloat(body.amountTTC || body.amount || 0),
        status: body.status || "BROUILLON",
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        description: body.description || null,
        siteId: body.siteId || null,
        contractId: body.contractId || null,
        organizationId: effectiveOrgId,
      },
      include: {
        site: { select: { id: true, name: true } },
        contract: { select: { id: true, reference: true } },
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
