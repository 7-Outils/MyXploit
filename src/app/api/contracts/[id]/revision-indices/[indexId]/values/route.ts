import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export async function POST(
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

    const index = await prisma.contractRevisionIndex.findFirst({
      where: { id: indexId, contractId, contract: { organizationId: effectiveOrgId } },
      select: { id: true },
    });
    if (!index) {
      return NextResponse.json({ error: "Indice introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const date = body?.date ? new Date(body.date) : null;
    const value = typeof body?.value === "number" ? body.value : parseFloat(body?.value);
    const isProvisional = !!body?.isProvisional;

    if (!date || isNaN(date.getTime())) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
    }

    const created = await prisma.contractRevisionIndexValue.create({
      data: { indexId, date, value, isProvisional },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Une valeur existe déjà pour cette date" }, { status: 409 });
    }
    console.error("Error creating index value:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
