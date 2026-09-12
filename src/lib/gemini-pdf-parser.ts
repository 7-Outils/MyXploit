import { Type } from "@google/genai";
import type { ParsedQuote } from "./quote-import";
import { aiJson, type AiConfig } from "@/lib/ai-client";

const PROMPT = `Tu analyses un document PDF français : un devis ou une facture provenant d'un exploitant de chauffage (Dalkia, ENGIE, IDEX, Équans, etc.) ou d'un artisan local.

Extrais les champs suivants. Si un champ n'est pas clairement présent, mets null.

Classification du type (très important) :
- "P1" : énergie, combustible, gaz, fioul, abonnement gaz, TICGN, PEG, TVD, CEE, P0 (énergie uniquement)
- "P3" : gros entretien, remplacement d'équipement, renouvellement, réfection, rénovation
- "P5" : prestations exceptionnelles, actions préventives extraordinaires (APE)
- "TRAVAUX" : travaux hors contrat
- "AMELIORATION" : amélioration énergétique, MDE
- "AUTRE" : si aucun des ci-dessus

Pour siteName, retourne uniquement le nom du bâtiment/établissement (ex: "Mairie", "École Jules Ferry", "Piscine municipale"), pas l'adresse complète.

Pour amountHT, retourne le montant hors taxes en nombre décimal (sans symbole ni espaces).

Pour issueDate, retourne la date d'émission du document au format ISO "YYYY-MM-DD" (ex: "2025-12-09"). C'est la date affichée en tête du document (souvent "Date : 9 décembre 2025" ou "Date d'émission : 09/12/2025"), pas la date d'échéance ni la date des travaux.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reference: { type: Type.STRING, nullable: true },
    siteName: { type: Type.STRING, nullable: true },
    siteCity: { type: Type.STRING, nullable: true },
    objet: { type: Type.STRING, nullable: true },
    amountHT: { type: Type.NUMBER, nullable: true },
    issueDate: { type: Type.STRING, nullable: true },
    quoteType: {
      type: Type.STRING,
      enum: ["P1", "P3", "P5", "TRAVAUX", "AMELIORATION", "AUTRE"],
      nullable: true,
    },
  },
};

/**
 * Traduit l'erreur du fournisseur en une phrase actionnable, et surtout ne
 * laisse jamais filtrer la clé API dans un message affiché à l'écran.
 */
export function explainAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const safe = raw
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[clé masquée]")
    .replace(/sk-[0-9A-Za-z_-]{10,}/g, "[clé masquée]");

  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(safe))
    return "quota du fournisseur IA dépassé";
  if (/401|403|API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(safe))
    return "clé API refusée par le fournisseur";
  if (/404|NOT_FOUND|not found|is not supported/i.test(safe))
    return "modèle IA indisponible chez le fournisseur";
  if (/timeout|ETIMEDOUT|fetch failed|ENOTFOUND|network/i.test(safe))
    return "fournisseur IA injoignable";
  return safe.slice(0, 200);
}

export type GeminiParseResult = {
  parsed: ParsedQuote | null;
  /** Raison lisible de l'échec, à afficher ; null si la lecture a réussi. */
  error: string | null;
};

export async function parseWithGemini(pdfBuffer: Buffer, ai: AiConfig): Promise<GeminiParseResult> {
  try {
    const parsed = (await aiJson(ai, {
      pdf: pdfBuffer,
      prompt: PROMPT,
      geminiSchema: responseSchema,
    })) as {
      reference: string | null;
      siteName: string | null;
      siteCity: string | null;
      objet: string | null;
      amountHT: number | null;
      issueDate: string | null;
      quoteType: "P1" | "P3" | "P5" | "TRAVAUX" | "AMELIORATION" | "AUTRE" | null;
    };

    // ParsedQuote.quoteType restreint aux 5 valeurs originales — on mappe P1 vers AUTRE
    const mappedQuoteType: ParsedQuote["quoteType"] =
      parsed.quoteType === "P1" ? "AUTRE" :
      parsed.quoteType === null ? null :
      parsed.quoteType;

    return {
      parsed: {
        reference: parsed.reference,
        siteName: parsed.siteName,
        siteCity: parsed.siteCity,
        objet: parsed.objet,
        amountHT: parsed.amountHT,
        issueDate: parsed.issueDate ?? null,
        quoteType: mappedQuoteType,
      },
      error: null,
    };
  } catch (error) {
    console.error("Gemini parsing failed:", error);
    return { parsed: null, error: explainAiError(error) };
  }
}
