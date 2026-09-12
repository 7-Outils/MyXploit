import { PDFDocument } from "pdf-lib";

/**
 * Nombre de pages envoyées à l'IA. Les champs qu'on extrait (référence, date,
 * site, objet, total HT) tiennent dans les premières pages ; au-delà, les
 * devis d'exploitants (IDEX, Dalkia…) n'alignent que des conditions générales,
 * facturées en tokens pour rien — un devis de 12 pages coûtait 5× celui de 2.
 */
export const AI_MAX_PDF_PAGES = 4;

/**
 * Renvoie un PDF réduit aux premières pages, ou le PDF d'origine s'il est
 * déjà court ou si la découpe échoue (PDF chiffré, malformé…). Le fichier
 * archivé reste l'original complet ; seul l'envoi à l'IA est tronqué.
 */
export async function trimPdfForAi(
  pdf: Buffer,
  maxPages: number = AI_MAX_PDF_PAGES
): Promise<{ buffer: Buffer; pages: number; kept: number }> {
  try {
    const source = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const pages = source.getPageCount();
    if (pages <= maxPages) return { buffer: pdf, pages, kept: pages };

    const trimmed = await PDFDocument.create();
    const copied = await trimmed.copyPages(source, Array.from({ length: maxPages }, (_, i) => i));
    for (const page of copied) trimmed.addPage(page);
    const bytes = await trimmed.save();
    return { buffer: Buffer.from(bytes), pages, kept: maxPages };
  } catch (error) {
    console.error("PDF trim failed, sending the full document:", error);
    return { buffer: pdf, pages: 0, kept: 0 };
  }
}
