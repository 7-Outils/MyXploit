import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  parseQuotePDF,
  findSiteMatch,
  ParsedQuote,
} from "@/lib/pdf-parser";

export interface ImportResult {
  success: boolean;
  quote?: {
    id: string;
    reference: string;
    provider: string | null;
    amountHT: number | null;
    amountTTC: number | null;
    site: { id: string; name: string } | null;
    itemsCount: number;
  };
  parsed: ParsedQuote;
  siteMatched: boolean;
  error?: string;
}

// POST /api/quotes/import - Import a quote from PDF
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer un devis" },
        { status: 403 }
      );
    }

    // Get form data with PDF file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const autoCreate = formData.get("autoCreate") === "true";
    const siteId = formData.get("siteId") as string | null;
    const contractId = formData.get("contractId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier PDF fourni" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Le fichier doit être un PDF" },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse PDF
    const parsed = await parseQuotePDF(buffer);

    // Find matching site if not provided
    let matchedSite: { id: string; name: string } | null = null;

    if (siteId) {
      // Verify site exists and belongs to organization
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          organizationId: user.organizationId,
        },
        select: { id: true, name: true },
      });
      matchedSite = site;
    } else if (parsed.siteName || parsed.siteCity) {
      // Try to find matching site
      const sites = await prisma.site.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true, city: true, address: true },
      });
      matchedSite = findSiteMatch(parsed.siteName, parsed.siteCity, sites);
    }

    // Verify contract if provided
    let validContractId: string | null = null;
    if (contractId) {
      const contract = await prisma.contract.findFirst({
        where: {
          id: contractId,
          organizationId: user.organizationId,
        },
      });
      if (contract) {
        validContractId = contract.id;
      }
    }

    // If autoCreate is true, create the quote
    if (autoCreate) {
      if (!parsed.reference) {
        return NextResponse.json(
          {
            error: "Impossible de créer le devis: référence non trouvée dans le PDF",
            parsed
          },
          { status: 400 }
        );
      }

      // Check if quote with same reference already exists
      const existingQuote = await prisma.quote.findFirst({
        where: {
          reference: parsed.reference,
          organizationId: user.organizationId,
        },
      });

      if (existingQuote) {
        return NextResponse.json(
          {
            error: `Un devis avec la référence ${parsed.reference} existe déjà`,
            existingQuoteId: existingQuote.id,
            parsed
          },
          { status: 409 }
        );
      }

      // Create quote with items
      const quote = await prisma.quote.create({
        data: {
          reference: parsed.reference,
          title: `Devis ${parsed.reference}`,
          provider: parsed.provider || "Fournisseur inconnu",
          client: parsed.client,
          amountHT: parsed.amountHT || 0,
          amountTVA: parsed.amountTVA,
          amountTTC: parsed.amountTTC || 0,
          status: "BROUILLON",
          issueDate: parsed.issueDate || new Date(),
          validUntil: parsed.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          siteId: matchedSite?.id || null,
          contractId: validContractId,
          organizationId: user.organizationId,
          items: {
            create: parsed.items.map((item) => ({
              lineNumber: item.lineNumber,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalHT: item.totalHT,
              tvaRate: item.tvaRate,
            })),
          },
        },
        include: {
          site: { select: { id: true, name: true } },
          items: true,
        },
      });

      const result: ImportResult = {
        success: true,
        quote: {
          id: quote.id,
          reference: quote.reference,
          provider: quote.provider,
          amountHT: quote.amountHT,
          amountTTC: quote.amountTTC,
          site: quote.site,
          itemsCount: quote.items.length,
        },
        parsed,
        siteMatched: !!matchedSite,
      };

      return NextResponse.json(result, { status: 201 });
    }

    // Return parsed data for preview
    const result: ImportResult = {
      success: true,
      parsed,
      siteMatched: !!matchedSite,
      quote: matchedSite ? {
        id: "",
        reference: parsed.reference || "",
        provider: parsed.provider,
        amountHT: parsed.amountHT,
        amountTTC: parsed.amountTTC,
        site: matchedSite,
        itemsCount: parsed.items.length,
      } : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error importing quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import du devis", details: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
