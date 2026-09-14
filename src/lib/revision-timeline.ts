/**
 * Construction de la chronologie de révision d'un contrat (côté serveur).
 *
 * Utilisé par `GET /api/contracts/[id]/revision-timeline` et, pour
 * compatibilité, par `GET /api/contracts/[id]/revision-pending`.
 *
 * Une formule sans `firstRevisionDate` est renvoyée avec `configured: false`
 * et `entries: []` — on n'invente aucune échéance.
 */

import prisma from "@/lib/prisma";
import type { RevisionPType, RevisionPeriod } from "@/generated/prisma/client";
import {
  buildOccurrences,
  computeK,
  monthKey,
  resolveIndexValue,
  revisionReasonPrefix,
  type IndexValueLite,
  type RevisionEntryStatus,
} from "@/lib/revision";

export interface TimelineComponent {
  indexId: string;
  indexName: string;
  coefficient: number;
  baseValue: number;
  reconnectionCoef: number;
  value: number | null;
  valueMonth: string | null;
  valueDate: string | null;
  isProvisional: boolean;
}

export interface TimelineEntry {
  dueDate: string;
  status: RevisionEntryStatus;
  isOverdue: boolean;
  appliedAt: string | null;
  appliedBy: string | null;
  K: number | null;
  Kraw: number | null;
  hasProvisionalIndex: boolean;
  missingIndexNames: string[];
  components: TimelineComponent[];
}

export interface TimelineFormula {
  id: string;
  pType: RevisionPType;
  periodicity: RevisionPeriod;
  firstRevisionDate: string | null;
  indexLagMonths: number | null;
  constantPart: number;
  roundingDecimals: number;
  baseDate: string;
  configured: boolean;
  components: {
    indexId: string;
    indexName: string;
    coefficient: number;
    baseValue: number;
    reconnectionCoef: number;
  }[];
  entries: TimelineEntry[];
}

