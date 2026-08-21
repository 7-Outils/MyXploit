import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Appose le tampon entreprise sur la dernière page d'un PDF (bas droite),
 * avec la mention "Bon pour accord" et la date d'acceptation.
 *
 * @param pdfBuffer  PDF original
 * @param stampImage image du tampon (PNG ou JPEG)
 * @param acceptedAt date d'acceptation du devis
 * @returns le PDF tamponné
 */
export async function stampQuotePdf(
  pdfBuffer: Buffer,
  stampImage: Buffer,
  acceptedAt: Date
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

  // PNG commence par \x89PNG, sinon on tente JPEG.
  const isPng =
    stampImage.length > 4 &&
    stampImage[0] === 0x89 &&
    stampImage[1] === 0x50 &&
    stampImage[2] === 0x4e &&
    stampImage[3] === 0x47;
  const image = isPng ? await pdf.embedPng(stampImage) : await pdf.embedJpg(stampImage);

  const page = pdf.getPage(pdf.getPageCount() - 1);
  const { width: pageWidth } = page.getSize();

  const stampWidth = 140;
  const stampHeight = (image.height / image.width) * stampWidth;
  const margin = 36;
  const x = pageWidth - stampWidth - margin;
  const y = margin + 24; // on réserve la place du texte sous le tampon

  page.drawImage(image, { x, y, width: stampWidth, height: stampHeight, opacity: 0.9 });

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const dateStr = acceptedAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const text = `Bon pour accord — accepté le ${dateStr}`;
  const textSize = 8;
  const textWidth = font.widthOfTextAtSize(text, textSize);
  page.drawText(text, {
    x: x + stampWidth / 2 - textWidth / 2,
    y: y - 14,
    size: textSize,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  return Buffer.from(await pdf.save());
}
