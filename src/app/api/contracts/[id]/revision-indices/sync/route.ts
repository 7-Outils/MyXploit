import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { fetchBdmSeries, InseeBdmError } from "@/lib/insee-bdm";
import { addMonthsUTC, monthKey } from "@/lib/revision";

interface SyncedIndex {
  indexId: string;
  name: string;
  identifier: string;
  titleFr: string | null;
  added: number;
  /** Valeurs corrigées (valeur et/ou statut provisoire). */
  updated: number;
  /** Sous-ensemble de `updated` : provisoire → définitif. */
  confirmed: number;
  latestPeriod: string | null;
}

/** « YYYY-MM » → 1er du mois en UTC (clé unique des valeurs d'indice). */
function periodToDate(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Mise à jour des valeurs d'indices depuis l'API publique Insee BDM.
 *
 * Une seule requête groupée pour tous les indices du contrat qui portent un
 * identifiant (idBank). Les valeurs Insee font foi : une valeur existante est
 * corrigée si le nombre ou le statut provisoire diffère. Les mois que l'Insee
 * ne renvoie pas ne sont jamais touchés (saisies manuelles préservées).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: contractId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const limit = await rateLimit(`revision-indices-sync:${user.id}`, "import");
    if (!limit.success) {
      return rateLimitExceeded(limit.remaining);
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const indices = await prisma.contractRevisionIndex.findMany({
      where: { contractId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, identifier: true },
    });

    const skipped = indices
      .filter((i) => !i.identifier?.trim())
      .map((i) => i.name);
    const targets = indices
      .filter((i) => !!i.identifier?.trim())
      .map((i) => ({ ...i, identifier: i.identifier!.trim() }));

    if (targets.length === 0) {
      return NextResponse.json({ indices: [], skipped, errors: [] });
    }

    // Fenêtre utile : 24 mois avant le plus ancien mois nécessaire aux formules
    // (première échéance − décalage d'indice), à défaut 36 mois glissants.
    const startPeriod = await computeStartPeriod(contractId);

    let series;
    try {
      series = await fetchBdmSeries(
        targets.map((t) => t.identifier),
        { startPeriod }
      );
    } catch (error) {
      const message =
        error instanceof InseeBdmError
          ? error.message
          : "Erreur lors de l'appel à l'API Insee";
      console.error("Insee BDM sync failed:", error);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const seriesByIdBank = new Map(series.map((s) => [s.idBank, s]));

    const results: SyncedIndex[] = [];
    const errors: { name: string; identifier: string; message: string }[] = [];

    for (const target of targets) {
      const found = seriesByIdBank.get(target.identifier);
      if (!found) {
        errors.push({
          name: target.name,
          identifier: target.identifier,
          message: `Identifiant Insee inconnu (${target.identifier})`,
        });
        continue;
      }

      const existing = await prisma.contractRevisionIndexValue.findMany({
        where: { indexId: target.id },
        select: { id: true, date: true, value: true, isProvisional: true },
      });
      const existingByMonth = new Map(
        existing.map((v) => [monthKey(v.date), v] as const)
      );

      let added = 0;
      let updated = 0;
      let confirmed = 0;

      for (const obs of found.observations) {
        const current = existingByMonth.get(obs.period);

        if (!current) {
          try {
            await prisma.contractRevisionIndexValue.create({
              data: {
                indexId: target.id,
                date: periodToDate(obs.period),
                value: obs.value,
                isProvisional: obs.provisional,
              },
            });
            added++;
          } catch (error) {
            // Une valeur saisie à une date autre que le 1er du mois peut
            // exister : on ne fait pas échouer la synchronisation entière.
            console.error("Index value create failed:", error);
          }
          continue;
        }

        if (
          current.value !== obs.value ||
          current.isProvisional !== obs.provisional
        ) {
          await prisma.contractRevisionIndexValue.update({
            where: { id: current.id },
            data: { value: obs.value, isProvisional: obs.provisional },
          });
          updated++;
          if (current.isProvisional && !obs.provisional) confirmed++;
        }
      }

      const latest = found.observations[found.observations.length - 1];
      results.push({
        indexId: target.id,
        name: target.name,
        identifier: target.identifier,
        titleFr: found.titleFr,
        added,
        updated,
        confirmed,
        latestPeriod: latest ? latest.period : null,
      });
    }

    return NextResponse.json({ indices: results, skipped, errors });
  } catch (error) {
    console.error("Error syncing revision indices:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

/**
 * Plus ancien mois à demander à l'Insee : 24 mois avant le plus ancien mois
 * utile aux formules du contrat (première échéance − décalage d'indice).
 * Sans formule paramétrée, 36 mois glissants.
 */
async function computeStartPeriod(contractId: string): Promise<string> {
  const formulas = await prisma.contractRevisionFormula.findMany({
    where: { contractId, firstRevisionDate: { not: null } },
    select: { firstRevisionDate: true, indexLagMonths: true },
  });

  const now = new Date();
  let oldest: Date | null = null;

  for (const formula of formulas) {
    if (!formula.firstRevisionDate) continue;
    const useful = addMonthsUTC(
      formula.firstRevisionDate,
      -(formula.indexLagMonths ?? 0)
    );
    if (!oldest || useful.getTime() < oldest.getTime()) oldest = useful;
  }

  const start = oldest
    ? addMonthsUTC(oldest, -24)
    : addMonthsUTC(now, -36);

  return monthKey(start);
}
