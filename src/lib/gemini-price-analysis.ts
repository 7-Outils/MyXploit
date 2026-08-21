import { Type } from "@google/genai";
import { aiJson, type AiConfig } from "@/lib/ai-client";

export interface ExtractedItem {
  lineNumber: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalHT: number | null;
}

export interface CandidateRef {
  code: string;
  designation: string;
  unit: string | null;
  sellPriceHT: number | null;
}

export interface LineMatch {
  index: number;
  matchedCode: string | null;
  aiEstimateHT: number | null;
  comment: string | null;
}

// Extrait les lignes de prestation d'un devis PDF (désignation, quantité,
// unité, prix unitaire, total HT)
export async function extractQuoteItems(pdfBuffer: Buffer, ai: AiConfig): Promise<ExtractedItem[] | null> {
  try {
    const parsed = (await aiJson(ai, {
      pdf: pdfBuffer,
      prompt: `Tu analyses un devis français de travaux/maintenance de chauffage. Extrais chaque ligne de prestation chiffrée du tableau du devis.

Pour chaque ligne : description complète, quantité (nombre), unité (U, ENS, H, ML, M2, F...), prix unitaire HT, total HT de la ligne.
Ignore les lignes de sous-total, TVA, total général, remises globales et texte d'introduction.
Si une valeur est absente sur la ligne, mets null. Les nombres sont en notation décimale à point (1234.56).`,
      geminiSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER, nullable: true },
                unit: { type: Type.STRING, nullable: true },
                unitPrice: { type: Type.NUMBER, nullable: true },
                totalHT: { type: Type.NUMBER, nullable: true },
              },
              required: ["description"],
            },
          },
        },
        required: ["items"],
      },
    })) as { items: Omit<ExtractedItem, "lineNumber">[] };
    return parsed.items.map((item, i) => ({ ...item, lineNumber: i + 1 }));
  } catch (error) {
    console.error("AI item extraction failed:", error);
    // On propage la cause réelle : le front l'affiche, sinon on debugge à l'aveugle
    throw error instanceof Error ? error : new Error(String(error));
  }
}

// Pour chaque ligne du devis, choisit le meilleur ouvrage du référentiel
// parmi les candidats présélectionnés, ou estime le prix si rien ne convient
export async function matchQuoteLines(
  items: ExtractedItem[],
  candidates: CandidateRef[][],
  ai: AiConfig
): Promise<LineMatch[] | null> {
  const lines = items.map((item, i) => {
    const cands = candidates[i]
      .map((c) => `    - code "${c.code}" : ${c.designation} (${c.unit ?? "?"}) — ${c.sellPriceHT != null ? `${c.sellPriceHT.toFixed(2)} € HT` : "prix inconnu"}`)
      .join("\n");
    return `Ligne ${i} : "${item.description}" — qté ${item.quantity ?? "?"} ${item.unit ?? ""}, PU ${item.unitPrice != null ? `${item.unitPrice.toFixed(2)} € HT` : "?"}
  Candidats du référentiel :
${cands || "    (aucun)"}`;
  });

  try {
    const parsed = (await aiJson(ai, {
      prompt: `Tu es économiste de la construction dans un bureau d'études CVC. Pour chaque ligne de devis ci-dessous, choisis parmi les candidats l'ouvrage du référentiel Batiprix qui correspond VRAIMENT à la même prestation (même nature de travaux, même type d'équipement, gamme/dimension comparable).

Règles :
- matchedCode : le code du candidat retenu, ou null si aucun candidat ne correspond réellement. Ne force jamais un rapprochement approximatif : un circulateur n'est pas une pompe de relevage, un DN40 n'est pas un DN100.
- aiEstimateHT : UNIQUEMENT si matchedCode est null, ton estimation du prix unitaire HT fourni-posé raisonnable en France en 2026 pour cette prestation (nombre), sinon null.
- comment : une phrase courte en français — pourquoi ce candidat, ou sur quoi se fonde ton estimation, ou ce qui rend la ligne inanalysable (ex: forfait global sans détail).

${lines.join("\n\n")}`,
      geminiSchema: {
        type: Type.OBJECT,
        properties: {
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.NUMBER },
                matchedCode: { type: Type.STRING, nullable: true },
                aiEstimateHT: { type: Type.NUMBER, nullable: true },
                comment: { type: Type.STRING, nullable: true },
              },
              required: ["index"],
            },
          },
        },
        required: ["matches"],
      },
    })) as { matches: LineMatch[] };
    return parsed.matches;
  } catch (error) {
    console.error("AI line matching failed:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}
