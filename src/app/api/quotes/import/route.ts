import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  parseQuotePDF,
  findSiteMatch,
  ParsedQuote,
} from "@/lib/pdf-parser";
import { parseWithGemini } from "@/lib/gemini-pdf-parser";
import { getGeminiApiKey } from "@/lib/gemini-key";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { randomUUID } from "crypto";

// Le PDF part intégralement en tokens d'entrée chez Gemini : sans plafond,
// un fichier volumineux ou une boucle de retry se paie directement.
const MAX_PDF_SIZE = 10 * 1024 * 1024;

export interface ImportResult {
  success: boolean;
  parsed: ParsedQuote;
  siteMatched: boolean;
  matchedSite?: { id: string; name: string };
  documentUrl?: string;
  error?: string;
}

// Archive le PDF original dans R2, rangé par client puis par contrat, pour que
// le devis reste consultable après import. Échec non bloquant : l'analyse du
// PDF a plus de valeur que son archivage.
async function archivePdfToR2(
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
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "devis";
    const key = `quotes/${contract.clientId ?? "sans-client"}/${contractId}/${randomUUID()}-${safeName}.pdf`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
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

// POST /api/quotes/import - Import a quote from PDF
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer un devis" },
        { status: 403 }
      );
    }

    const limit = await rateLimit(`quotes-import:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    // Get form data with PDF file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contractId = formData.get("contractId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier PDF fourni" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Le fichier doit être un PDF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `Le PDF dépasse la taille maximale de ${MAX_PDF_SIZE / 1024 / 1024} Mo` },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse PDF — Gemini d'abord (si configuré), fallback regex
    let parsed: ParsedQuote;
    let source: "gemini" | "regex" = "regex";

    const geminiKey = await getGeminiApiKey(effectiveOrgId);
    try {
      if (geminiKey) {
        const geminiResult = await parseWithGemini(buffer, geminiKey);
        if (geminiResult) {
          parsed = geminiResult;
          source = "gemini";
        } else {
          parsed = await parseQuotePDF(buffer);
        }
      } else {
        parsed = await parseQuotePDF(buffer);
      }
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError);
      return NextResponse.json(
        { error: "Erreur lors de l'analyse du PDF", details: pdfError instanceof Error ? pdfError.message : String(pdfError) },
        { status: 400 }
      );
    }

    // Try to find matching site
    let matchedSite: { id: string; name: string } | null = null;

    if (parsed.siteName || parsed.siteCity) {
      const sites = await prisma.site.findMany({
        where: { organizationId: effectiveOrgId },
        select: { id: true, name: true, city: true, address: true },
      });
      matchedSite = findSiteMatch(parsed.siteName, parsed.siteCity, sites);
    }

    // Archiver le PDF original dans R2 (rangé par client/contrat) pour
    // consultation ultérieure. Sans contractId (ex: import de facture depuis
    // la page Financier), on ne stocke rien.
    let documentUrl: string | null = null;
    if (contractId) {
      documentUrl = await archivePdfToR2(buffer, file.name, contractId, effectiveOrgId);
    }

    // Return parsed data for preview
    const result: ImportResult & { source?: string } = {
      success: true,
      parsed,
      siteMatched: !!matchedSite,
      matchedSite: matchedSite || undefined,
      documentUrl: documentUrl || undefined,
      source,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error importing quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import du devis", details: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
