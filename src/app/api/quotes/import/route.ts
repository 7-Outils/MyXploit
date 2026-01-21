import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  parseQuotePDF,
  findSiteMatch,
  ParsedQuote,
} from "@/lib/pdf-parser";

export interface ImportResult {
  success: boolean;
  parsed: ParsedQuote;
  siteMatched: boolean;
  matchedSite?: { id: string; name: string };
  error?: string;
}

// POST /api/quotes/import - Import a quote from PDF
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer un devis" },
        { status: 403 }
      );
    }

    // Get form data with PDF file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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
    let parsed;
    try {
      parsed = await parseQuotePDF(buffer);
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError);
      return NextResponse.json(
        { error: "Erreur lors de l'analyse du PDF", details: pdfError instanceof Error ? pdfError.message : String(pdfError) },
        { status: 400 }
      );
    }

    // Try to find matching site
    let matchedSite: { id: string; name: string } | null = null;

    if (parsed.siteName || parsed.siteCity) {
      const sites = await prisma.site.findMany({
        where: { organizationId: effectiveOrgId },
        select: { id: true, name: true, city: true, address: true },
      });
      matchedSite = findSiteMatch(parsed.siteName, parsed.siteCity, sites);
    }

    // Return parsed data for preview
    const result: ImportResult = {
      success: true,
      parsed,
      siteMatched: !!matchedSite,
      matchedSite: matchedSite || undefined,
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
