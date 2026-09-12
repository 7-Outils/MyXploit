import { Type } from "@google/genai";
import type { ParsedQuote } from "./quote-import";
import {
  INVOICE_TYPES,
  P1_SUBTYPES,
  stripLineOrderPrefix,
  type ParsedInvoice,
  type ParsedInvoiceLine,
  type InvoiceTypeValue,
  type P1SubType,
} from "./invoice-import";
import { aiJson, type AiUsageTokens } from "@/lib/ai-client";

// Exportés pour le banc d'essai scripts/benchmark-devis-extraction.ts, qui
// doit interroger les fournisseurs avec exactement la consigne du site.
export const PROMPT = `Tu analyses un document PDF français : un devis ou une facture provenant d'un exploitant de chauffage (Dalkia, ENGIE, IDEX, Équans, etc.) ou d'un artisan local.

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

export const responseSchema = {
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

// ============================================
// FACTURES
// ============================================

/**
 * Consigne dédiée aux factures. Celle des devis ignore le P2 et classe une
 * facture « Prestations de conduite et entretien courant » en P1 : faux, et
 * ça pollue à la fois le suivi énergie et le solde P3.
 */
export const INVOICE_PROMPT = `Tu analyses une facture au format PDF, émise par un exploitant de chauffage (Dalkia, ENGIE, IDEX, Équans, Cofely, etc.) ou par un artisan, et adressée à une collectivité.

Extrais les champs demandés. Si un champ n'est pas clairement présent sur le document, mets null. N'invente jamais une valeur plausible.

Classification du type de facture (très important — lis l'objet et le détail des lignes, pas seulement l'en-tête) :
- "P1" : fourniture d'énergie, combustible, gaz, fioul, bois, électricité de chauffage, abonnement, TICGN, CEE, décompte ou intéressement énergie.
- "P2" : conduite, entretien courant, maintenance, prestations d'exploitation, petit entretien, astreinte, dépannage courant, surveillance des installations.
- "P3" : gros entretien, renouvellement, garantie totale, remplacement de matériel, APE (actions préventives extraordinaires).
- "AUTRE" : si aucun des cas ci-dessus ne correspond.

Repère typique : « Prestations de conduite et entretien courant » = P2 (jamais P1). « Travaux de Gros Entretien et APE » = P3.

p1SubType : uniquement si le type est "P1", choisis exactement une valeur parmi ${P1_SUBTYPES.map((s) => `"${s}"`).join(", ")}. Pour tout autre type, mets null.

Règle de rattachement au site — importante :
- Ne renseigne siteName/siteCity QUE si la facture désigne nommément un bâtiment précis (ex : "École Jules Ferry", "Piscine municipale").
- Si la facture couvre l'ensemble des sites du contrat (mentions du genre "Bâtiments communaux", "ensemble des sites", "tous bâtiments", ou facture périodique globale sans bâtiment nommé), mets siteName ET siteCity à null. La répartition par site est calculée ailleurs au prorata.
- Pour siteName, retourne uniquement le nom du bâtiment/établissement, pas l'adresse complète.

Pour amountHT, retourne le montant total hors taxes en nombre décimal (sans symbole monétaire ni espaces).

Pour issueDate, retourne la date d'émission de la facture au format ISO "YYYY-MM-DD". C'est la date affichée en tête du document, pas la date d'échéance, pas la période de prestation.

periodStart / periodEnd : la période de prestation facturée, au format ISO "YYYY-MM-DD" (mentions du genre « Période facturée du 01/06/2026 au 31/08/2026 », « Prestations du … au … »). null si le document ne l'indique pas.

lines : la liste COMPLÈTE des sites facturés, dans l'ordre du document. Pour chaque site : label = nom du site tel qu'écrit, sans le numéro d'ordre qui le précède ; amountHT = montant hors taxes facturé pour ce site sur CETTE facture (le « Total HT » du bloc du site), et surtout pas le prix de base annuel ni un montant de référence. N'omets aucun site, n'invente aucun site, ne regroupe pas deux sites en une ligne. Si la facture ne détaille pas la répartition par site, retourne une liste vide.`;

export const invoiceResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reference: { type: Type.STRING, nullable: true },
    siteName: { type: Type.STRING, nullable: true },
    siteCity: { type: Type.STRING, nullable: true },
    objet: { type: Type.STRING, nullable: true },
    amountHT: { type: Type.NUMBER, nullable: true },
    issueDate: { type: Type.STRING, nullable: true },
    periodStart: { type: Type.STRING, nullable: true },
    periodEnd: { type: Type.STRING, nullable: true },
    invoiceType: {
      type: Type.STRING,
      enum: [...INVOICE_TYPES],
      nullable: true,
    },
    p1SubType: {
      type: Type.STRING,
      enum: [...P1_SUBTYPES],
      nullable: true,
    },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          amountHT: { type: Type.NUMBER },
        },
        required: ["label", "amountHT"],
      },
    },
  },
};

