import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  LIFESPAN_BY_TYPE,
  REPLACEMENT_COST_BY_TYPE,
} from "@/lib/pricing/equipment-pricing";
import { controlDueDate, UPCOMING_WINDOW_DAYS } from "@/lib/equipment-controls";

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

/**
 * Types de la famille « Production » (TYPE_GROUPS) et leurs équivalents hérités
 * des anciens imports : ce sont les machines dont l'âge et la revue périodique
 * conditionnent la continuité de service. Les règles métier ne visent qu'elles.
 * Dupliqué ici volontairement : `components/exploitation/constants` embarque des
 * icônes React, hors de propos dans une route serveur.
 */
const PRODUCTION_TYPES = new Set([
  // TYPE_GROUPS → Production
  "CHAUDIERE", "PAC", "GROUPE_FROID", "ECHANGEUR_ECS", "BALLON_ECS",
  "STATION_SOLAIRE", "POMPE_CHARGE", "VANNE_2V_MOTORISEE",
  // LEGACY_TYPE_CATEGORY → Production
  "CHAUDIERE_CONDENSATION", "PAC_AIR_EAU", "PAC_EAU_EAU", "PAC_AIR_AIR",
  "BALLON_THERMODYNAMIQUE", "PREPARATEUR_ECS_GAZ", "ECHANGEUR_THERMIQUE",
  "BRULEUR", "RESISTANCE_ELECTRIQUE", "PANNEAU_SOLAIRE_THERMIQUE",
  "BALLON_SOLAIRE", "CUVE", "CUVE_FIOUL", "CUVE_GAZ", "GENERATEUR_AIR_CHAUD",
  "CLIMATISATION", "ROOFTOP", "DRV", "UNITE_EXTERIEURE", "ARMOIRE_CLIMATISATION",
  "TOUR_REFROIDISSEMENT", "AEROREFRIGERANT", "DRY_COOLER",
  "REFROIDISSEUR_ADIABATIQUE", "MODULE_HYDRAULIQUE",
]);

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

    const [equipments, renewalItems, controlRules] = await Promise.all([
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
          status: true,
          theoreticalLifespan: true,
          siteId: true,
          // Constats terrain : le volume est borné au strict nécessaire, les
          // URLs de photos ne servent qu'à en compter le nombre.
          defects: {
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              description: true,
              preconisation: true,
              photos: true,
              createdAt: true,
            },
          },
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
      // Conformité dérivée : les règles de contrôle par type d'équipement.
      prisma.equipmentControlRule.findMany({
        where: { organizationId: effectiveOrgId },
        select: {
          id: true,
          equipmentType: true,
          name: true,
          frequencyMonths: true,
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
    // Deux sources distinctes, jamais mélangées : ce qui a été VU sur site
    // (défauts saisis pendant la visite) et ce que la donnée déduit seule.
    // Le P3 est une garantie totale : aucune règle ne réclame de devis.
    const stateByEquipment = new Map<string, ParcState | null>();
    for (const eq of equipments) {
      const audit = eq.audits[0];
      stateByEquipment.set(eq.id, audit ? worstState(audit) : null);
    }
    const severity = (state: ParcState | null) =>
      state ? STATE_SEVERITY[state] : 0;

    type ActionBase = {
      equipmentId: string;
      type: string;
      name: string | null;
      site: string;
      state: ParcState | null;
    };

    const terrain: Array<
      ActionBase & {
        defectId: string;
        constat: string;
        preconisation: string | null;
        photos: number;
        date: Date;
      }
    > = [];

    for (const eq of equipments) {
      const state = stateByEquipment.get(eq.id) ?? null;
      for (const defect of eq.defects) {
        terrain.push({
          equipmentId: eq.id,
          defectId: defect.id,
          type: eq.type,
          name: eq.name,
          site: siteNames.get(eq.siteId) || "",
          state,
          constat: defect.description,
          preconisation: defect.preconisation,
          photos: defect.photos.length,
          date: defect.createdAt,
        });
      }
    }
    terrain.sort(
      (a, b) =>
        severity(b.state) - severity(a.state) ||
        b.date.getTime() - a.date.getTime()
    );

    const regles: Array<ActionBase & { texte: string }> = [];
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    for (const eq of equipments) {
      const base: ActionBase = {
        equipmentId: eq.id,
        type: eq.type,
        name: eq.name,
        site: siteNames.get(eq.siteId) || "",
        state: stateByEquipment.get(eq.id) ?? null,
      };
      const isProduction = PRODUCTION_TYPES.has(eq.type);

      // Âge : la fin de vie théorique n'appelle pas de devis, elle appelle
      // de la vigilance — le remplacement est couvert par le P3.
      if (eq.year) {
        const lifespan =
          eq.theoreticalLifespan || LIFESPAN_BY_TYPE[eq.type] || 15;
        const endOfLife = eq.year + lifespan;
        if (endOfLife <= currentYear) {
          regles.push({
            ...base,
            texte: `${currentYear - eq.year} ans (durée théorique ${lifespan}) — vigilance : risque de panne accru, remplacement couvert au titre du P3`,
          });
        } else if (endOfLife - currentYear <= 2) {
          regles.push({
            ...base,
            texte: `fin de vie théorique en ${endOfLife} — à surveiller`,
          });
        }
      } else if (isProduction) {
        regles.push({
          ...base,
          texte:
            "année d'installation inconnue — relever la plaque signalétique à la prochaine visite",
        });
      }

      if (eq.status === "PANNE" || eq.status === "HORS_SERVICE") {
        regles.push({
          ...base,
          texte: `signalé ${eq.status === "PANNE" ? "en panne" : "hors service"} — relancer l'exploitant`,
        });
      }

      // Revue périodique : seules les machines de production la justifient.
      if (isProduction) {
        const lastAudit = eq.audits[0]?.auditDate;
        if (!lastAudit) {
          regles.push({ ...base, texte: "jamais évalué — à passer en revue" });
        } else if (new Date(lastAudit) < twelveMonthsAgo) {
          const months = Math.floor(
            (now.getTime() - new Date(lastAudit).getTime()) /
              (30.44 * 86400000)
          );
          regles.push({
            ...base,
            texte: `non évalué depuis ${months} mois — à passer en revue`,
          });
        }
      }
    }
    regles.sort((a, b) => severity(b.state) - severity(a.state));

    // ── 4. Conformité dérivée des équipements ───────────────────
    // Chaque équipement dont le type porte une règle produit un contrôle à
    // suivre. Jamais contrôlé = en retard, sans échéance de référence.
    const rulesByType = new Map<string, typeof controlRules>();
    for (const rule of controlRules) {
      const list = rulesByType.get(rule.equipmentType);
      if (list) list.push(rule);
      else rulesByType.set(rule.equipmentType, [rule]);
    }

    const controlledEquipments = equipments.filter((eq) =>
      rulesByType.has(eq.type)
    );

    const records =
      controlledEquipments.length > 0
        ? await prisma.equipmentControlRecord.findMany({
            where: {
              equipmentId: { in: controlledEquipments.map((eq) => eq.id) },
            },
            orderBy: [{ doneDate: "desc" }],
            select: { equipmentId: true, ruleId: true, doneDate: true },
          })
        : [];

    // Records triés du plus récent au plus ancien : le premier vu pour un
    // couple équipement × règle est le dernier contrôle.
    const lastDone = new Map<string, Date>();
    for (const record of records) {
      const key = `${record.equipmentId}:${record.ruleId}`;
      if (!lastDone.has(key)) lastDone.set(key, record.doneDate);
    }

    type ControlRow = {
      equipmentId: string;
      type: string;
      name: string | null;
      site: string;
      control: string;
      dueDate: string | null;
      overdueDays: number | null;
    };

    const lateControls: ControlRow[] = [];
    const upcoming: ControlRow[] = [];
    let trackedControls = 0;

    for (const eq of controlledEquipments) {
      for (const rule of rulesByType.get(eq.type) ?? []) {
        trackedControls++;
        const done = lastDone.get(`${eq.id}:${rule.id}`);
        const dueDate = controlDueDate(done, rule.frequencyMonths);
        const row: ControlRow = {
          equipmentId: eq.id,
          type: eq.type,
          name: eq.name,
          site: siteNames.get(eq.siteId) || "",
          control: rule.name,
          dueDate: dueDate ? dueDate.toISOString() : null,
          overdueDays: null,
        };

        if (!dueDate) {
          lateControls.push(row);
          continue;
        }
        if (dueDate < now) {
          lateControls.push({
            ...row,
            overdueDays: Math.floor(
              (now.getTime() - dueDate.getTime()) / 86400000
            ),
          });
        } else if (
          dueDate.getTime() - now.getTime() <
          UPCOMING_WINDOW_DAYS * 86400000
        ) {
          upcoming.push(row);
        }
      }
    }

    // Jamais contrôlé (dueDate null) en tête, puis du plus en retard au moins.
    lateControls.sort(
      (a, b) =>
        (a.overdueDays === null ? -1 : 0) - (b.overdueDays === null ? -1 : 0) ||
        (b.overdueDays ?? 0) - (a.overdueDays ?? 0)
    );
    upcoming.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

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
      actions: { terrain, regles },
      compliance: {
        total: trackedControls,
        compliantPercent:
          trackedControls > 0
            ? Math.round((compliantCount / trackedControls) * 100)
            : null,
        late: lateControls,
        upcoming,
      },
    });
  } catch (error) {
    console.error("GET /api/equipments/synthesis error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
