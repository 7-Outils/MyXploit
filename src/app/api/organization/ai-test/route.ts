import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { aiJson, GEMINI_MODEL, estimateCostUsd, isAiConfigured } from "@/lib/ai-client";
import { explainAiError } from "@/lib/gemini-pdf-parser";
import { recordAiUsage } from "@/lib/ai-usage";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

// POST /api/organization/ai-test — appel minimal réel à Google Gemini avec la
// clé de la plateforme, pour savoir en deux secondes si elle est acceptée et
// par quel modèle, plutôt que de le découvrir sur un import de devis raté.
export async function POST() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const limit = await rateLimit(`ai-test:${user.id}`, "import");
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    if (!isAiConfigured()) {
      return NextResponse.json({
        ok: false,
        message: "Clé IA de la plateforme absente (GEMINI_API_KEY sur Vercel).",
      });
    }

    const model = GEMINI_MODEL;
    const startedAt = Date.now();
    // Le test consomme des tokens comme n'importe quel appel : il est suivi
    // au même titre, sans client ni contrat rattaché.
    const track = (
      ok: boolean,
      usage: { inputTokens: number; outputTokens: number },
      error?: string
    ) =>
      recordAiUsage({
        organizationId: effectiveOrgId,
        userId: user.id,
        feature: "KEY_TEST",
        provider: "GEMINI",
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: estimateCostUsd(model, usage.inputTokens, usage.outputTokens),
        durationMs: Date.now() - startedAt,
        ok,
        error: error ?? null,
      });

    try {
      const { data, usage } = await aiJson({
        prompt: 'Réponds exactement {"ok": true}.',
        geminiSchema: { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } },
      });
      const result = data as { ok?: unknown };
      const valid = result?.ok === true;
      await track(valid, usage, valid ? undefined : "réponse au format inattendu");
      if (valid) {
        return NextResponse.json({
          ok: true,
          message: `Clé plateforme acceptée par Google Gemini — modèle ${model}.`,
        });
      }
      return NextResponse.json({
        ok: false,
        message: `Google Gemini a répondu, mais pas au format attendu (modèle ${model}).`,
      });
    } catch (error) {
      const explained = explainAiError(error);
      await track(false, { inputTokens: 0, outputTokens: 0 }, explained);
      return NextResponse.json({
        ok: false,
        message: `Google Gemini refuse l'appel : ${explained}`,
      });
    }
  } catch (error) {
    console.error("Error testing AI key:", error);
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
