import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";
import { buildSchedule, contractSeasons, seasonBounds, type ContractYearInfo, type InvoiceLite } from "@/lib/billing-schedule";

/**
 * GET /api/contracts/[id]/billing-schedule?season=2025-2026
 * Les factures attendues de la saison (d'après l'échéancier) rapprochées des
 * factures reçues, avec les totaux par statut. Sans `season` : la saison en cours.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { startDate: true, endDate: true, yearType: true, yearStartMonth: true, yearStartDay: true },
  });
  if (!contract) return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
  const info: ContractYearInfo = { ...contract, yearType: contract.yearType };

  const seasons = contractSeasons(info);
  if (seasons.length === 0) {
    return NextResponse.json({ error: "Les dates de début et de fin du contrat ne sont pas renseignées" }, { status: 422 });
  }
  const requested = req.nextUrl.searchParams.get("season");
  const season = seasons.find((s) => s.key === requested) ?? seasons.find((s) => s.isCurrent) ?? seasons[seasons.length - 1];
  const bounds = seasonBounds(info, season.key);
  if (!bounds) return NextResponse.json({ error: "Saison invalide" }, { status: 400 });

  const [lines, invoices] = await Promise.all([
    prisma.contractBillingLine.findMany({ where: { contractId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.invoice.findMany({
      where: {
        contractId: id,
        OR: [
          { periodStart: { lte: bounds.end }, periodEnd: { gte: bounds.start } },
          { periodStart: null, issueDate: { gte: bounds.start, lte: new Date(bounds.end.getTime() + 120 * 86_400_000) } },
        ],
      },
      select: { id: true, reference: true, type: true, nature: true, status: true, amount: true, issueDate: true, periodStart: true, periodEnd: true },
    }),
  ]);

  const expected = buildSchedule(lines, invoices as InvoiceLite[], bounds.start, bounds.end);
  const counts = { RECUE: 0, A_VENIR: 0, ATTENDUE: 0, EN_RETARD: 0 };
  for (const e of expected) counts[e.status]++;

  // Factures de la saison non rapprochées (hors échéancier)
  const matched = new Set(expected.flatMap((e) => e.invoices.map((i) => i.id)));
  const unmatched = invoices.filter((i) => !matched.has(i.id) && i.status !== "REFUSEE");

  return NextResponse.json({
    season,
    seasons,
    lines,
    expected,
    counts,
    unmatched: unmatched.map((i) => ({ id: i.id, reference: i.reference, type: i.type, nature: i.nature, amount: i.amount, issueDate: i.issueDate, status: i.status })),
  });
}
