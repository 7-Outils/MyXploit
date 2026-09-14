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

// PUT (ou POST) body :
// {
//   pType, periodicity, firstRevisionDate, indexLagMonths, constantPart,
//   roundingDecimals, baseDate?,
//   components: [{ indexId? | indexName?, coefficient, baseValue, reconnectionCoef }]
// }
// - un terme peut désigner son indice par `indexName` : l'indice est créé sur
//   le contrat s'il n'existe pas (unique contractId+name) ;
// - `baseDate` est facultatif : à défaut on garde celui de la formule
//   existante, sinon `firstRevisionDate`.
// - `enabled: false` → supprime la formule (désactivation).
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

    const existingFormula = await prisma.contractRevisionFormula.findUnique({
      where: { contractId_pType: { contractId, pType } },
      select: { id: true, baseDate: true },
    });

    let firstRevisionDate: Date | null = null;
    if (body?.firstRevisionDate) {
      const d = new Date(body.firstRevisionDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Première échéance invalide" },
          { status: 400 }
        );
      }
      firstRevisionDate = d;
    }

    let indexLagMonths: number | null = null;
    if (body?.indexLagMonths !== null && body?.indexLagMonths !== undefined && body?.indexLagMonths !== "") {
      const raw =
        typeof body.indexLagMonths === "number"
          ? body.indexLagMonths
          : parseInt(String(body.indexLagMonths), 10);
      if (!Number.isFinite(raw) || raw < 0 || raw > 36) {
        return NextResponse.json(
          { error: "Décalage d'indice invalide (0 à 36 mois)" },
          { status: 400 }
        );
      }
      indexLagMonths = raw;
    }

    // baseDate reste obligatoire en base : à défaut on reprend l'existante,
    // puis la première échéance.
    const baseDateRaw = body?.baseDate
      ? new Date(body.baseDate)
      : (existingFormula?.baseDate ?? firstRevisionDate);
    const baseDate = baseDateRaw && !isNaN(baseDateRaw.getTime()) ? baseDateRaw : null;
    if (!baseDate) {
      return NextResponse.json({ error: "Date de base invalide" }, { status: 400 });
    }

    const constantPart = typeof body?.constantPart === "number" ? body.constantPart : parseFloat(body?.constantPart ?? "0");
    if (!Number.isFinite(constantPart)) {
      return NextResponse.json({ error: "Partie constante invalide" }, { status: 400 });
    }

    const roundingDecimalsRaw = typeof body?.roundingDecimals === "number" ? body.roundingDecimals : parseInt(String(body?.roundingDecimals ?? "4"), 10);
    const roundingDecimals = Number.isFinite(roundingDecimalsRaw) ? Math.max(0, Math.min(10, roundingDecimalsRaw)) : 4;

    const rawComponents: {
      indexId?: string;
      indexName?: string;
      coefficient?: number | string;
      baseValue?: number | string;
      reconnectionCoef?: number | string;
    }[] = Array.isArray(body?.components) ? body.components : [];

    const components: {
      indexId: string;
      indexName: string;
      coefficient: number;
      baseValue: number;
      reconnectionCoef: number;
    }[] = rawComponents.map((c) => ({
      indexId: (c.indexId ?? "").toString().trim(),
      indexName: (c.indexName ?? "").toString().trim(),
      coefficient: typeof c.coefficient === "number" ? c.coefficient : parseFloat(String(c.coefficient ?? "0")),
      baseValue: typeof c.baseValue === "number" ? c.baseValue : parseFloat(String(c.baseValue ?? "0")),
      reconnectionCoef: typeof c.reconnectionCoef === "number" ? c.reconnectionCoef : parseFloat(String(c.reconnectionCoef ?? "1")),
    }));

    for (const c of components) {
      if (!c.indexId && !c.indexName) {
        return NextResponse.json({ error: "Indice manquant sur un terme" }, { status: 400 });
      }
      if (!Number.isFinite(c.coefficient) || !Number.isFinite(c.baseValue) || c.baseValue === 0) {
        return NextResponse.json({ error: "Composante invalide" }, { status: 400 });
      }
      if (!Number.isFinite(c.reconnectionCoef) || c.reconnectionCoef <= 0) {
        c.reconnectionCoef = 1;
      }
    }

    // Indices du contrat : on résout par id, sinon par nom (création à la volée).
    const contractIndices = await prisma.contractRevisionIndex.findMany({
      where: { contractId },
      select: { id: true, name: true },
    });
    const idSet = new Set(contractIndices.map((i) => i.id));
    const idByName = new Map(
      contractIndices.map((i) => [i.name.toLowerCase(), i.id] as const)
    );

    for (const c of components) {
      if (c.indexId) {
        if (!idSet.has(c.indexId)) {
          return NextResponse.json(
            { error: "Un indice référencé n'appartient pas au contrat" },
            { status: 400 }
          );
        }
        continue;
      }
      const known = idByName.get(c.indexName.toLowerCase());
      if (known) {
        c.indexId = known;
        continue;
      }
      const created = await prisma.contractRevisionIndex.create({
        data: { contractId, name: c.indexName },
        select: { id: true, name: true },
      });
      idSet.add(created.id);
      idByName.set(created.name.toLowerCase(), created.id);
      c.indexId = created.id;
    }

    const componentRows = components.map((c) => ({
      indexId: c.indexId,
      coefficient: c.coefficient,
      baseValue: c.baseValue,
      reconnectionCoef: c.reconnectionCoef,
    }));

    const result = await prisma.$transaction(async (tx) => {
      if (existingFormula) {
        await tx.contractFormulaComponent.deleteMany({
          where: { formulaId: existingFormula.id },
        });
        const updated = await tx.contractRevisionFormula.update({
          where: { id: existingFormula.id },
          data: {
            periodicity,
            baseDate,
            firstRevisionDate,
            indexLagMonths,
            constantPart,
            roundingDecimals,
            components: { create: componentRows },
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
          firstRevisionDate,
          indexLagMonths,
          constantPart,
          roundingDecimals,
          components: { create: componentRows },
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

// POST = même contrat que PUT (création ou mise à jour d'une fiche de paramètres).
export const POST = PUT;
