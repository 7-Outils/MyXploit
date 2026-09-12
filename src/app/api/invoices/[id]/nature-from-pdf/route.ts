import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { parseInvoiceWithGemini, explainAiError } from "@/lib/gemini-pdf-parser";
import { capPdfPages } from "@/lib/pdf-trim";
import { GEMINI_MODEL, estimateCostUsd, isAiConfigured } from "@/lib/ai-client";
import { checkAiBudget, recordAiUsage } from "@/lib/ai-usage";

// POST /api/invoices/[id]/nature-from-pdf — complète la NATURE (acompte,
// décompte, avoir, intéressement) d'une facture qui n'en a pas, en relisant
// son PDF archivé. Autorisé même sur une facture validée : on ne touche ni au
// montant, ni à la date, ni à l'état — on remplit un champ vide, c'est tout.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "READER") {
      return NextResponse.json({ error: "Vous n'avez pas les droits pour modifier une facture" }, { status: 403 });
    }
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const limit = await rateLimit(`invoice-nature:${user.id}`, "import");
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true, nature: true, documentUrl: true, contractId: true, contract: { select: { clientId: true } } },
    });
    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (invoice.nature) {
      return NextResponse.json({ error: "Cette facture a déjà une nature" }, { status: 409 });
    }
    if (!invoice.documentUrl) {
      return NextResponse.json({ error: "Aucun PDF joint à cette facture" }, { status: 400 });
    }
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "Clé IA de la plateforme absente (GEMINI_API_KEY)" }, { status: 503 });
    }
    const budget = await checkAiBudget(effectiveOrgId);
    if (!budget.allowed) {
      return NextResponse.json({ error: budget.message ?? "Plafond IA mensuel atteint" }, { status: 429 });
    }

    const pdfRes = await fetch(invoice.documentUrl);
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "PDF archivé inaccessible, réessayez" }, { status: 502 });
    }
    const { buffer } = await capPdfPages(Buffer.from(await pdfRes.arrayBuffer()));

    const result = await parseInvoiceWithGemini(buffer);
    await recordAiUsage({
      organizationId: effectiveOrgId,
      clientId: invoice.contract?.clientId ?? null,
      contractId: invoice.contractId,
      userId: user.id,
      feature: "INVOICE_NATURE",
      provider: "GEMINI",
      model: GEMINI_MODEL,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: estimateCostUsd(GEMINI_MODEL, result.usage.inputTokens, result.usage.outputTokens),
      durationMs: result.durationMs,
      ok: !!result.parsed,
      error: result.error,
    });

    if (!result.parsed) {
      return NextResponse.json({ error: `Lecture IA impossible : ${result.error ?? explainAiError(null)}` }, { status: 502 });
    }
    if (!result.parsed.nature) {
      return NextResponse.json({ error: "Nature non détectée sur le PDF" }, { status: 422 });
    }

    await prisma.invoice.update({ where: { id: invoice.id }, data: { nature: result.parsed.nature } });
    return NextResponse.json({ nature: result.parsed.nature });
  } catch (error) {
    console.error("Error reading invoice nature from PDF:", error);
    return NextResponse.json({ error: "Erreur lors de la lecture de la nature" }, { status: 500 });
  }
}
