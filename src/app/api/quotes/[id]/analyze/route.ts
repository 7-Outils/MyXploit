import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  extractQuoteItems,
  matchQuoteLines,
  type ExtractedItem,
  type CandidateRef,
} from "@/lib/gemini-price-analysis";
import { getGeminiApiKey } from "@/lib/gemini-key";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

export interface AnalysisLine {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalHT: number | null;
  // Référence trouvée dans la bibliothèque (source fiable)
  ref: {
    code: string;
    designation: string;
    unit: string | null;
    priceHT: number | null;
    source: string;
  } | null;
  // Estimation IA quand rien ne matche dans la bibliothèque
  aiEstimateHT: number | null;
  deviationPct: number | null;
  comment: string | null;
}

export interface PriceAnalysis {
  lines: AnalysisLine[];
  summary: {
    totalDevis: number;
    matched: number;
    estimated: number;
    unanalyzed: number;
    refSource: string | null;
  };
}

// Mots-clés de recherche : minuscules sans accents, mots de 4+ caractères
function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4)
    ),
  ].slice(0, 6);
}

// GET /api/quotes/[id]/analyze - Analyse enregistrée
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { priceAnalysis: true, analyzedAt: true, documentUrl: true },
    });
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    return NextResponse.json({
      analysis: quote.priceAnalysis,
      analyzedAt: quote.analyzedAt,
      hasPdf: !!quote.documentUrl,
    });
  } catch (error) {
    console.error("Error fetching quote analysis:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'analyse" },
      { status: 500 }
    );
  }
}

// POST /api/quotes/[id]/analyze - Lance (ou relance) l'analyse des prix
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
        { error: "Vous n'avez pas les droits pour lancer une analyse" },
        { status: 403 }
      );
    }

    const geminiKey = await getGeminiApiKey(effectiveOrgId);
    if (!geminiKey) {
      return NextResponse.json(
        { error: "Aucune clé API Gemini : ajoutez celle de votre organisation dans Paramètres → Clé API Gemini" },
        { status: 503 }
      );
    }

    const limit = await rateLimit(`quotes-analyze:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: { items: { orderBy: { lineNumber: "asc" } } },
    });
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    if (!quote.documentUrl) {
      return NextResponse.json(
        { error: "Ce devis n'a pas de PDF joint : analyse impossible" },
        { status: 400 }
      );
    }

    // 1. Lignes du devis : celles déjà extraites, sinon extraction Gemini du PDF
    let items: ExtractedItem[] = quote.items.map((it) => ({
      lineNumber: it.lineNumber,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      totalHT: it.totalHT,
    }));

    if (items.length === 0) {
      const pdfResponse = await fetch(quote.documentUrl);
      if (!pdfResponse.ok) {
        return NextResponse.json(
          { error: "Impossible de récupérer le PDF du devis" },
          { status: 502 }
        );
      }
      let extracted;
      try {
        extracted = await extractQuoteItems(Buffer.from(await pdfResponse.arrayBuffer()), geminiKey);
      } catch (geminiError) {
        return NextResponse.json(
          {
            error: `L'extraction IA du PDF a échoué : ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
          },
          { status: 502 }
        );
      }
      if (extracted === null || extracted.length === 0) {
        return NextResponse.json(
          { error: "Aucune ligne chiffrée détectée dans le PDF" },
          { status: 422 }
        );
      }
      items = extracted;
      await prisma.$transaction([
        prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
        prisma.quoteItem.createMany({
          data: extracted.map((it) => ({
            quoteId: id,
            lineNumber: it.lineNumber,
            description: it.description,
            quantity: it.quantity ?? 1,
            unit: it.unit ?? "U",
            unitPrice: it.unitPrice ?? 0,
            totalHT: it.totalHT ?? (it.quantity && it.unitPrice ? it.quantity * it.unitPrice : 0),
          })),
        }),
      ]);
    }

    // 2. Présélection de candidats dans le référentiel, par mots-clés
    const candidates: CandidateRef[][] = await Promise.all(
      items.map(async (item) => {
        const kws = keywords(item.description);
        if (kws.length === 0) return [];
        const refs = await prisma.priceReference.findMany({
          where: {
            organizationId: effectiveOrgId,
            OR: kws.map((k) => ({ designation: { contains: k, mode: "insensitive" as const } })),
          },
          select: { code: true, designation: true, unit: true, sellPriceHT: true },
          take: 12,
        });
        return refs;
      })
    );

    const refSourceRow = await prisma.priceReference.findFirst({
      where: { organizationId: effectiveOrgId },
      select: { source: true },
    });

    // 3. Matching + estimations par Gemini
    let matches;
    try {
      matches = await matchQuoteLines(items, candidates, geminiKey);
    } catch (geminiError) {
      return NextResponse.json(
        {
          error: `L'analyse IA a échoué : ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
        },
        { status: 502 }
      );
    }
    if (!matches) {
      return NextResponse.json(
        { error: "L'analyse IA a échoué, réessayez" },
        { status: 502 }
      );
    }

    // 4. Assemblage du résultat
    const codeIndex = new Map<string, CandidateRef>();
    for (const list of candidates) for (const c of list) codeIndex.set(c.code, c);

    const lines: AnalysisLine[] = items.map((item, i) => {
      const match = matches.find((m) => m.index === i);
      const ref = match?.matchedCode ? codeIndex.get(match.matchedCode) ?? null : null;
      const refPrice = ref?.sellPriceHT ?? null;
      const comparePrice = refPrice ?? match?.aiEstimateHT ?? null;
      const deviationPct =
        item.unitPrice != null && comparePrice != null && comparePrice > 0
          ? ((item.unitPrice - comparePrice) / comparePrice) * 100
          : null;
      return {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalHT: item.totalHT,
        ref: ref
          ? {
              code: ref.code,
              designation: ref.designation,
              unit: ref.unit,
              priceHT: ref.sellPriceHT,
              source: refSourceRow?.source ?? "Référentiel",
            }
          : null,
        aiEstimateHT: ref ? null : match?.aiEstimateHT ?? null,
        deviationPct,
        comment: match?.comment ?? null,
      };
    });

    const analysis: PriceAnalysis = {
      lines,
      summary: {
        totalDevis: lines.reduce((sum, l) => sum + (l.totalHT ?? 0), 0),
        matched: lines.filter((l) => l.ref).length,
        estimated: lines.filter((l) => !l.ref && l.aiEstimateHT != null).length,
        unanalyzed: lines.filter((l) => !l.ref && l.aiEstimateHT == null).length,
        refSource: refSourceRow?.source ?? null,
      },
    };

    const analyzedAt = new Date();
    await prisma.quote.update({
      where: { id },
      data: { priceAnalysis: analysis as object, analyzedAt },
    });

    return NextResponse.json({ analysis, analyzedAt });
  } catch (error) {
    console.error("Error analyzing quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du devis" },
      { status: 500 }
    );
  }
}