/** Date ISO stricte : le modèle renvoie parfois "31/08/2026" ou du vide. */
function isoDateOrNull(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Traduit l'erreur du fournisseur en une phrase actionnable, et surtout ne
 * laisse jamais filtrer la clé API dans un message affiché à l'écran.
 */
export function explainAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const safe = raw
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[clé masquée]")
    .replace(/sk-[0-9A-Za-z_-]{10,}/g, "[clé masquée]");

  if (/prepayment|credits are depleted|billing/i.test(safe))
    return "crédits Google épuisés — recharger le projet sur ai.studio/projects";
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(safe))
    return "Google Gemini saturé pour le moment, réessayez dans un instant";
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
  /** Tokens facturés ; à 0 en cas d'échec, le fournisseur ne les renvoyant pas. */
  usage: AiUsageTokens;
  /** Durée de l'appel, succès comme échec, pour le suivi de consommation. */
  durationMs: number;
};

export async function parseWithGemini(pdfBuffer: Buffer): Promise<GeminiParseResult> {
  const startedAt = Date.now();
  try {
    const result = await aiJson({
      pdf: pdfBuffer,
      prompt: PROMPT,
      geminiSchema: responseSchema,
    });
    const parsed = result.data as {
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
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.error("Gemini parsing failed:", error);
    return {
      parsed: null,
      error: explainAiError(error),
      usage: { inputTokens: 0, outputTokens: 0 },
      durationMs: Date.now() - startedAt,
    };
  }
}

export type GeminiInvoiceParseResult = {
  parsed: ParsedInvoice | null;
  /** Raison lisible de l'échec, à afficher ; null si la lecture a réussi. */
  error: string | null;
  /** Tokens facturés ; à 0 en cas d'échec, le fournisseur ne les renvoyant pas. */
  usage: AiUsageTokens;
  /** Durée de l'appel, succès comme échec, pour le suivi de consommation. */
  durationMs: number;
};

/**
 * Lecture IA d'une facture. Même mécanique que parseWithGemini, mais avec la
 * consigne et le schéma factures : le type renvoyé est directement une valeur
 * de l'enum InvoiceType, aucun mappage n'est à faire côté écran.
 */
export async function parseInvoiceWithGemini(
  pdfBuffer: Buffer
): Promise<GeminiInvoiceParseResult> {
  const startedAt = Date.now();
  try {
    const result = await aiJson({
      pdf: pdfBuffer,
      prompt: INVOICE_PROMPT,
      geminiSchema: invoiceResponseSchema,
    });
    const parsed = result.data as {
      reference: string | null;
      siteName: string | null;
      siteCity: string | null;
      objet: string | null;
      amountHT: number | null;
      issueDate: string | null;
      periodStart: string | null;
      periodEnd: string | null;
      invoiceType: string | null;
      p1SubType: string | null;
      lines: Array<{ label?: unknown; amountHT?: unknown }> | null;
    };

    // Le modèle peut renvoyer une valeur hors enum malgré le schéma : on la
    // jette plutôt que de la propager jusqu'à Prisma, qui lèverait un 500.
    const invoiceType = INVOICE_TYPES.includes(parsed.invoiceType as InvoiceTypeValue)
      ? (parsed.invoiceType as InvoiceTypeValue)
      : null;
    // Un sous-type sur une facture qui n'est pas P1 n'a pas de sens.
    const p1SubType =
      invoiceType === "P1" && P1_SUBTYPES.includes(parsed.p1SubType as P1SubType)
        ? (parsed.p1SubType as P1SubType)
        : null;

    // Lignes : on retire le numéro d'ordre du libellé et on jette ce qui n'a
    // ni nom ni montant numérique — une ligne à montant absent fausserait la
    // somme affichée à l'écran sans qu'on puisse la corriger.
    const lines: ParsedInvoiceLine[] = (Array.isArray(parsed.lines) ? parsed.lines : [])
      .map((line) => ({
        label: typeof line?.label === "string" ? stripLineOrderPrefix(line.label) : "",
        amountHT: typeof line?.amountHT === "number" ? line.amountHT : Number.NaN,
      }))
      .filter((line) => line.label.length > 0 && Number.isFinite(line.amountHT));

    return {
      parsed: {
        reference: parsed.reference,
        siteName: parsed.siteName,
        siteCity: parsed.siteCity,
        objet: parsed.objet,
        amountHT: parsed.amountHT,
        issueDate: isoDateOrNull(parsed.issueDate),
        periodStart: isoDateOrNull(parsed.periodStart),
        periodEnd: isoDateOrNull(parsed.periodEnd),
        invoiceType,
        p1SubType,
        lines,
      },
      error: null,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.error("Gemini invoice parsing failed:", error);
    return {
      parsed: null,
      error: explainAiError(error),
      usage: { inputTokens: 0, outputTokens: 0 },
      durationMs: Date.now() - startedAt,
    };
  }
}
