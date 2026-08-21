import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  extractQuoteItems,
  matchQuoteLines,
  generateSearchQueries,
  type ExtractedItem,
  type CandidateRef,
} from "@/lib/gemini-price-analysis";
import { getOrgAi } from "@/lib/ai-key";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

export interface AnalysisLine {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalHT: number | null;
  // Composition de référence : les ouvrages du référentiel dont la somme
  // représente la prestation de la ligne (principal + dépose + raccordement...)
  refs: { code: string; designation: string; unit: string | null; priceHT: number | null }[];
  refTotalHT: number | null; // total HT de référence de la ligne (qté comprise)
  refSource: string | null;
  // Estimation IA du total HT de la ligne, quand rien ne matche
  aiEstimateHT: number | null;
  deviationPct: number | null; // total devis vs total référence
  comment: string | null;
}

export interface PriceAnalysis {
  lines: AnalysisLine[];
  summary: {
    totalDevis: number;
    totalRef: number;
    verdict: "TRES_BIEN_PLACE" | "CORRECT" | "ELEVE" | "TRES_ELEVE" | "INDETERMINE";
    commentary: string;
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

    const aiCfg = await getOrgAi(effectiveOrgId);
    if (!aiCfg) {
      return NextResponse.json(
        { error: "Aucune clé API IA : ajoutez celle de votre organisation dans Paramètres → Fournisseur IA" },
        { status: 503 }
      );
    }

    const limit = await rateLimit(`quotes-analyze:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        items: { orderBy: { lineNumber: "asc" } },
        site: { select: { name: true, city: true } },
      },
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
        extracted = await extractQuoteItems(Buffer.from(await pdfResponse.arrayBuffer()), aiCfg);
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

    // 2. Présélection de candidats dans le référentiel. L'IA génère d'abord
    // des expressions de recherche ciblant l'ouvrage principal de chaque
    // ligne (sinon une ligne "chauffe-eau + raccords" ne remonte que des
    // coudes) ; les mots-clés bruts restent en secours.
    let searchQueries: string[][] = items.map(() => []);
    try {
      searchQueries = await generateSearchQueries(items, aiCfg);
    } catch (error) {
      console.error("AI search query generation failed, keyword fallback:", error);
    }

    const refSelect = { code: true, designation: true, corpsEtat: true, unit: true, sellPriceHT: true };
    const searchAnd = (words: string[], take: number) =>
      prisma.priceReference.findMany({
        where: {
          organizationId: effectiveOrgId,
          AND: words.map((w) => ({ designation: { contains: w, mode: "insensitive" as const } })),
        },
        select: refSelect,
        take,
      });

    const candidates: CandidateRef[][] = await Promise.all(
      items.map(async (item, i) => {
        const found = new Map<string, CandidateRef>();

        // Recherches IA : tous les mots de l'expression doivent matcher (AND),
        // avec assouplissement progressif — "chauffe-eau électrique 300" ne
        // matche pas "Chauffe-eau 300 L blindé", mais "chauffe-eau 300" oui.
        for (const expr of searchQueries[i]) {
          const words = expr.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);
          if (words.length === 0) continue;
          let refs = await searchAnd(words, 8);
          if (refs.length === 0 && words.length > 2) {
            // On garde le premier mot (le sujet) et les nombres (dimensions)
            const core = [words[0], ...words.slice(1).filter((w) => /\d/.test(w))].slice(0, 3);
            refs = await searchAnd(core, 8);
          }
          if (refs.length === 0 && words.length > 1) {
            refs = await searchAnd([words[0]], 5);
          }
          for (const r of refs) found.set(r.code, r);
        }

        // Secours mots-clés (OR) si la recherche IA a trop peu ramené
        if (found.size < 4) {
          const kws = keywords(item.description);
          if (kws.length > 0) {
            const refs = await prisma.priceReference.findMany({
              where: {
                organizationId: effectiveOrgId,
                OR: kws.map((k) => ({ designation: { contains: k, mode: "insensitive" as const } })),
              },
              select: refSelect,
              take: 12 - found.size,
            });
            for (const r of refs) if (!found.has(r.code)) found.set(r.code, r);
          }
        }

        return [...found.values()].slice(0, 20);
      })
    );

    const refSourceRow = await prisma.priceReference.findFirst({
      where: { organizationId: effectiveOrgId },
      select: { source: true },
    });

    // 3. Composition, estimations et verdict par l'IA
    let matchResult;
    try {
      matchResult = await matchQuoteLines(items, candidates, aiCfg, {
        reference: quote.reference,
        title: quote.title,
        siteName: quote.site ? `${quote.site.name}${quote.site.city ? ` (${quote.site.city})` : ""}` : null,
        quoteType: quote.quoteType,
        amountHT: quote.amountHT,
        amountTVA: quote.amountTVA,
        amountTTC: quote.amountTTC,
        issueDate: quote.issueDate ? quote.issueDate.toISOString().slice(0, 10) : null,
      });
    } catch (geminiError) {
      return NextResponse.json(
        {
          error: `L'analyse IA a échoué : ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
        },
        { status: 502 }
      );
    }
    if (!matchResult) {
      return NextResponse.json(
        { error: "L'analyse IA a échoué, réessayez" },
        { status: 502 }
      );
    }
    const matches = matchResult.lines;

    // 4. Assemblage du résultat
    const codeIndex = new Map<string, CandidateRef>();
    for (const list of candidates) for (const c of list) codeIndex.set(c.code, c);

    const lines: AnalysisLine[] = items.map((item, i) => {
      const match = matches.find((m) => m.index === i);
      const refs = (match?.refCodes ?? [])
        .map((code) => codeIndex.get(code))
        .filter((r): r is CandidateRef => !!r)
        .map((r) => ({ code: r.code, designation: r.designation, unit: r.unit, priceHT: r.sellPriceHT }));
      const refTotalHT = refs.length > 0 ? match?.refTotalHT ?? null : null;
      const aiEstimateHT = refs.length === 0 ? match?.aiEstimateHT ?? null : null;
      const compareTotal = refTotalHT ?? aiEstimateHT;
      const deviationPct =
        item.totalHT != null && compareTotal != null && compareTotal > 0
          ? ((item.totalHT - compareTotal) / compareTotal) * 100
          : null;
      return {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalHT: item.totalHT,
        refs,
        refTotalHT,
        refSource: refs.length > 0 ? refSourceRow?.source ?? "Référentiel" : null,
        aiEstimateHT,
        deviationPct,
        comment: match?.comment ?? null,
      };
    });

    const analysis: PriceAnalysis = {
      lines,
      summary: {
        totalDevis: lines.reduce((sum, l) => sum + (l.totalHT ?? 0), 0),
        totalRef: lines.reduce(
          (sum, l) => sum + (l.refTotalHT ?? l.aiEstimateHT ?? l.totalHT ?? 0),
          0
        ),
        verdict: matchResult.verdict,
        commentary: matchResult.commentary,
        matched: lines.filter((l) => l.refs.length > 0).length,
        estimated: lines.filter((l) => l.refs.length === 0 && l.aiEstimateHT != null).length,
        unanalyzed: lines.filter((l) => l.refs.length === 0 && l.aiEstimateHT == null).length,
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
