import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

async function assertIndexAccess(contractId: string, indexId: string, effectiveOrgId: string) {
  const index = await prisma.contractRevisionIndex.findFirst({
    where: { id: indexId, contractId, contract: { organizationId: effectiveOrgId } },
    select: { id: true },
  });
  return !!index;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; indexId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId, indexId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    if (!(await assertIndexAccess(contractId, indexId, effectiveOrgId))) {
      return NextResponse.json({ error: "Indice introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const name = (body?.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const updated = await prisma.contractRevisionIndex.update({
      where: { id: indexId },
      data: { name },
      include: { values: { orderBy: { date: "asc" } } },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Un indice avec ce nom existe déjà" }, { status: 409 });
    }
    console.error("Error updating revision index:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; indexId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId, indexId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    if (!(await assertIndexAccess(contractId, indexId, effectiveOrgId))) {
      return NextResponse.json({ error: "Indice introuvable" }, { status: 404 });
    }

    await prisma.contractRevisionIndex.delete({ where: { id: indexId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting revision index:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
