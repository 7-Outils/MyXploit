import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";

/**
 * GET /api/contracts/[id]/billing-lines/suggest
 * Le vocabulaire de l'organisation : les lignes déjà utilisées sur ses autres
 * contrats, dédoublonnées par libellé (réglage le plus fréquent), les plus
 * utilisées d'abord. Rien n'est enregistré.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const lines = await prisma.contractBillingLine.findMany({
    where: { contract: { organizationId: auth.effectiveOrgId }, contractId: { not: id } },
    select: { label: true, poste: true, countPerYear: true, periods: true, percents: true },
  });

  const byLabel = new Map<string, { label: string; poste: string | null; countPerYear: number; periods: number[]; percents: number[]; uses: number }>();
  for (const l of lines) {
    const key = l.label.trim().toLowerCase();
    const cur = byLabel.get(key);
    if (cur) cur.uses += 1;
    else byLabel.set(key, { ...l, uses: 1 });
  }
  const suggestions = Array.from(byLabel.values()).sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label, "fr"));
  return NextResponse.json({ suggestions });
}
