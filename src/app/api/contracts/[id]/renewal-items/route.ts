import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

const itemSchema = z.object({
  label: z.string().min(1).max(300),
  plannedYear: z.number().int().min(1990).max(2100),
  amountHT: z.number().min(0),
  status: z.enum(["PREVU", "REALISE", "REPORTE", "ABANDONNE"]).optional(),
  source: z.enum(["PLAN_INITIAL", "AVENANT", "DEVIS_P3"]).optional(),
  siteId: z.string().nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const postSchema = z.object({ items: z.array(itemSchema).min(1).max(500) });

// GET /api/contracts/[id]/renewal-items — plan de renouvellement du contrat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const items = await prisma.contractRenewalItem.findMany({
      where: { contractId },
      include: {
        site: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, type: true } },
        quote: { select: { id: true, reference: true } },
      },
      orderBy: [{ plannedYear: "asc" }, { amountHT: "desc" }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET renewal-items error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/contracts/[id]/renewal-items — création en lot (saisie ou import IA validé)
export async function POST(
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
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Les rattachements doivent rester dans l'organisation
    const siteIds = [
      ...new Set(
        parsed.data.items.map((i) => i.siteId).filter((s): s is string => !!s)
      ),
    ];
    const validSites = new Set(
      (
        await prisma.site.findMany({
          where: { id: { in: siteIds }, organizationId: effectiveOrgId },
          select: { id: true },
        })
      ).map((s) => s.id)
    );

    const created = await prisma.$transaction(
      parsed.data.items.map((item) =>
        prisma.contractRenewalItem.create({
          data: {
            contractId,
            organizationId: effectiveOrgId,
            label: item.label,
            plannedYear: item.plannedYear,
            amountHT: item.amountHT,
            status: item.status || "PREVU",
            source: item.source || "PLAN_INITIAL",
            siteId: item.siteId && validSites.has(item.siteId) ? item.siteId : null,
            equipmentId: item.equipmentId || null,
            quoteId: item.quoteId || null,
            notes: item.notes || null,
          },
        })
      )
    );

    return NextResponse.json({ created: created.length }, { status: 201 });
  } catch (error) {
    console.error("POST renewal-items error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
