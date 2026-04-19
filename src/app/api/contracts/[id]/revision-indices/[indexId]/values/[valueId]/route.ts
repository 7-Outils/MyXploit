import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

async function assertValueAccess(
  contractId: string,
  indexId: string,
  valueId: string,
  effectiveOrgId: string
) {
  const value = await prisma.contractRevisionIndexValue.findFirst({
    where: {
      id: valueId,
      indexId,
      index: { contractId, contract: { organizationId: effectiveOrgId } },
    },
    select: { id: true },
  });
  return !!value;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; indexId: string; valueId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId, indexId, valueId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    if (!(await assertValueAccess(contractId, indexId, valueId, effectiveOrgId))) {
      return NextResponse.json({ error: "Valeur introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const data: { date?: Date; value?: number; isProvisional?: boolean } = {};

    if (body?.date !== undefined) {
      const d = new Date(body.date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      data.date = d;
    }
    if (body?.value !== undefined) {
      const v = typeof body.value === "number" ? body.value : parseFloat(body.value);
      if (!Number.isFinite(v)) {
        return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
      }
      data.value = v;
    }
    if (body?.isProvisional !== undefined) {
      data.isProvisional = !!body.isProvisional;
    }

    const updated = await prisma.contractRevisionIndexValue.update({
      where: { id: valueId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Une valeur existe déjà pour cette date" }, { status: 409 });
    }
    console.error("Error updating index value:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; indexId: string; valueId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId, indexId, valueId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    if (!(await assertValueAccess(contractId, indexId, valueId, effectiveOrgId))) {
      return NextResponse.json({ error: "Valeur introuvable" }, { status: 404 });
    }

    await prisma.contractRevisionIndexValue.delete({ where: { id: valueId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting index value:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
