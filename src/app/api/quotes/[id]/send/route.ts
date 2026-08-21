import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { stampQuotePdf } from "@/lib/pdf-stamp";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadQuote(id: string, organizationId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: {
      site: { select: { name: true, city: true } },
      contract: {
        select: {
          reference: true,
          provider: true,
          providerEmail: true,
          client: { select: { name: true, contactEmail: true } },
        },
      },
    },
  });
  return quote;
}

// GET /api/quotes/[id]/send - Pré-remplissage de la modale d'envoi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const quote = await loadQuote(id, effectiveOrgId);
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { stampUrl: true },
    });

    return NextResponse.json({
      to: quote.contract?.providerEmail || "",
      cc: quote.contract?.client?.contactEmail || "",
      providerName: quote.contract?.provider || quote.provider,
      clientName: quote.contract?.client?.name || null,
      hasPdf: !!quote.documentUrl,
      hasStamp: !!organization?.stampUrl,
    });
  } catch (error) {
    console.error("Error fetching quote send info:", error);
    return NextResponse.json(
      { error: "Erreur lors de la préparation de l'envoi" },
      { status: 500 }
    );
  }
}

// POST /api/quotes/[id]/send - Envoie le devis accepté (PDF joint, tamponné
// si demandé) à l'exploitant, client en copie.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour envoyer un devis" },
        { status: 403 }
      );
    }

    const limit = await rateLimit(`quotes-send:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    const body = await request.json();
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const cc = typeof body.cc === "string" ? body.cc.trim() : "";
    const withStamp = body.stamp === true;

    if (!EMAIL_RE.test(to)) {
      return NextResponse.json(
        { error: "Adresse email de l'exploitant invalide" },
        { status: 400 }
      );
    }
    if (cc && !EMAIL_RE.test(cc)) {
      return NextResponse.json(
        { error: "Adresse email en copie invalide" },
        { status: 400 }
      );
    }

    const quote = await loadQuote(id, effectiveOrgId);
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }
    if (!quote.documentUrl) {
      return NextResponse.json(
        { error: "Ce devis n'a pas de PDF joint : envoi impossible" },
        { status: 400 }
      );
    }

    // Récupérer le PDF archivé dans R2
    const pdfResponse = await fetch(quote.documentUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Impossible de récupérer le PDF du devis" },
        { status: 502 }
      );
    }
    let pdfBuffer: Buffer = Buffer.from(await pdfResponse.arrayBuffer());

    // Tamponner si demandé et si l'organisation a un tampon
    if (withStamp) {
      const organization = await prisma.organization.findUnique({
        where: { id: effectiveOrgId },
        select: { stampUrl: true },
      });
      if (!organization?.stampUrl) {
        return NextResponse.json(
          { error: "Aucun tampon configuré pour votre organisation (Paramètres)" },
          { status: 400 }
        );
      }
      const stampResponse = await fetch(organization.stampUrl);
      if (!stampResponse.ok) {
        return NextResponse.json(
          { error: "Impossible de récupérer l'image du tampon" },
          { status: 502 }
        );
      }
      const stampBuffer = Buffer.from(await stampResponse.arrayBuffer());
      pdfBuffer = await stampQuotePdf(pdfBuffer, stampBuffer, quote.acceptedAt ?? new Date());
    }

    const senderName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const amountFmt = (n: number) =>
      n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const html = `
      <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a; max-width: 600px;">
        <p>Bonjour,</p>
        <p>Le devis suivant a été <strong>accepté</strong> :</p>
        <table style="border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Référence</td><td style="padding: 4px 0;"><strong>${quote.reference}</strong></td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Objet</td><td style="padding: 4px 0;">${quote.title}</td></tr>
          ${quote.site ? `<tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Site</td><td style="padding: 4px 0;">${quote.site.name}${quote.site.city ? ` (${quote.site.city})` : ""}</td></tr>` : ""}
          ${quote.contract ? `<tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Contrat</td><td style="padding: 4px 0;">${quote.contract.reference}</td></tr>` : ""}
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Montant HT</td><td style="padding: 4px 0;">${amountFmt(quote.amountHT)} €</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Montant TTC</td><td style="padding: 4px 0;">${amountFmt(quote.amountTTC)} €</td></tr>
        </table>
        <p>Vous trouverez le devis${withStamp ? " tamponné" : ""} en pièce jointe.</p>
        <p style="color: #6b6b6b; font-size: 13px;">Email envoyé par ${senderName} via MyXploit.</p>
      </div>
    `;

    await sendEmail({
      to,
      cc: cc ? [cc] : undefined,
      subject: `Devis accepté — ${quote.reference}${quote.site ? ` — ${quote.site.name}` : ""}`,
      html,
      attachments: [
        {
          filename: `devis-${quote.reference.replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du devis" },
      { status: 500 }
    );
  }
}
