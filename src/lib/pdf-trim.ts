import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";

/**
 * Pages envoyées à l'IA quand on ne sait pas où s'arrêter (PDF scanné sans
 * texte, ou sans « Total HT » repérable). Les champs qu'on extrait tiennent
 * dans les premières pages ; au-delà, les devis d'exploitants n'alignent que
 * des conditions générales, facturées en tokens pour rien.
 */
export const AI_FALLBACK_PAGES = 4;
/** Garde-fou absolu, même si le total est trouvé très loin. */
export const AI_HARD_MAX_PAGES = 8;

// Après le total HT, plus rien ne nous intéresse : la découpe s'arrête à la
// première page qui le porte.
const TOTAL_HT = /(?:total|montant|net)\s*(?:g[ée]n[ée]ral\s*)?h\.?\s*t\b/i;

/**
 * Plafond dur pour les documents envoyés en entier à l'IA (factures : la
 * répartition par site vient APRÈS le total, on ne peut pas couper au total).
 * Au-delà, les tokens d'entrée deviennent le poste de coût principal.
 */
export const AI_FULL_DOCUMENT_MAX_PAGES = 40;

export interface CapResult {
  buffer: Buffer;
  /** Pages du document d'origine (0 si illisible). */
  pages: number;
  /** Vrai si le document a été coupé au plafond. */
  truncated: boolean;
}

/**
 * Renvoie le PDF tel quel s'il tient sous le plafond, sinon ses `max`
 * premières pages. Contrairement à trimPdfForAi, ne cherche pas le total HT :
 * sur une facture, tout ce qui suit le total nous intéresse.
 */
export async function capPdfPages(
  pdf: Buffer,
  max: number = AI_FULL_DOCUMENT_MAX_PAGES
): Promise<CapResult> {
  try {
    const source = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const pages = source.getPageCount();
    if (pages <= max) return { buffer: pdf, pages, truncated: false };

    const capped = await PDFDocument.create();
    const copied = await capped.copyPages(source, Array.from({ length: max }, (_, i) => i));
    for (const page of copied) capped.addPage(page);
    const bytes = await capped.save();
    return { buffer: Buffer.from(bytes), pages, truncated: true };
  } catch (error) {
    console.error("PDF page cap failed, sending the full document:", error);
    return { buffer: pdf, pages: 0, truncated: false };
  }
}

export interface TrimResult {
  buffer: Buffer;
  /** Pages du document d'origine (0 si illisible). */
  pages: number;
  /** Pages réellement envoyées. */
  kept: number;
  /** Comment la coupe a été décidée. */
  reason: "court" | "total-ht" | "sans-texte" | "erreur";
}

/**
 * Renvoie un PDF réduit aux pages utiles : jusqu'à celle qui porte le total
 * HT quand le texte est lisible, sinon les premières pages. Le fichier archivé
 * reste l'original complet ; seul l'envoi à l'IA est tronqué. En cas d'échec
 * (PDF chiffré, malformé…) le document complet part tel quel.
 */
export async function trimPdfForAi(pdf: Buffer): Promise<TrimResult> {
  try {
    const source = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const pages = source.getPageCount();
    if (pages <= 1) return { buffer: pdf, pages, kept: pages, reason: "court" };

    let kept = Math.min(pages, AI_FALLBACK_PAGES);
    let reason: TrimResult["reason"] = "sans-texte";
    try {
      const { text } = await extractText(new Uint8Array(pdf), { mergePages: false });
      const totalPage = text.findIndex((t) => TOTAL_HT.test(t));
      if (totalPage >= 0) {
        kept = Math.min(totalPage + 1, AI_HARD_MAX_PAGES);
        reason = "total-ht";
      }
    } catch (error) {
      console.error("PDF text extraction failed, falling back to first pages:", error);
    }

    if (kept >= pages) return { buffer: pdf, pages, kept: pages, reason: "court" };

    const trimmed = await PDFDocument.create();
    const copied = await trimmed.copyPages(source, Array.from({ length: kept }, (_, i) => i));
    for (const page of copied) trimmed.addPage(page);
    const bytes = await trimmed.save();
    return { buffer: Buffer.from(bytes), pages, kept, reason };
  } catch (error) {
    console.error("PDF trim failed, sending the full document:", error);
    return { buffer: pdf, pages: 0, kept: 0, reason: "erreur" };
  }
}
