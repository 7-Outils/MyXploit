import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";
import { parseLine } from "@/lib/billing-lines";

type P = { params: Promise<{ id: string; lineId: string }> };

// PUT /api/contracts/[id]/billing-lines/[lineId]
export async function PUT(req: NextRequest, { params }: P) {
  const { id, lineId } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role === "READER") return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });

  const existing = await prisma.contractBillingLine.findFirst({ where: { id: lineId, contractId: id } });
  if (!existing) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });

  const body = await req.json();
  const parsed = parseLine({ ...existing, ...body });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const sortOrder = Number.isInteger(body.sortOrder) ? body.sortOrder : existing.sortOrder;
  const updated = await prisma.contractBillingLine.update({ where: { id: lineId }, data: { ...parsed.data, sortOrder } });
  return NextResponse.json(updated);
}

// DELETE /api/contracts/[id]/billing-lines/[lineId]
export async function DELETE(_req: NextRequest, { params }: P) {
  const { id, lineId } = await params;
  const auth = await authorizeContract(id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role === "READER") return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
  const r = await prisma.contractBillingLine.deleteMany({ where: { id: lineId, contractId: id } });
  if (r.count === 0) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
  return NextResponse.json({ success: true });
}
