import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  LIFESPAN_BY_TYPE,
  REPLACEMENT_COST_BY_TYPE,
} from "@/lib/pricing/equipment-pricing";

/**
 * GET /api/equipments/synthesis?contractId=&siteId=&domain=
 * Toute la donnée de l'onglet Synthèse Équipements en UNE requête :
 * état du parc, couverture d'audit, renouvellement vs plan P3,
 * actions prioritaires, conformité réglementaire.
 */

type ParcState = "bon" | "moyen" | "degrade" | "critique";

const RATING_TO_STATE: Record<string, ParcState | null> = {
  EXCELLENT: "bon",
  BON: "bon",
  MOYEN: "moyen",
  MAUVAIS: "degrade",
  CRITIQUE: "critique",
  NON_EVALUE: null,
};

const STATE_SEVERITY: Record<ParcState, number> = {
  bon: 0,
  moyen: 1,
  degrade: 2,
  critique: 3,
};

const DERIVED_ACTIONS: Record<ParcState, string> = {
  critique: "Remplacement à programmer",
  degrade: "Devis P3 à exiger de l'exploitant",
  moyen: "Surveiller — inscrire au programme P3",
  bon: "",
};

function worstState(audit: {
  visualState: string;
  performance: string;
  security: string;
  accessibility: string;
  compliance: string;
}): ParcState | null {
  const states = [
    audit.visualState,
    audit.performance,
    audit.security,
    audit.accessibility,
    audit.compliance,
  ]
    .map((r) => RATING_TO_STATE[r])
    .filter((s): s is ParcState => s !== null);
  if (states.length === 0) return null;
  return states.reduce((worst, s) =>
    STATE_SEVERITY[s] > STATE_SEVERITY[worst] ? s : worst
  );
}

