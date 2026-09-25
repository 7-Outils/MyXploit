import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { dateToSeason } from "@/lib/heating-season";
import { authorizeContract, findOpenRequest, loadContractSitesHeating, todayParisIso } from "@/lib/heating-status";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// POST /api/contracts/[id]/heating-requests
// Envoie à l'exploitant une demande d'allumage ou d'arrêt du chauffage pour
// une date donnée, et pose cette date en provisoire sur les sites concernés.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const auth = await authorizeContract(contractId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user, effectiveOrgId, contract } = auth;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Vous n'avez pas les droits pour envoyer une demande" }, { status: 403 });
    }
    const limit = await rateLimit(`heating-requests:${user.id}`, "import");
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    const body = await request.json();
    const type = body.type === "ALLUMAGE" || body.type === "ARRET" ? body.type : null;
    const requestedDate: string = typeof body.requestedDate === "string" ? body.requestedDate : "";
    const siteIds: string[] = Array.isArray(body.siteIds) ? body.siteIds.map(String) : [];
    const toList: string[] = Array.isArray(body.to) ? body.to.map((e: unknown) => String(e).trim()).filter(Boolean) : [];
    const ccList: string[] = Array.isArray(body.cc) ? body.cc.map((e: unknown) => String(e).trim()).filter(Boolean) : [];
    const message: string = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (!type) return NextResponse.json({ error: "Type de demande invalide" }, { status: 400 });
    if (!DATE_RE.test(requestedDate)) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    if (siteIds.length === 0) return NextResponse.json({ error: "Aucun site sélectionné" }, { status: 400 });
    if (toList.length === 0) return NextResponse.json({ error: "Aucun destinataire" }, { status: 400 });
    const badEmail = [...toList, ...ccList].find((e) => !EMAIL_RE.test(e));
    if (badEmail) return NextResponse.json({ error: `Adresse invalide : ${badEmail}` }, { status: 400 });

    if (await findOpenRequest(contractId)) {
      return NextResponse.json(
        { error: "Une demande est déjà en cours pour ce contrat. Confirmez-la ou annulez-la d'abord." },
        { status: 409 }
      );
    }

    const todayIso = todayParisIso();
    const sites = await loadContractSitesHeating(contractId, todayIso);
    const byId = new Map(sites.map((s) => [s.id, s]));
    const requested = siteIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);

    // Sites éligibles : à l'arrêt pour un allumage, en chauffe pour un arrêt.
    const eligible = requested.filter((s) => (type === "ALLUMAGE" ? s.status === "ARRETE" : s.status === "EN_CHAUFFE"));
    const skipped = requested.filter((s) => !eligible.includes(s)).map((s) => s.id);
    if (eligible.length === 0) {
      return NextResponse.json(
        { error: type === "ALLUMAGE" ? "Aucun site à l'arrêt parmi la sélection" : "Aucun site en chauffe parmi la sélection" },
        { status: 400 }
      );
    }

    const date = new Date(requestedDate + "T00:00:00Z");
    const season = dateToSeason(new Date(requestedDate + "T12:00:00"));

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.heatingSwitchRequest.create({
        data: {
          contractId,
          organizationId: effectiveOrgId,
          type,
          season,
          requestedDate: date,
          sentTo: { to: toList, cc: ccList, siteIds: eligible.map((s) => s.id) },
          message: message || null,
          createdById: user.id,
        },
      });
      if (type === "ALLUMAGE") {
        await tx.heatingPeriod.createMany({
          data: eligible.map((s) => ({
            siteId: s.id,
            startDate: date,
            startProvisional: true,
            startRequestId: req.id,
          })),
        });
      } else {
        await tx.heatingPeriod.updateMany({
          where: { id: { in: eligible.map((s) => s.period!.id) } },
          data: { endDate: date, endProvisional: true, endRequestId: req.id },
        });
      }
      return req;
    });

    const senderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const verb = type === "ALLUMAGE" ? "allumage" : "arrêt";
    const collectivite = contract.client?.name ?? contract.title;
    const rows = eligible
      .map(
        (s) =>
          `<tr><td style="padding: 4px 16px 4px 0; border-bottom: 1px solid #eee;">${escapeHtml(s.name)}</td>` +
          `<td style="padding: 4px 0; border-bottom: 1px solid #eee; color: #6b6b6b;">${escapeHtml([s.address, s.postalCode, s.city].filter(Boolean).join(", "))}</td></tr>`
      )
      .join("");
    const html = `
      <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a; max-width: 640px;">
        <p>Bonjour,</p>
        <p>Nous vous demandons de procéder à l'<strong>${verb} du chauffage</strong> des installations ci-dessous
        <strong>à partir du ${fmtDate(requestedDate)}</strong>.</p>
        <table style="border-collapse: collapse; font-size: 14px; margin: 8px 0;">
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Collectivité</td><td style="padding: 4px 0;"><strong>${escapeHtml(collectivite)}</strong></td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Contrat</td><td style="padding: 4px 0;">${escapeHtml(contract.reference)} — ${escapeHtml(contract.title)}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #6b6b6b;">Sites</td><td style="padding: 4px 0;">${eligible.length}</td></tr>
        </table>
        <table style="border-collapse: collapse; font-size: 14px; width: 100%;">${rows}</table>
        ${message ? `<p style="margin-top: 16px; padding: 8px 12px; border-left: 3px solid #1a1a1a; background: #f5f5f5;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}
        <p>Merci de nous confirmer la date effective de ${verb} pour chaque site, en répondant à cet email.</p>
        <p style="color: #6b6b6b; font-size: 13px;">Email envoyé par ${escapeHtml(senderName)} via MyXploit.</p>
      </div>
    `;

    try {
      await sendEmail({
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        // Les réponses (et les challenges type Mailinblack) doivent arriver
        // chez l'utilisateur, pas dans la boîte noreply.
        replyTo: user.email,
        subject: `Demande d'${verb} du chauffage — ${collectivite} — à partir du ${fmtDate(requestedDate)}`,
        html,
      });
    } catch (e) {
      // Envoi raté : on défait tout, la demande n'a pas eu lieu.
      console.error("[heating-requests] envoi email échoué:", e);
      await prisma.$transaction(async (tx) => {
        if (type === "ALLUMAGE") {
          await tx.heatingPeriod.deleteMany({ where: { startRequestId: created.id } });
        } else {
          await tx.heatingPeriod.updateMany({
            where: { endRequestId: created.id },
            data: { endDate: null, endProvisional: false, endRequestId: null },
          });
        }
        await tx.heatingSwitchRequest.delete({ where: { id: created.id } });
      });
      return NextResponse.json({ error: "L'envoi de l'email a échoué, la demande n'a pas été enregistrée" }, { status: 502 });
    }

    return NextResponse.json({ request: created, skipped }, { status: 201 });
  } catch (error) {
    console.error("Error creating heating request:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
