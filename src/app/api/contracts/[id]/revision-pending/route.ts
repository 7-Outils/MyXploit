import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { RevisionPType, RevisionPeriod } from "@/generated/prisma/client";

function addPeriod(date: Date, periodicity: RevisionPeriod): Date {
  const d = new Date(date);
  switch (periodicity) {
    case "MONTHLY": d.setMonth(d.getMonth() + 1); break;
    case "QUARTERLY": d.setMonth(d.getMonth() + 3); break;
    case "SEMI_ANNUAL": d.setMonth(d.getMonth() + 6); break;
    case "ANNUAL": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const formulas = await prisma.contractRevisionFormula.findMany({
      where: { contractId },
      include: { components: true },
    });

    const contractSiteIds = await prisma.contractSite.findMany({
      where: { contractId },
      select: { id: true },
    }).then((arr) => arr.map((c) => c.id));

    const now = new Date();
    const pending: {
      pType: RevisionPType;
      periodicity: RevisionPeriod;
      lastAppliedDate: string | null;
      nextDueDate: string;
      isOverdue: boolean;
      indicesReady: boolean;
      missingIndex: string | null;
    }[] = [];

    for (const formula of formulas) {
      // Last applied: most recent ContractSitePriceChange with reason starting "Révision P<N>"
      const reasonPrefix = `Révision ${formula.pType}`;
      const lastChange = await prisma.contractSitePriceChange.findFirst({
        where: {
          contractSiteId: { in: contractSiteIds },
          reason: { startsWith: reasonPrefix },
        },
        orderBy: { effectiveDate: "desc" },
        select: { effectiveDate: true },
      });

      const lastAppliedDate = lastChange?.effectiveDate ?? null;
      const startDate = lastAppliedDate ?? formula.baseDate;
      const nextDueDate = addPeriod(startDate, formula.periodicity);

      // Check all indices have a value for nextDueDate
      let indicesReady = true;
      let missingIndex: string | null = null;
      for (const c of formula.components) {
        const val = await prisma.contractRevisionIndexValue.findFirst({
          where: { indexId: c.indexId, date: { lte: nextDueDate } },
          orderBy: { date: "desc" },
          include: { index: { select: { name: true } } },
        });
        if (!val) {
          indicesReady = false;
          const idx = await prisma.contractRevisionIndex.findUnique({
            where: { id: c.indexId },
            select: { name: true },
          });
          missingIndex = idx?.name ?? "?";
          break;
        }
      }

      pending.push({
        pType: formula.pType,
        periodicity: formula.periodicity,
        lastAppliedDate: lastAppliedDate ? lastAppliedDate.toISOString() : null,
        nextDueDate: nextDueDate.toISOString(),
        isOverdue: nextDueDate <= now,
        indicesReady,
        missingIndex,
      });
    }

    pending.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

    return NextResponse.json(pending);
  } catch (error) {
    console.error("Error fetching pending revisions:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