function replacementEstimate(equipment: {
  type: string;
  power: number | null;
  quantity: number | null;
}): number {
  const config = REPLACEMENT_COST_BY_TYPE[equipment.type];
  if (!config) return 0;
  let cost = config.base;
  if (config.perKw && equipment.power) cost += config.perKw * equipment.power;
  return cost * (equipment.quantity || 1);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const searchParams = request.nextUrl.searchParams;
    const contractId = searchParams.get("contractId");
    const siteId = searchParams.get("siteId");
    const domain = searchParams.get("domain");

    if (!contractId) {
      return NextResponse.json(
        { error: "contractId requis" },
        { status: 400 }
      );
    }

    // Sites du contrat (borne aussi l'isolation org)
    const contractSites = await prisma.contractSite.findMany({
      where: {
        contractId,
        contract: { organizationId: effectiveOrgId },
        ...(siteId ? { siteId } : {}),
      },
      select: { siteId: true, site: { select: { id: true, name: true } } },
    });
    const siteIds = contractSites.map((cs) => cs.siteId);
    const siteNames = new Map(
      contractSites.map((cs) => [cs.site.id, cs.site.name])
    );

    if (siteIds.length === 0) {
      return NextResponse.json({ empty: true });
    }

    const [equipments, renewalItems, controls] = await Promise.all([
      prisma.equipment.findMany({
        where: {
          organizationId: effectiveOrgId,
          siteId: { in: siteIds },
          ...(domain ? { domain: domain as never } : {}),
        },
        select: {
          id: true,
          name: true,
          type: true,
          domain: true,
          year: true,
          power: true,
          quantity: true,
          theoreticalLifespan: true,
          siteId: true,
          audits: {
            orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              auditDate: true,
              visualState: true,
              performance: true,
              security: true,
              accessibility: true,
              compliance: true,
              generalNotes: true,
            },
          },
          auditRecommendations: {
            where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
            orderBy: { priority: "asc" },
            take: 1,
            select: { title: true, estimatedCostMin: true, estimatedCostMax: true },
          },
          renewalItems: {
            where: { status: { in: ["PREVU", "REALISE", "REPORTE"] } },
            select: { id: true },
          },
        },
      }),
      prisma.contractRenewalItem.findMany({
        where: {
          contractId,
          organizationId: effectiveOrgId,
          ...(siteId ? { OR: [{ siteId }, { equipment: { siteId } }] } : {}),
        },
        select: {
          plannedYear: true,
          amountHT: true,
          status: true,
          label: true,
        },
      }),
      prisma.regulatoryControl.findMany({
        where: {
          organizationId: effectiveOrgId,
          siteId: { in: siteIds },
          status: { not: "NON_APPLICABLE" },
        },
        select: {
          dueDate: true,
          status: true,
          siteId: true,
          type: {
            select: { name: true, frequency: true, frequencyMonths: true },
          },
        },
      }),
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();

    // ── 1. État du parc ─────────────────────────────────────────
    const emptyDist = () => ({ bon: 0, moyen: 0, degrade: 0, critique: 0 });
    const parc = { total: equipments.length, ...emptyDist(), nonEvalue: 0 };
    const byDomain: Record<
      string,
      { total: number; bon: number; moyen: number; degrade: number; critique: number; nonEvalue: number }
    > = {};

    let neverAudited = 0;
    let toVisit = 0; // pas d'audit depuis 12 mois (jamais audité inclus)
    let lastCampaign: Date | null = null;
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const eq of equipments) {
      const audit = eq.audits[0];
      const state = audit ? worstState(audit) : null;

      if (!byDomain[eq.domain])
        byDomain[eq.domain] = { total: 0, ...emptyDist(), nonEvalue: 0 };
      byDomain[eq.domain].total++;

      if (state) {
        parc[state]++;
        byDomain[eq.domain][state]++;
      } else {
        parc.nonEvalue++;
        byDomain[eq.domain].nonEvalue++;
      }

      if (!audit) {
        neverAudited++;
        toVisit++;
      } else {
        if (new Date(audit.auditDate) < oneYearAgo) toVisit++;
        if (!lastCampaign || new Date(audit.auditDate) > lastCampaign)
          lastCampaign = new Date(audit.auditDate);
      }
    }

    // ── 1 bis. Sites en alerte ──────────────────────────────────
    // Agrégation par site sur les équipements déjà chargés (donc soumis
    // aux filtres siteId/domain de la requête), en itérant sur TOUS les
    // sites du contrat : un site sans équipement compte en non audité.
    const perSite = new Map<
      string,
      { critique: number; degrade: number; nonEvalue: number; total: number }
    >();
    for (const cs of contractSites) {
      perSite.set(cs.siteId, {
        critique: 0,
        degrade: 0,
        nonEvalue: 0,
        total: 0,
      });
    }
    for (const eq of equipments) {
      const bucket = perSite.get(eq.siteId);
      if (!bucket) continue;
      bucket.total++;
      const audit = eq.audits[0];
      const state = audit ? worstState(audit) : null;
      if (state === "critique") bucket.critique++;
      else if (state === "degrade") bucket.degrade++;
      else if (!state) bucket.nonEvalue++;
    }

    let sitesNonAudited = 0;
    let sitesOk = 0;
    const siteAlertList: Array<{
      id: string;
      name: string;
      critique: number;
      degrade: number;
      nonEvalue: number;
      total: number;
    }> = [];
    for (const [id, bucket] of perSite) {
      const evaluated = bucket.total - bucket.nonEvalue;
      if (evaluated === 0) {
        sitesNonAudited++;
      } else if (bucket.critique + bucket.degrade === 0) {
        sitesOk++;
      }
      if (bucket.critique + bucket.degrade > 0) {
        siteAlertList.push({
          id,
          name: siteNames.get(id) || "",
          ...bucket,
        });
      }
    }
    siteAlertList.sort(
      (a, b) =>
        b.critique - a.critique ||
        b.degrade - a.degrade ||
        a.name.localeCompare(b.name, "fr")
    );

    // ── 2. Renouvellement vs plan P3 ────────────────────────────
    let overdueCount = 0;
    let overdueUncovered = 0;
    let overdueUncoveredCost = 0;
    const horsPlanByYear: Record<number, number> = {};

    for (const eq of equipments) {
      if (!eq.year) continue;
      const lifespan =
        eq.theoreticalLifespan || LIFESPAN_BY_TYPE[eq.type] || 15;
      const endOfLife = eq.year + lifespan;
      if (endOfLife > currentYear) continue;

      overdueCount++;
      if (eq.renewalItems.length === 0) {
        overdueUncovered++;
        const cost = replacementEstimate(eq);
        overdueUncoveredCost += cost;
        const bucketYear = Math.max(currentYear, endOfLife);
        horsPlanByYear[bucketYear] = (horsPlanByYear[bucketYear] || 0) + cost;
      }
    }

    const plannedByYear: Record<number, number> = {};
    for (const item of renewalItems) {
      if (item.status === "ABANDONNE") continue;
      plannedByYear[item.plannedYear] =
        (plannedByYear[item.plannedYear] || 0) + item.amountHT;
    }

    const allYears = [
      ...new Set([
        ...Object.keys(plannedByYear).map(Number),
        ...Object.keys(horsPlanByYear).map(Number),
      ]),
    ].sort();
    const renewalYears = allYears.map((year) => ({
      year,
      planned: Math.round(plannedByYear[year] || 0),
      horsPlan: Math.round(horsPlanByYear[year] || 0),
    }));

    // ── 3. Actions prioritaires ─────────────────────────────────
    const actionable = equipments
      .map((eq) => {
        const audit = eq.audits[0];
        const state = audit ? worstState(audit) : null;
        if (!state || state === "bon") return null;
        const reco = eq.auditRecommendations[0];
        return {
          id: eq.id,
          name: eq.name || eq.type,
          site: siteNames.get(eq.siteId) || "",
          year: eq.year,
          age: eq.year ? currentYear - eq.year : null,
          state,
          finding: audit?.generalNotes || null,
          action: reco?.title || DERIVED_ACTIONS[state],
          estimatedCost:
            reco?.estimatedCostMax ??
            reco?.estimatedCostMin ??
            (state === "critique" ? replacementEstimate(eq) || null : null),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort(
        (a, b) =>
          STATE_SEVERITY[b.state] - STATE_SEVERITY[a.state] ||
          (b.estimatedCost || 0) - (a.estimatedCost || 0)
      );

    // ── 4. Conformité réglementaire ─────────────────────────────
    const lateControls = controls
      .filter(
        (c) =>
          c.status === "EN_RETARD" ||
          (c.status !== "EFFECTUE" && new Date(c.dueDate) < now)
      )
      .map((c) => ({
        type: c.type.name,
        frequency: c.type.frequency,
        site: siteNames.get(c.siteId) || "",
        dueDate: c.dueDate,
        overdueDays: Math.floor(
          (now.getTime() - new Date(c.dueDate).getTime()) / 86400000
        ),
      }))
      .sort((a, b) => b.overdueDays - a.overdueDays);

    const upcoming = controls
      .filter(
        (c) =>
          c.status !== "EFFECTUE" &&
          new Date(c.dueDate) >= now &&
          new Date(c.dueDate).getTime() - now.getTime() < 60 * 86400000
      )
      .map((c) => ({
        type: c.type.name,
        frequency: c.type.frequency,
        site: siteNames.get(c.siteId) || "",
        dueDate: c.dueDate,
        overdueDays: null,
      }));

    const trackedControls = controls.length;
    const compliantCount = trackedControls - lateControls.length;

    return NextResponse.json({
      sites: contractSites.map((cs) => cs.site),
      parc: { ...parc, byDomain },
      siteAlerts: {
        nonAudited: sitesNonAudited,
        ok: sitesOk,
        list: siteAlertList,
      },
      coverage: {
        toVisit,
        neverAudited,
        lastCampaign,
      },
      renewal: {
        overdueCount,
        overdueUncovered,
        overdueUncoveredCost: Math.round(overdueUncoveredCost),
        years: renewalYears,
        planCount: renewalItems.filter((i) => i.status !== "ABANDONNE").length,
      },
      actions: {
        total: actionable.length,
        top: actionable.slice(0, 5),
      },
      compliance: {
        total: trackedControls,
        compliantPercent:
          trackedControls > 0
            ? Math.round((compliantCount / trackedControls) * 100)
            : null,
        late: lateControls.slice(0, 6),
        upcoming: upcoming.slice(0, Math.max(0, 6 - lateControls.length)),
      },
    });
  } catch (error) {
    console.error("GET /api/equipments/synthesis error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
