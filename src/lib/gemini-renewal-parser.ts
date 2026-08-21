import { GoogleGenAI, Type } from "@google/genai";

/**
 * Import assisté par IA des plans de renouvellement P3.
 * Les trames Excel varient par marché et par exploitant (Dalkia, ENGIE, IDEX…)
 * — pas de mapping de colonnes possible : on donne le tableau brut à Gemini
 * qui en extrait les postes normalisés.
 */

// La clé API vient de l'organisation (via getGeminiApiKey)

export interface ParsedRenewalItem {
  label: string;
  plannedYear: number;
  amountHT: number;
  siteName: string | null;
  notes: string | null;
}

const PROMPT = `Tu analyses un extrait de tableau Excel français : le plan de renouvellement (poste P3 / gros entretien-renouvellement / GER) d'un contrat d'exploitation de chauffage. La trame varie selon l'exploitant (Dalkia, ENGIE, IDEX, Équans, Coriance…) : colonnes, ordre, fusions et intitulés ne sont jamais les mêmes.

Extrais chaque POSTE DE RENOUVELLEMENT planifié, c'est-à-dire chaque ligne qui associe un équipement ou une prestation à une année de remplacement et un montant.

Règles :
- label : désignation du poste, concise mais fidèle (ex: "Remplacement chaudière n°1 — 450 kW", "Circulateurs réseau ECS"). Inclus le repère d'équipement s'il existe.
- plannedYear : l'année de renouvellement programmée (nombre entier, ex: 2027). Si la trame donne une "année N+x", convertis si l'année de départ est identifiable, sinon ignore la ligne.
- amountHT : montant en euros HT (nombre décimal, sans espaces ni symbole). Si le montant est clairement en k€, convertis en euros. Si plusieurs colonnes de montants existent (valeur d'origine, valeur révisée…), prends la valeur contractuelle d'origine.
- siteName : nom du bâtiment/site concerné si présent (ex: "École Jules Ferry"), sinon null.
- notes : toute précision utile (quantité, marque, condition, "si nécessaire"…), sinon null.

Ignore : lignes de titre, sous-totaux, totaux généraux, lignes vides, lignes sans montant NI année exploitables, provisions globales non affectées ("provision annuelle P3" sans objet).`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          plannedYear: { type: Type.NUMBER },
          amountHT: { type: Type.NUMBER },
          siteName: { type: Type.STRING, nullable: true },
          notes: { type: Type.STRING, nullable: true },
        },
        required: ["label", "plannedYear", "amountHT"],
      },
    },
  },
  required: ["items"],
};

export async function parseRenewalPlan(
  rows: string[][],
  apiKey: string
): Promise<ParsedRenewalItem[] | null> {
  const ai = new GoogleGenAI({ apiKey });

  // Sérialisation TSV : compacte et fidèle à la structure du tableau
  const tsv = rows
    .map((r) => r.map((c) => (c ?? "").toString().trim()).join("\t"))
    .join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: `${PROMPT}\n\nTableau :\n${tsv}` }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!Array.isArray(parsed.items)) return null;

    return parsed.items
      .filter(
        (i: ParsedRenewalItem) =>
          i.label &&
          Number.isFinite(i.plannedYear) &&
          i.plannedYear > 1990 &&
          i.plannedYear < 2100 &&
          Number.isFinite(i.amountHT) &&
          i.amountHT >= 0
      )
      .map((i: ParsedRenewalItem) => ({
        label: String(i.label).slice(0, 300),
        plannedYear: Math.round(i.plannedYear),
        amountHT: i.amountHT,
        siteName: i.siteName || null,
        notes: i.notes || null,
      }));
  } catch (error) {
    console.error("Gemini renewal plan parsing error:", error);
    return null;
  }
}
