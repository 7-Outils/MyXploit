import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getOrgAi } from "@/lib/ai-key";
import { aiJson, MODELS, AI_PROVIDER_LABELS } from "@/lib/ai-client";
import { explainAiError } from "@/lib/gemini-pdf-parser";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

// POST /api/organization/ai-test — appel minimal réel au fournisseur IA avec
// la configuration effective de l'organisation, pour savoir en deux secondes
// si la clé est acceptée et par quel modèle, plutôt que de le découvrir sur
// un import de devis raté.
export async function POST() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const limit = await rateLimit(`ai-test:${user.id}`, "import");
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    const cfg = await getOrgAi(effectiveOrgId);
    if (!cfg) {
      return NextResponse.json({
        ok: false,
        message: "Aucune clé configurée pour l'organisation.",
      });
    }

    const label = AI_PROVIDER_LABELS[cfg.provider];
    const model = MODELS[cfg.provider];
    try {
      const result = (await aiJson(cfg, {
        prompt: 'Réponds exactement {"ok": true}.',
        geminiSchema: { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } },
      })) as { ok?: unknown };
      if (result?.ok === true) {
        return NextResponse.json({
          ok: true,
          message: `Clé acceptée par ${label} — modèle ${model}.`,
        });
      }
      return NextResponse.json({
        ok: false,
        message: `${label} a répondu, mais pas au format attendu (modèle ${model}).`,
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        message: `${label} refuse l'appel : ${explainAiError(error)} (modèle ${model}).`,
      });
    }
  } catch (error) {
    console.error("Error testing AI key:", error);
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
