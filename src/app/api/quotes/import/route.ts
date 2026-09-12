import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { findSiteMatch, emptyParsedQuote, type ParsedQuote } from "@/lib/quote-import";
import { emptyParsedInvoice, type ParsedInvoice } from "@/lib/invoice-import";
import { parseWithGemini, parseInvoiceWithGemini } from "@/lib/gemini-pdf-parser";
import { trimPdfForAi } from "@/lib/pdf-trim";
import { GEMINI_MODEL, estimateCostUsd, isAiConfigured } from "@/lib/ai-client";
import { checkAiBudget, recordAiUsage } from "@/lib/ai-usage";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { archiveQuotePdfToR2 } from "@/lib/quote-pdf";

// Le PDF part intégralement en tokens d'entrée chez Gemini : sans plafond,
// un fichier volumineux ou une boucle de retry se paie directement.
const MAX_PDF_SIZE = 10 * 1024 * 1024;

export interface ImportResult {
  success: boolean;
  /** Forme devis par défaut, forme facture quand `kind=invoice` est envoyé. */
  parsed: ParsedQuote | ParsedInvoice;
  siteMatched: boolean;
  matchedSite?: { id: string; name: string };
  documentUrl?: string;
  error?: string;
  /** Ligne de consommation IA de cet import, à renvoyer à la création du devis. */
  aiUsageId?: string;
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

    const limit = await rateLimit(`quotes-import:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    // Get form data with PDF file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contractId = formData.get("contractId") as string | null;
    // Même tuyau pour les deux natures de pièce : seuls changent la consigne
    // IA, le dossier d'archive R2 et la ligne de consommation.
    const isInvoice = formData.get("kind") === "invoice";

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

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `Le PDF dépasse la taille maximale de ${MAX_PDF_SIZE / 1024 / 1024} Mo` },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Lecture IA seule, sans parser de secours : si elle n'a pas lieu, le
    // formulaire s'ouvre vide avec la cause. Une valeur devinée qui a l'air
    // vraie est pire qu'une case vide.
    let parsed: ParsedQuote | ParsedInvoice = isInvoice
      ? emptyParsedInvoice()
      : emptyParsedQuote();
    let source: "gemini" | "none" = "none";
    let aiError: string | null = null;
    let aiUsageId: string | null = null;

    // Client de rattachement : la consommation IA est suivie par collectivité,
    // et le contrat doit appartenir à l'organisation.
    let clientId: string | null = null;
    if (contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, organizationId: effectiveOrgId },
        select: { clientId: true },
      });
      clientId = contract?.clientId ?? null;
    }

    if (!isAiConfigured()) {
      aiError = "clé IA de la plateforme absente (GEMINI_API_KEY)";
    } else {
      // Plafond vérifié AVANT l'appel : une fois émis, il est facturé.
      const budget = await checkAiBudget(effectiveOrgId);
      if (!budget.allowed) {
        aiError = budget.message ?? "plafond IA mensuel atteint";
      } else {
        // Seules les premières pages partent chez Gemini ; l'archive R2 plus
        // bas reçoit toujours le PDF complet.
        const { buffer: aiBuffer } = await trimPdfForAi(buffer);
        // Consigne facture : elle connaît le P2 et le prorata multi-sites,
        // celle des devis classerait « conduite et entretien courant » en P1.
        const geminiResult = isInvoice
          ? await parseInvoiceWithGemini(aiBuffer)
          : await parseWithGemini(aiBuffer);
        if (geminiResult.parsed) {
          parsed = geminiResult.parsed;
          source = "gemini";
        } else {
          aiError = geminiResult.error;
        }

        const model = GEMINI_MODEL;
        aiUsageId = await recordAiUsage({
          organizationId: effectiveOrgId,
          clientId,
          contractId: contractId || null,
          userId: user.id,
          feature: isInvoice ? "INVOICE_IMPORT" : "QUOTE_IMPORT",
          provider: "GEMINI",
          model,
          inputTokens: geminiResult.usage.inputTokens,
          outputTokens: geminiResult.usage.outputTokens,
          costUsd: estimateCostUsd(
            model,
            geminiResult.usage.inputTokens,
            geminiResult.usage.outputTokens
          ),
          durationMs: geminiResult.durationMs,
          ok: !!geminiResult.parsed,
          error: geminiResult.error,
        });
      }
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

    // Archiver le PDF original dans R2 (rangé par nature puis client/contrat)
    // pour consultation ultérieure. Sans contractId, on ne stocke rien : on ne
    // saurait pas où ranger le fichier.
    let documentUrl: string | null = null;
    if (contractId) {
      documentUrl = await archiveQuotePdfToR2(
        buffer,
        file.name,
        contractId,
        effectiveOrgId,
        isInvoice ? "invoices" : "quotes"
      );
    }

    // Return parsed data for preview
    const result: ImportResult & { source?: string; aiError?: string } = {
      success: true,
      parsed,
      siteMatched: !!matchedSite,
      matchedSite: matchedSite || undefined,
      documentUrl: documentUrl || undefined,
      source,
      aiError: aiError || undefined,
      // Renvoyé au front pour rattacher la ligne de consommation au devis
      // une fois celui-ci créé.
      aiUsageId: aiUsageId || undefined,
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