export async function buildRevisionTimeline(
  contractId: string,
  now: Date = new Date()
): Promise<TimelineFormula[]> {
  const formulas = await prisma.contractRevisionFormula.findMany({
    where: { contractId },
    include: {
      components: { include: { index: { select: { id: true, name: true } } } },
    },
    orderBy: { pType: "asc" },
  });

  if (formulas.length === 0) return [];

  // Valeurs d'indice chargées une fois, triées par date croissante.
  const indexIds = Array.from(
    new Set(formulas.flatMap((f) => f.components.map((c) => c.indexId)))
  );
  const allValues = indexIds.length
    ? await prisma.contractRevisionIndexValue.findMany({
        where: { indexId: { in: indexIds } },
        orderBy: { date: "asc" },
        select: { indexId: true, date: true, value: true, isProvisional: true },
      })
    : [];
  const valuesByIndex = new Map<string, IndexValueLite[]>();
  for (const v of allValues) {
    const list = valuesByIndex.get(v.indexId);
    if (list) list.push(v);
    else valuesByIndex.set(v.indexId, [v]);
  }

  // Révisions déjà appliquées : ContractSitePriceChange « Révision P<N> … »
  const contractSiteIds = (
    await prisma.contractSite.findMany({
      where: { contractId },
      select: { id: true },
    })
  ).map((cs) => cs.id);

  const appliedChanges = contractSiteIds.length
    ? await prisma.contractSitePriceChange.findMany({
        where: {
          contractSiteId: { in: contractSiteIds },
          reason: { startsWith: "Révision P" },
        },
        select: { effectiveDate: true, reason: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // clé « P2|2025-09-01 » → date d'application (createdAt le plus ancien)
  const appliedAtByKey = new Map<string, Date>();
  for (const change of appliedChanges) {
    const pType = change.reason?.slice("Révision ".length, "Révision ".length + 2);
    if (!pType) continue;
    const key = `${pType}|${change.effectiveDate.toISOString().slice(0, 10)}`;
    if (!appliedAtByKey.has(key)) appliedAtByKey.set(key, change.createdAt);
  }

  return formulas.map((formula) => {
    const componentSummary = formula.components.map((c) => ({
      indexId: c.indexId,
      indexName: c.index.name,
      coefficient: c.coefficient,
      baseValue: c.baseValue,
      reconnectionCoef: c.reconnectionCoef ?? 1,
    }));

    const configured =
      !!formula.firstRevisionDate && formula.components.length > 0;

    const occurrences = configured
      ? buildOccurrences(formula.firstRevisionDate, formula.periodicity, now)
      : [];

    const entries: TimelineEntry[] = occurrences.map((dueDate) => {
      const components: TimelineComponent[] = formula.components.map((c) => {
        const resolved = resolveIndexValue(
          valuesByIndex.get(c.indexId) ?? [],
          dueDate,
          formula.indexLagMonths ?? null
        );
        return {
          indexId: c.indexId,
          indexName: c.index.name,
          coefficient: c.coefficient,
          baseValue: c.baseValue,
          reconnectionCoef: c.reconnectionCoef ?? 1,
          value: resolved ? resolved.value : null,
          valueMonth: resolved ? monthKey(resolved.date) : null,
          valueDate: resolved ? resolved.date.toISOString() : null,
          isProvisional: resolved ? resolved.isProvisional : false,
        };
      });

      const missingIndexNames = components
        .filter((c) => c.value === null)
        .map((c) => c.indexName);
      const hasProvisionalIndex = components.some((c) => c.isProvisional);

      const k =
        missingIndexNames.length === 0
          ? computeK(
              formula.constantPart,
              components.map((c) => ({
                coefficient: c.coefficient,
                baseValue: c.baseValue,
                reconnectionCoef: c.reconnectionCoef,
                value: c.value as number,
              })),
              formula.roundingDecimals
            )
          : null;

      const key = `${formula.pType}|${dueDate.toISOString().slice(0, 10)}`;
      const appliedAt = appliedAtByKey.get(key) ?? null;
      const isFuture = dueDate.getTime() > now.getTime();

      let status: RevisionEntryStatus;
      if (appliedAt) status = "applied";
      else if (isFuture) status = "upcoming";
      else if (missingIndexNames.length > 0) status = "missing_index";
      else if (hasProvisionalIndex) status = "provisional";
      else status = "ready";

      return {
        dueDate: dueDate.toISOString(),
        status,
        isOverdue: !appliedAt && !isFuture,
        appliedAt: appliedAt ? appliedAt.toISOString() : null,
        // ContractSitePriceChange ne porte pas d'auteur : pas de nom disponible.
        appliedBy: null,
        K: k ? k.K : null,
        Kraw: k ? k.Kraw : null,
        hasProvisionalIndex,
        missingIndexNames,
        components,
      };
    });

    return {
      id: formula.id,
      pType: formula.pType,
      periodicity: formula.periodicity,
      firstRevisionDate: formula.firstRevisionDate
        ? formula.firstRevisionDate.toISOString()
        : null,
      indexLagMonths: formula.indexLagMonths ?? null,
      constantPart: formula.constantPart,
      roundingDecimals: formula.roundingDecimals,
      baseDate: formula.baseDate.toISOString(),
      configured,
      components: componentSummary,
      entries,
    };
  });
}

/** Forme historique attendue par `revision-pending` (compatibilité). */
export interface PendingRevisionLegacy {
  pType: RevisionPType;
  periodicity: RevisionPeriod;
  lastAppliedDate: string | null;
  nextDueDate: string;
  isOverdue: boolean;
  indicesReady: boolean;
  missingIndex: string | null;
}

export function toLegacyPending(
  timeline: TimelineFormula[],
  now: Date = new Date()
): PendingRevisionLegacy[] {
  const pending: PendingRevisionLegacy[] = [];

  for (const formula of timeline) {
    if (!formula.configured || formula.entries.length === 0) continue;

    const applied = formula.entries.filter((e) => e.status === "applied");
    const next = formula.entries.find((e) => e.status !== "applied");
    if (!next) continue;

    pending.push({
      pType: formula.pType,
      periodicity: formula.periodicity,
      lastAppliedDate:
        applied.length > 0 ? applied[applied.length - 1].dueDate : null,
      nextDueDate: next.dueDate,
      isOverdue: new Date(next.dueDate).getTime() <= now.getTime(),
      indicesReady: next.missingIndexNames.length === 0,
      missingIndex: next.missingIndexNames[0] ?? null,
    });
  }

  pending.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  return pending;
}

export { revisionReasonPrefix };
