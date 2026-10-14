import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";
import { suggestLines } from "@/lib/billing-schedule";

// GET /api/contracts/[id]/billing-lines/suggest — lignes proposées d'après les types de marché des sites (rien n'est enregistré)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { yearStartMonth: true, contractSites: { select: { contractType: true, hasP1: true, hasP2: true, hasP3: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
  return NextResponse.json({ suggestions: suggestLines(contract.contractSites, contract.yearStartMonth), siteCount: contract.contractSites.length });
}
