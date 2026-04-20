import { GoogleGenAI, Type } from "@google/genai";
import type { ParsedQuote } from "./pdf-parser";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export function isGeminiEnabled(): boolean {
  return ai !== null;
}

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

Pour amountHT, retourne le montant hors taxes en nombre décimal (sans symbole ni espaces).`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reference: { type: Type.STRING, nullable: true },
    siteName: { type: Type.STRING, nullable: true },
    siteCity: { type: Type.STRING, nullable: true },
    objet: { type: Type.STRING, nullable: true },
    amountHT: { type: Type.NUMBER, nullable: true },
    quoteType: {
      type: Type.STRING,
      enum: ["P1", "P3", "P5", "TRAVAUX", "AMELIORATION", "AUTRE"],
      nullable: true,
    },
  },
};

export async function parseWithGemini(pdfBuffer: Buffer): Promise<ParsedQuote | null> {
  if (!ai) return null;

  try {
    const base64 = pdfBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      reference: string | null;
      siteName: string | null;
      siteCity: string | null;
      objet: string | null;
      amountHT: number | null;
      quoteType: "P1" | "P3" | "P5" | "TRAVAUX" | "AMELIORATION" | "AUTRE" | null;
    };

    // ParsedQuote.quoteType restreint aux 5 valeurs originales — on mappe P1 vers AUTRE
    const mappedQuoteType: ParsedQuote["quoteType"] =
      parsed.quoteType === "P1" ? "AUTRE" :
      parsed.quoteType === null ? null :
      parsed.quoteType;

    return {
      reference: parsed.reference,
      siteName: parsed.siteName,
      siteCity: parsed.siteCity,
      objet: parsed.objet,
      amountHT: parsed.amountHT,
      quoteType: mappedQuoteType,
      rawText: "",
    };
  } catch (error) {
    console.error("Gemini parsing failed:", error);
    return null;
  }
}
