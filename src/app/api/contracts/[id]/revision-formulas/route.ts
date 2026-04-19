import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { RevisionPType, RevisionPeriod } from "@/generated/prisma/client";

const P_TYPES: RevisionPType[] = ["P1", "P2", "P3"];
const PERIODICITIES: RevisionPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"];

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

    const formulas = await prisma.contractRevisionFormula.findMany({
      where: { contractId },
      include: {
        components: {
          include: { index: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(formulas);
  } catch (error) {
    console.error("Error fetching revision formulas:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PUT body: { pType, periodicity, baseDate, constantPart, components: [{indexId, coefficient, baseValue}] }
// Si components vide ou null → supprime la formule (désactivation)
export async function PUT(
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
    const pType = body?.pType as RevisionPType;
    if (!P_TYPES.includes(pType)) {
      return NextResponse.json({ error: "pType invalide" }, { status: 400 });
    }

    // Suppression explicite (désactivation de la révision pour ce P)
    if (body?.enabled === false) {
      await prisma.contractRevisionFormula.deleteMany({ where: { contractId, pType } });
      return NextResponse.json({ success: true, deleted: true });
    }

    const periodicity = (body?.periodicity ?? "ANNUAL") as RevisionPeriod;
    if (!PERIODICITIES.includes(periodicity)) {
      return NextResponse.json({ error: "Périodicité invalide" }, { status: 400 });
    }

    const baseDate = body?.baseDate ? new Date(body.baseDate) : null;
    if (!baseDate || isNaN(baseDate.getTime())) {
      return NextResponse.json({ error: "Date de base invalide" }, { status: 400 });
    }

    const constantPart = typeof body?.constantPart === "number" ? body.constantPart : parseFloat(body?.constantPart ?? "0");
    if (!Number.isFinite(constantPart)) {
      return NextResponse.json({ error: "Partie constante invalide" }, { status: 400 });
    }

    const roundingDecimalsRaw = typeof body?.roundingDecimals === "number" ? body.roundingDecimals : parseInt(String(body?.roundingDecimals ?? "4"), 10);
    const roundingDecimals = Number.isFinite(roundingDecimalsRaw) ? Math.max(0, Math.min(10, roundingDecimalsRaw)) : 4;

    const rawComponents: { indexId?: string; coefficient?: number | string; baseValue?: number | string; reconnectionCoef?: number | string }[] =
      Array.isArray(body?.components) ? body.components : [];
    const components: { indexId: string; coefficient: number; baseValue: number; reconnectionCoef: number }[] = rawComponents.map((c) => ({
      indexId: (c.indexId ?? "").toString(),
      coefficient: typeof c.coefficient === "number" ? c.coefficient : parseFloat(String(c.coefficient ?? "0")),
      baseValue: typeof c.baseValue === "number" ? c.baseValue : parseFloat(String(c.baseValue ?? "0")),
      reconnectionCoef: typeof c.reconnectionCoef === "number" ? c.reconnectionCoef : parseFloat(String(c.reconnectionCoef ?? "1")),
    }));

    for (const c of components) {
      if (!c.indexId || !Number.isFinite(c.coefficient) || !Number.isFinite(c.baseValue) || c.baseValue === 0) {
        return NextResponse.json({ error: "Composante invalide" }, { status: 400 });
      }
      if (!Number.isFinite(c.reconnectionCoef) || c.reconnectionCoef <= 0) {
        c.reconnectionCoef = 1;
      }
    }

    const indexIds = components.map((c) => c.indexId);
    if (indexIds.length > 0) {
      const owned = await prisma.contractRevisionIndex.count({
        where: { contractId, id: { in: indexIds } },
      });
      if (owned !== new Set(indexIds).size) {
        return NextResponse.json({ error: "Un indice référencé n'appartient pas au contrat" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.contractRevisionFormula.findUnique({
        where: { contractId_pType: { contractId, pType } },
      });

      if (existing) {
        await tx.contractFormulaComponent.deleteMany({ where: { formulaId: existing.id } });
        const updated = await tx.contractRevisionFormula.update({
          where: { id: existing.id },
          data: {
            periodicity,
            baseDate,
            constantPart,
            roundingDecimals,
            components: { create: components },
          },
          include: {
            components: { include: { index: { select: { id: true, name: true } } } },
          },
        });
        return updated;
      }

      const created = await tx.contractRevisionFormula.create({
        data: {
          contractId,
          pType,
          periodicity,
          baseDate,
          constantPart,
          roundingDecimals,
          components: { create: components },
        },
        include: {
          components: { include: { index: { select: { id: true, name: true } } } },
        },
      });
      return created;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving revision formula:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
