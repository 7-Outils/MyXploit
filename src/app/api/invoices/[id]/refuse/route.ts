import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    if (existing.organizationId !== effectiveOrgId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "REFUSEE",
        refusedBy: user.id,
        refusedAt: new Date(),
        acceptedBy: null,
        acceptedAt: null,
      },
      include: {
        site: { select: { id: true, name: true } },
        contract: { select: { id: true, reference: true, provider: true } },
        acceptedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        refusedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error refusing invoice:", error);
    return NextResponse.json({ error: "Erreur lors du refus" }, { status: 500 });
  }
}
