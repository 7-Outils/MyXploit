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

/**
 * Variante sans image : appose un tampon textuel encadré
 * "VALIDÉ / par <nom> / le <date>" en bas à droite de la dernière page.
 * Utilisée quand l'organisation n'a pas de tampon configuré.
 */
export async function stampQuotePdfWithText(
  pdfBuffer: Buffer,
  validatorName: string,
  acceptedAt: Date
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const page = pdf.getPage(pdf.getPageCount() - 1);
  const { width: pageWidth } = page.getSize();

  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const dateStr = acceptedAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  // Encre bleu foncé, façon tampon administratif
  const inkColor = rgb(0.13, 0.22, 0.5);

  const title = "VALIDÉ";
  const line1 = `par ${validatorName}`;
  const line2 = `le ${dateStr}`;

  const titleSize = 14;
  const lineSize = 9;
  const padding = 10;
  const contentWidth = Math.max(
    fontBold.widthOfTextAtSize(title, titleSize),
    font.widthOfTextAtSize(line1, lineSize),
    font.widthOfTextAtSize(line2, lineSize)
  );
  const boxWidth = contentWidth + padding * 2;
  const boxHeight = titleSize + lineSize * 2 + 8 + padding * 2;

  const margin = 36;
  const x = pageWidth - boxWidth - margin;
  const y = margin;

  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    borderColor: inkColor,
    borderWidth: 1.5,
    opacity: 0,
    borderOpacity: 0.85,
  });

  const centerX = x + boxWidth / 2;
  let cursorY = y + boxHeight - padding - titleSize;
  page.drawText(title, {
    x: centerX - fontBold.widthOfTextAtSize(title, titleSize) / 2,
    y: cursorY,
    size: titleSize,
    font: fontBold,
    color: inkColor,
    opacity: 0.85,
  });
  cursorY -= lineSize + 5;
  page.drawText(line1, {
    x: centerX - font.widthOfTextAtSize(line1, lineSize) / 2,
    y: cursorY,
    size: lineSize,
    font,
    color: inkColor,
    opacity: 0.85,
  });
  cursorY -= lineSize + 3;
  page.drawText(line2, {
    x: centerX - font.widthOfTextAtSize(line2, lineSize) / 2,
    y: cursorY,
    size: lineSize,
    font,
    color: inkColor,
    opacity: 0.85,
  });

  return Buffer.from(await pdf.save());
}
