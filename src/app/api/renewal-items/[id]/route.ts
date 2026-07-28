import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

const patchSchema = z.object({
  label: z.string().min(1).max(300).optional(),
  plannedYear: z.number().int().min(1990).max(2100).optional(),
  amountHT: z.number().min(0).optional(),
  status: z.enum(["PREVU", "REALISE", "REPORTE", "ABANDONNE"]).optional(),
  source: z.enum(["PLAN_INITIAL", "AVENANT", "DEVIS_P3"]).optional(),
  siteId: z.string().nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

async function findOwnedItem(id: string, organizationId: string) {
  return prisma.contractRenewalItem.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
}

// PATCH /api/renewal-items/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    if (user.role === "READER") {
      return NextResponse.json({ error: "Lecture seule" }, { status: 403 });
    }
    const { id } = await params;

    if (!(await findOwnedItem(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Poste non trouvé" }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.contractRenewalItem.update({
      where: { id },
      data: parsed.data,
      include: {
        site: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, type: true } },
        quote: { select: { id: true, reference: true } },
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("PATCH renewal-items/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/renewal-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    if (user.role === "READER") {
      return NextResponse.json({ error: "Lecture seule" }, { status: 403 });
    }
    const { id } = await params;

    if (!(await findOwnedItem(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Poste non trouvé" }, { status: 404 });
    }

    await prisma.contractRenewalItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE renewal-items/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
