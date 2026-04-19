import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { RevisionPType } from "@/generated/prisma/client";

const P_TYPES: RevisionPType[] = ["P1", "P2", "P3"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;
    const url = new URL(request.url);
    const preview = url.searchParams.get("preview") === "1";

    if (!preview && user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const pType = body?.pType as RevisionPType;
    if (!P_TYPES.includes(pType)) {
      return NextResponse.json({ error: "pType invalide" }, { status: 400 });
    }

    const periodStart = body?.periodStart ? new Date(body.periodStart) : null;
    if (!periodStart || isNaN(periodStart.getTime())) {
      return NextResponse.json({ error: "periodStart invalide" }, { status: 400 });
    }

    const formula = await prisma.contractRevisionFormula.findUnique({
      where: { contractId_pType: { contractId, pType } },
      include: { components: true },
    });

    if (!formula || formula.components.length === 0) {
      return NextResponse.json({ error: "Aucune formule définie pour ce P" }, { status: 400 });
    }

    // Résoudre la valeur de chaque indice à periodStart (la plus récente avec date <= periodStart)
    let K = formula.constantPart;
    const componentDetails: {
      indexId: string;
      indexName: string;
      coefficient: number;
      baseValue: number;
      currentValue: number;
      ratio: number;
    }[] = [];

    for (const c of formula.components) {
      const latest = await prisma.contractRevisionIndexValue.findFirst({
        where: { indexId: c.indexId, date: { lte: periodStart } },
        orderBy: { date: "desc" },
        include: { index: { select: { name: true } } },
      });
      if (!latest) {
        return NextResponse.json(
          { error: `Aucune valeur d'indice disponible à la date ${periodStart.toISOString().slice(0, 10)} pour un des indices utilisés` },
          { status: 400 }
        );
      }
      const ratio = latest.value / c.baseValue;
      K += c.coefficient * ratio;
      componentDetails.push({
        indexId: c.indexId,
        indexName: latest.index.name,
        coefficient: c.coefficient,
        baseValue: c.baseValue,
        currentValue: latest.value,
        ratio,
      });
    }

    const amountField = `amount${pType}` as "amountP1" | "amountP2" | "amountP3";
    const baseField = `amount${pType}Base` as "amountP1Base" | "amountP2Base" | "amountP3Base";

    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: { site: { select: { id: true, name: true } } },
    });

    const siteResults = contractSites.map((cs) => {
      const base = cs[baseField] ?? cs[amountField] ?? 0;
      const before = cs[amountField] ?? 0;
      const after = base * K;
      return {
        contractSiteId: cs.id,
        siteId: cs.site.id,
        siteName: cs.site.name,
        base,
        before,
        after,
        delta: after - before,
      };
    });

    if (preview) {
      return NextResponse.json({
        preview: true,
        pType,
        periodStart: periodStart.toISOString(),
        K,
        components: componentDetails,
        sites: siteResults,
      });
    }

    const reasonPrefix = `Révision ${pType}`;
    const isoDay = periodStart.toISOString().slice(0, 10);
    const reason = `${reasonPrefix} ${isoDay}`;

    await prisma.$transaction(async (tx) => {
      for (const r of siteResults) {
        if (!r.base) continue;

        // Supprimer anciens ContractSitePriceChange pour la même clé logique
        await tx.contractSitePriceChange.deleteMany({
          where: {
            contractSiteId: r.contractSiteId,
            effectiveDate: periodStart,
            reason: { startsWith: reasonPrefix },
          },
        });

        await tx.contractSitePriceChange.create({
          data: {
            contractSiteId: r.contractSiteId,
            avenantId: null,
            effectiveDate: periodStart,
            [amountField]: r.after,
            [`delta${pType}`]: r.delta,
            reason,
          },
        });

        await tx.contractSite.update({
          where: { id: r.contractSiteId },
          data: { [amountField]: r.after },
        });
      }
    });

    return NextResponse.json({
      preview: false,
      pType,
      periodStart: periodStart.toISOString(),
      K,
      components: componentDetails,
      sites: siteResults,
    });
  } catch (error) {
    console.error("Error applying revision:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
