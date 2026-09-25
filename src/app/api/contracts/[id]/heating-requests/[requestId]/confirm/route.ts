import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/contracts/[id]/heating-requests/[requestId]/confirm
// Body { sites: [{ siteId, date }] } : confirme site par site la date réelle
// d'allumage/arrêt. La demande se ferme quand plus rien n'est provisoire.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: contractId, requestId } = await params;
    const auth = await authorizeContract(contractId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.user.role === "READER") {
      return NextResponse.json({ error: "Vous n'avez pas les droits pour confirmer une demande" }, { status: 403 });
    }

    const req = await prisma.heatingSwitchRequest.findFirst({
      where: { id: requestId, contractId, closedAt: null, cancelledAt: null },
    });
    if (!req) return NextResponse.json({ error: "Demande introuvable ou déjà close" }, { status: 404 });

    const body = await request.json();
    const items: { siteId: string; date: string }[] = Array.isArray(body.sites)
      ? body.sites
          .map((s: { siteId?: unknown; date?: unknown }) => ({ siteId: String(s.siteId ?? ""), date: String(s.date ?? "") }))
          .filter((s: { siteId: string; date: string }) => s.siteId && DATE_RE.test(s.date))
      : [];
    if (items.length === 0) return NextResponse.json({ error: "Aucun site à confirmer" }, { status: 400 });

    const isStart = req.type === "ALLUMAGE";
    const pending = await prisma.heatingPeriod.findMany({
      where: isStart
        ? { startRequestId: req.id, startProvisional: true }
        : { endRequestId: req.id, endProvisional: true },
      select: { id: true, siteId: true },
    });
    const bySite = new Map(pending.map((p) => [p.siteId, p.id]));

    let confirmed = 0;
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const periodId = bySite.get(item.siteId);
        if (!periodId) continue;
        const date = new Date(item.date + "T00:00:00Z");
        await tx.heatingPeriod.update({
          where: { id: periodId },
          data: isStart
            ? { startDate: date, startProvisional: false }
            : { endDate: date, endProvisional: false },
        });
        confirmed++;
      }
      const remaining = await tx.heatingPeriod.count({
        where: isStart
          ? { startRequestId: req.id, startProvisional: true }
          : { endRequestId: req.id, endProvisional: true },
      });
      if (remaining === 0) {
        await tx.heatingSwitchRequest.update({ where: { id: req.id }, data: { closedAt: new Date() } });
      }
    });

    const remaining = pending.length - confirmed;
    return NextResponse.json({ confirmed, remaining, closed: remaining === 0 });
  } catch (error) {
    console.error("Error confirming heating request:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
