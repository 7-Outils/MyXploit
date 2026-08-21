import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { stampQuotePdf, stampQuotePdfWithText } from "@/lib/pdf-stamp";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadQuote(id: string, organizationId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: {
      site: { select: { name: true, city: true } },
      contract: {
        select: {
          id: true,
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

    // Candidats à l'envoi : carnet de contacts du contrat, complété par les
    // champs historiques (email exploitant du contrat, email de la fiche
    // client), dédoublonnés par adresse.
    const contacts = quote.contract?.id
      ? await prisma.contractContact.findMany({
          where: { contractId: quote.contract.id },
          orderBy: [{ side: "asc" }, { name: "asc" }],
        })
      : [];

    const recipients: { name: string; email: string; role: string | null; side: string }[] =
      contacts.map((c) => ({ name: c.name, email: c.email, role: c.role, side: c.side }));
    const seen = new Set(recipients.map((r) => r.email.toLowerCase()));

    const legacyProvider = quote.contract?.providerEmail;
    if (legacyProvider && !seen.has(legacyProvider.toLowerCase())) {
      seen.add(legacyProvider.toLowerCase());
      recipients.push({
        name: quote.contract?.provider || "Exploitant",
        email: legacyProvider,
        role: "Contrat",
        side: "EXPLOITANT",
      });
    }
    const legacyClient = quote.contract?.client?.contactEmail;
    if (legacyClient && !seen.has(legacyClient.toLowerCase())) {
      seen.add(legacyClient.toLowerCase());
      recipients.push({
        name: quote.contract?.client?.name || "Client",
        email: legacyClient,
        role: "Fiche client",
        side: "CLIENT",
      });
    }

    return NextResponse.json({
      recipients,
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
    const toList: string[] = Array.isArray(body.to)
      ? body.to.map((e: unknown) => String(e).trim()).filter(Boolean)
      : [];
    const ccList: string[] = Array.isArray(body.cc)
      ? body.cc.map((e: unknown) => String(e).trim()).filter(Boolean)
      : [];
    const withStamp = body.stamp === true;

    if (toList.length === 0) {
      return NextResponse.json(
        { error: "Au moins un destinataire est requis" },
        { status: 400 }
      );
    }
    const invalid = [...toList, ...ccList].find((e) => !EMAIL_RE.test(e));
    if (invalid) {
      return NextResponse.json(
        { error: `Adresse email invalide : ${invalid}` },
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

    const senderName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    // Tamponner si demandé : image du tampon si l'organisation en a une,
    // sinon tampon textuel "VALIDÉ / par <nom> / le <date>".
    if (withStamp) {
      const organization = await prisma.organization.findUnique({
        where: { id: effectiveOrgId },
        select: { stampUrl: true },
      });
      const acceptedAt = quote.acceptedAt ?? new Date();
      if (organization?.stampUrl) {
        const stampResponse = await fetch(organization.stampUrl);
        if (!stampResponse.ok) {
          return NextResponse.json(
            { error: "Impossible de récupérer l'image du tampon" },
            { status: 502 }
          );
        }
        const stampBuffer = Buffer.from(await stampResponse.arrayBuffer());
        pdfBuffer = await stampQuotePdf(pdfBuffer, stampBuffer, acceptedAt);
      } else {
        pdfBuffer = await stampQuotePdfWithText(pdfBuffer, senderName, acceptedAt);
      }
    }
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
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      // Les réponses (et les challenges type Mailinblack transférés) doivent
      // arriver chez l'utilisateur, pas dans la boîte noreply.
      replyTo: user.email,
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
