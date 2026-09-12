import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { archiveQuotePdfToR2, isPdfFile, MAX_QUOTE_PDF_SIZE } from "@/lib/quote-pdf";

// POST /api/invoices/[id]/document — joindre après coup le PDF d'une facture
// saisie à la main. Multipart : champ « file ». Le PDF est archivé au même
// endroit que ceux des imports ; aucune lecture IA, on ne touche pas aux
// champs saisis.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "READER") {
      return NextResponse.json({ error: "Vous n'avez pas les droits pour modifier une facture" }, { status: 403 });
    }
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const limit = await rateLimit(`invoices-document:${user.id}`, "import");
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true, contractId: true, documentUrl: true },
    });
    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (!invoice.contractId) {
      return NextResponse.json({ error: "Cette facture n'est rattachée à aucun contrat" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier PDF fourni" }, { status: 400 });
    if (!isPdfFile(file)) return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    if (file.size > MAX_QUOTE_PDF_SIZE) {
      return NextResponse.json(
        { error: `Le PDF dépasse la taille maximale de ${MAX_QUOTE_PDF_SIZE / 1024 / 1024} Mo` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentUrl = await archiveQuotePdfToR2(
      buffer,
      file.name,
      invoice.contractId,
      effectiveOrgId,
      "invoices"
    );
    if (!documentUrl) {
      return NextResponse.json({ error: "Archivage du PDF impossible, réessayez" }, { status: 502 });
    }

    await prisma.invoice.update({ where: { id: invoice.id }, data: { documentUrl } });
    return NextResponse.json({ documentUrl });
  } catch (error) {
    console.error("Error attaching invoice document:", error);
    return NextResponse.json({ error: "Erreur lors du rattachement du PDF" }, { status: 500 });
  }
}
