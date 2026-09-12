import { GoogleGenAI } from "@google/genai";

/**
 * Accès IA de la plateforme. Toutes les fonctions IA de l'app (import devis,
 * plan de renouvellement, test de clé) passent par aiJson() : un prompt, un
 * PDF optionnel, un schéma de réponse. Un seul fournisseur, Google Gemini,
 * avec la clé de la plateforme (GEMINI_API_KEY) — il n'y a pas de clé par
 * organisation.
 */

// Toujours une version STABLE : les « preview » sont retirées sans préavis et
// chaque import de devis tombe alors en erreur. Le bouton ⚡ de Paramètres
// vérifie que l'identifiant existe encore.
export const GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Barème public du modèle utilisé, en dollars par million de tokens.
 * Daté : les tarifs changent, un coût calculé avec un barème périmé est un
 * coût faux. `asOf` dit à quelle date le tarif a été relevé.
 */
export const MODEL_PRICES: Record<string, { inputPerM: number; outputPerM: number; asOf: string }> = {
  // Tarif valable jusqu'au 31/12/2026 ; passe ensuite à 1.50 / 7.50.
  "gemini-3.8-flash": { inputPerM: 0.75, outputPerM: 3.75, asOf: "2026-09-12" },
};

/** Coût estimé d'un appel, en dollars. 0 si le modèle n'est pas au barème. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES[model];
  if (!price) return 0;
  return (inputTokens * price.inputPerM + outputTokens * price.outputPerM) / 1_000_000;
}

/** Tokens facturés par un appel ; 0 quand le fournisseur ne les renvoie pas. */
export interface AiUsageTokens {
  inputTokens: number;
  outputTokens: number;
}

export interface AiJsonResult {
  data: unknown;
  usage: AiUsageTokens;
}

// Les compteurs de tokens arrivent parfois absents ou non numériques :
// on ne veut ni NaN ni undefined dans un coût.
function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface AiJsonRequest {
  prompt: string;
  pdf?: Buffer;
  /** Schéma au format Gemini (Type.OBJECT…), appliqué nativement. */
  geminiSchema: object;
}

// Retire une éventuelle clôture markdown autour du JSON
function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

/** La plateforme a-t-elle une clé IA utilisable ? */
export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const TRANSIENT_RETRY_DELAYS_MS = [1500, 3000];

/** Saturation, quota par minute, coupure réseau : l'appel suivant peut passer. */
export function isTransientAiError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  // Un 429 « crédits prépayés épuisés » n'est pas passager : inutile d'insister.
  if (/prepayment|credits are depleted/i.test(msg)) return false;
  return /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED|rate.?limit|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg);
}

export async function aiJson(req: AiJsonRequest): Promise<AiJsonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY absente");

  const ai = new GoogleGenAI({ apiKey });
  const parts: object[] = [];
  if (req.pdf) {
    parts.push({ inlineData: { mimeType: "application/pdf", data: req.pdf.toString("base64") } });
  }
  parts.push({ text: req.prompt });

  const call = () =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: req.geminiSchema,
        temperature: 0,
      },
    });

  // Google renvoie des 503 « high demand » et des 429 passagers : on réessaie
  // deux fois avec une courte attente avant de rendre la main à l'utilisateur.
  // Une clé refusée ou un modèle inconnu ne sont pas réessayés — ça ne
  // changerait rien et ça brûlerait des appels.
  let response: Awaited<ReturnType<typeof call>>;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await call();
      break;
    } catch (error) {
      if (attempt >= TRANSIENT_RETRY_DELAYS_MS.length || !isTransientAiError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAYS_MS[attempt]));
    }
  }
  if (!response.text) throw new Error("Réponse Gemini vide");
  return {
    data: parseJson(response.text),
    usage: {
      inputTokens: toCount(response.usageMetadata?.promptTokenCount),
      outputTokens: toCount(response.usageMetadata?.candidatesTokenCount),
    },
  };
}
