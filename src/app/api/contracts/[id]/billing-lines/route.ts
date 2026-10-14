import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";
import { parseLine } from "@/lib/billing-lines";


// GET /api/contracts/[id]/billing-lines — l'échéancier du contrat
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const lines = await prisma.contractBillingLine.findMany({
    where: { contractId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(lines);
}

// POST /api/contracts/[id]/billing-lines — ajoute une ligne (ou plusieurs : body = { lines: [...] })
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role === "READER") return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });

  const body = await req.json();
  const items: Record<string, unknown>[] = Array.isArray(body?.lines) ? body.lines : [body];
  const parsed = items.map(parseLine);
  const bad = parsed.find((p) => "error" in p);
  if (bad && "error" in bad) return NextResponse.json({ error: bad.error }, { status: 400 });

  const last = await prisma.contractBillingLine.findFirst({ where: { contractId: id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  let order = (last?.sortOrder ?? -1) + 1;
  const created = await prisma.$transaction(
    parsed.map((p) => prisma.contractBillingLine.create({ data: { contractId: id, ...(p as { data: NonNullable<ReturnType<typeof parseLine>["data"]> }).data, sortOrder: order++ } }))
  );
  return NextResponse.json(Array.isArray(body?.lines) ? created : created[0], { status: 201 });
}
