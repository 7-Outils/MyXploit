import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import prisma from "@/lib/prisma";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";

export const MAX_QUOTE_PDF_SIZE = 10 * 1024 * 1024;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Archive le PDF d'un devis dans R2, rangé par client puis par contrat, pour
 * qu'il reste consultable depuis la fiche. Partagé entre l'import (le PDF
 * arrive avant le devis) et le rattachement après coup (le devis existe déjà).
 * Échec non bloquant : renvoie null, l'appelant décide.
 */
export async function archiveQuotePdfToR2(
  buffer: Buffer,
  originalName: string,
  contractId: string,
  organizationId: string
): Promise<string | null> {
  if (!process.env.R2_ACCOUNT_ID) return null;
  try {
    // Le contrat doit appartenir à l'organisation : sans ce filtre, un
    // contractId arbitraire rangerait le PDF chez un autre client.
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId },
      select: { clientId: true },
    });
    if (!contract) return null;

    const safeName = originalName
      .replace(/\.pdf$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "devis";
    const key = `quotes/${contract.clientId ?? "sans-client"}/${contractId}/${randomUUID()}-${safeName}.pdf`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        // Clés uniques (uuid) : cache navigateur immuable, fini les rechargements
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: "application/pdf",
      })
    );

    return R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.r2.dev/${key}`;
  } catch (error) {
    console.error("Error archiving quote PDF to R2:", error);
    return null;
  }
}
