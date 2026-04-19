import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

async function assertContractAccess(contractId: string, effectiveOrgId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: effectiveOrgId },
    select: { id: true },
  });
  return !!contract;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    if (!(await assertContractAccess(contractId, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const indices = await prisma.contractRevisionIndex.findMany({
      where: { contractId },
      orderBy: { name: "asc" },
      include: {
        values: { orderBy: { date: "asc" } },
      },
    });

    return NextResponse.json(indices);
  } catch (error) {
    console.error("Error fetching revision indices:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    if (!(await assertContractAccess(contractId, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const name = (body?.name ?? "").toString().trim();
    const identifier = body?.identifier ? body.identifier.toString().trim() || null : null;
    if (!name) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const created = await prisma.contractRevisionIndex.create({
      data: { contractId, name, identifier },
      include: { values: true },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Cet indice existe déjà sur ce contrat" }, { status: 409 });
    }
    console.error("Error creating revision index:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
