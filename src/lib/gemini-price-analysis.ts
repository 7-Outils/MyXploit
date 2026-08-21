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
  corpsEtat: string | null;
  unit: string | null;
  sellPriceHT: number | null;
}

export interface LineMatch {
  index: number;
  // Composition : codes du référentiel dont la somme représente la
  // prestation de la ligne (principal + dépose + raccordement...)
  refCodes: string[];
  // Total HT de référence pour la LIGNE ENTIÈRE (quantité comprise)
  refTotalHT: number | null;
  // Estimation IA du total HT de la ligne, seulement si refCodes est vide
  aiEstimateHT: number | null;
  comment: string | null;
}

export interface QuoteContext {
  reference: string;
  title: string;
  siteName: string | null;
  quoteType: string | null;
  amountHT: number;
  amountTVA: number | null;
  amountTTC: number;
  issueDate: string | null;
}

export interface MatchResult {
  lines: LineMatch[];
  verdict: "TRES_BIEN_PLACE" | "CORRECT" | "ELEVE" | "TRES_ELEVE" | "INDETERMINE";
  commentary: string;
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

// Pour chaque ligne du devis, l'IA propose des expressions de recherche
// courtes désignant l'ouvrage principal (en français correct, accents
// compris, car les désignations Batiprix sont accentuées). C'est ce qui
// évite qu'une ligne "chauffe-eau + accessoires" ne remonte que des coudes.
export async function generateSearchQueries(
  items: ExtractedItem[],
  ai: AiConfig
): Promise<string[][]> {
  const lines = items
    .map((item, i) => `Ligne ${i} : "${item.description}" (${item.quantity ?? "?"} ${item.unit ?? ""})`)
    .join("\n");

  const parsed = (await aiJson(ai, {
    prompt: `Tu prépares des recherches dans un bordereau de prix du bâtiment (Batiprix). Pour chaque ligne de devis ci-dessous, donne 2 à 5 expressions de recherche courtes (1 à 4 mots chacune) couvrant la PRESTATION COMPLÈTE de la ligne :
- l'ouvrage principal (l'équipement ou la prestation qu'on achète), en ignorant les accessoires de pose (coudes, raccords, manchons, visserie) ;
- les opérations associées quand la ligne est un remplacement/fourni-posé : dépose de l'ancien équipement, raccordement électrique ou hydraulique.

Règles :
- Français correct AVEC accents (les désignations du bordereau sont accentuées).
- Inclure les synonymes usuels (ex: "chauffe-eau" ET "ballon") et la dimension/capacité si présente (ex: "300").
- Pour la main-d'œuvre : "taux horaire", "main-d'œuvre".
- terms : la liste des expressions pour la ligne.

${lines}`,
    geminiSchema: {
      type: Type.OBJECT,
      properties: {
        queries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.NUMBER },
              terms: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["index", "terms"],
          },
        },
      },
      required: ["queries"],
    },
  })) as { queries: { index: number; terms: string[] }[] };

  const result: string[][] = items.map(() => []);
  for (const q of parsed.queries) {
    if (q.index >= 0 && q.index < items.length && Array.isArray(q.terms)) {
      result[q.index] = q.terms.filter((t) => typeof t === "string" && t.trim()).slice(0, 5);
    }
  }
  return result;
}

// Pour chaque ligne du devis, choisit le meilleur ouvrage du référentiel
// parmi les candidats présélectionnés, ou estime le prix si rien ne convient
export async function matchQuoteLines(
  items: ExtractedItem[],
  candidates: CandidateRef[][],
  ai: AiConfig,
  context: QuoteContext
): Promise<MatchResult | null> {
  const lines = items.map((item, i) => {
    const cands = candidates[i]
      .map((c) => `    - code "${c.code}" [${c.corpsEtat ?? "corps d'état inconnu"}] : ${c.designation} (${c.unit ?? "?"}) — ${c.sellPriceHT != null ? `${c.sellPriceHT.toFixed(2)} € HT` : "prix inconnu"}`)
      .join("\n");
    return `Ligne ${i} : "${item.description}" — qté ${item.quantity ?? "?"} ${item.unit ?? ""}, PU ${item.unitPrice != null ? `${item.unitPrice.toFixed(2)} € HT` : "?"}, total ${item.totalHT != null ? `${item.totalHT.toFixed(2)} € HT` : "?"}
  Candidats du référentiel :
${cands || "    (aucun)"}`;
  });

  try {
    const parsed = (await aiJson(ai, {
      prompt: `Tu es économiste de la construction dans un bureau d'études CVC. Tu analyses un devis d'exploitant pour le compte d'une collectivité.

Devis : ${context.reference} — ${context.title}
Site : ${context.siteName ?? "non précisé"} (bâtiment public / ERP a priori)
Type : ${context.quoteType ?? "?"} · Émis le : ${context.issueDate ?? "?"}
Montants : ${context.amountHT.toFixed(2)} € HT${context.amountTVA != null ? ` + TVA ${context.amountTVA.toFixed(2)} €` : ""} = ${context.amountTTC.toFixed(2)} € TTC

Pour chaque ligne, COMPOSE la prestation à partir des candidats du référentiel Batiprix : choisis les codes (0 à 4) dont la somme représente réellement ce que couvre la ligne. Exemple : une ligne "remplacement chauffe-eau 300 L fourni-posé" = chauffe-eau 300 L + dépose de l'ancien + raccordement. Ne force jamais un rapprochement approximatif : un circulateur n'est pas une pompe de relevage, un DN40 n'est pas un DN100.

Règles par ligne :
- refCodes : les codes retenus (tableau vide si aucun candidat ne convient).
- refTotalHT : le total HT de référence pour la LIGNE ENTIÈRE (quantité de la ligne comprise), calculé à partir des prix des candidats retenus ; null si refCodes est vide.
- aiEstimateHT : UNIQUEMENT si refCodes est vide, ton estimation du total HT de la ligne (prix marché France 2026) ; sinon null.
- comment : une phrase courte — la composition retenue, ou le fondement de l'estimation, ou ce qui rend la ligne inanalysable.

Puis un jugement global :
- verdict : TRES_BIEN_PLACE (nettement sous la référence), CORRECT (±15 %), ELEVE (+15 à +40 %), TRES_ELEVE (>+40 %), INDETERMINE.
- commentary : 3 à 6 phrases en français, comme une note de bureau d'études : positionnement global du devis vs la référence, taux horaire main-d'œuvre implicite s'il se déduit, cohérence de la TVA (20 % attendu en ERP/bâtiment public ; 10 % réservé au logement), anomalies éventuelles (date, régularisation de travaux déjà faits), et recommandation claire (valider tel quel / négocier tel poste).

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
                refCodes: { type: Type.ARRAY, items: { type: Type.STRING } },
                refTotalHT: { type: Type.NUMBER, nullable: true },
                aiEstimateHT: { type: Type.NUMBER, nullable: true },
                comment: { type: Type.STRING, nullable: true },
              },
              required: ["index", "refCodes"],
            },
          },
          verdict: {
            type: Type.STRING,
            enum: ["TRES_BIEN_PLACE", "CORRECT", "ELEVE", "TRES_ELEVE", "INDETERMINE"],
          },
          commentary: { type: Type.STRING },
        },
        required: ["matches", "verdict", "commentary"],
      },
    })) as { matches: LineMatch[]; verdict: MatchResult["verdict"]; commentary: string };
    return { lines: parsed.matches, verdict: parsed.verdict, commentary: parsed.commentary };
  } catch (error) {
    console.error("AI line matching failed:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}
