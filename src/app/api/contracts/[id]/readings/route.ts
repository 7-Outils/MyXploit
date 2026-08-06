import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

const MAX_LIMIT = 2000;

// Fenêtre d'historique chargée par compteur pour retrouver les relevés précédents.
// MeterReading contient aussi la télérelève (Enedis), qui peut être dense : on ne
// charge donc pas tout l'historique, et on retombe sur une requête ciblée dans les
// rares cas où la fenêtre ne suffit pas. La fenêtre reste volontairement petite :
// le repli garantit la correction, l'élargir ne ferait que gonfler la mémoire.
const HISTORY_WINDOW = 400;

// Les fenêtres sont chargées par vagues : sans borne, une page de 1000 relevés
// répartis sur autant de compteurs ouvrait 1000 requêtes simultanées sur Neon.
const HISTORY_CONCURRENCY = 8;

type HistoryRow = {
  id: string;
  readingDate: Date;
  indexValue: number | null;
  isReset: boolean;
};

/**
 * GET /api/contracts/[id]/readings - List recent meter readings for all sites of a contract
 * Each reading includes its previous reading (for context: previous index + date).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;
    const { searchParams } = new URL(request.url);
    // Plafond dur : sans borne, un appelant pouvait demander 100 000 relevés.
    // limit=0 reste un tableau vide, une valeur absurde retombe sur la valeur par défaut.
    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.min(rawLimit, MAX_LIMIT) : 20;

    const contractSites = await prisma.contractSite.findMany({
      where: { contractId, contract: { organizationId: effectiveOrgId } },
      select: { siteId: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json([]);
    }

    const siteIds = contractSites.map((cs) => cs.siteId);

    const readings = await prisma.meterReading.findMany({
      where: {
        source: "MANUEL",
        meter: {
          siteId: { in: siteIds },
          site: { organizationId: effectiveOrgId },
        },
      },
      include: {
        meter: {
          select: {
            id: true,
            name: true,
            fluid: true,
            unit: true,
            siteId: true,
            site: { select: { name: true } },
          },
        },
      },
      orderBy: { readingDate: "desc" },
      take: limit,
    });

    // Map siteId → coefficients contractuels (ContractSite du contrat courant).
    // Source de vérité unique pour la conversion ECS/Gaz → kWh.
    const contractSitesWithCoefs = await prisma.contractSite.findMany({
      where: { contractId, siteId: { in: siteIds }, contract: { organizationId: effectiveOrgId } },
      select: { siteId: true, coefficientPCS: true, coefficientQ: true },
    });
    const coefsBySite = new Map(
      contractSitesWithCoefs.map((cs) => [cs.siteId, cs])
    );

    const convertDelta = (
      fluid: string,
      delta: number,
      siteId: string
    ): { value: number; unit: string } | null => {
      // Sémantique par fluide (Meter.unit est historiquement peu fiable sur
      // les meters créés avant le refactor). Hypothèse: l'index est toujours
      // dans l'unité "naturelle" du fluide.
      //   GAZ      → index en m³,  * PCS (kWh/m³)  → kWh
      //   EAU_CHAUDE (ECS) → m³,  * qECS * 1000  → kWh
      //   FIOUL    → L,   * 10 (PCI kWh/L)      → kWh
      //   ELECTRICITE / CHALEUR → déjà en kWh (pas de conversion)
      //   EAU_FROIDE → m³ (pas d'énergie)
      const cs = coefsBySite.get(siteId);
      const pcs = cs?.coefficientPCS ?? 10.5;
      const qMwh = cs?.coefficientQ ?? 0.13;
      if (fluid === "GAZ") return { value: delta * pcs, unit: "kWh" };
      if (fluid === "EAU_CHAUDE") return { value: delta * qMwh * 1000, unit: "kWh" };
      if (fluid === "FIOUL") return { value: delta * 10, unit: "kWh" };
      return null;
    };

    // Historique par compteur, chargé en une requête par compteur au lieu de deux
    // requêtes par relevé : sur une page de 1000 relevés, on passe de ~2000 allers-
    // retours Neon à une poignée.
    const maxDateByMeter = new Map<string, Date>();
    for (const r of readings) {
      const current = maxDateByMeter.get(r.meterId);
      if (!current || r.readingDate > current) {
        maxDateByMeter.set(r.meterId, r.readingDate);
      }
    }

    const historyByMeter = new Map<string, { rows: HistoryRow[]; complete: boolean }>();
    const meterEntries = Array.from(maxDateByMeter.entries());

    for (let i = 0; i < meterEntries.length; i += HISTORY_CONCURRENCY) {
      const batch = meterEntries.slice(i, i + HISTORY_CONCURRENCY);
      await Promise.all(
        batch.map(async ([meterId, maxDate]) => {
          const rows = await prisma.meterReading.findMany({
            where: { meterId, readingDate: { lte: maxDate } },
            orderBy: { readingDate: "desc" },
            take: HISTORY_WINDOW,
            select: { id: true, readingDate: true, indexValue: true, isReset: true },
          });
          // Fenêtre non saturée = tout l'historique du compteur est en mémoire.
          historyByMeter.set(meterId, { rows, complete: rows.length < HISTORY_WINDOW });
        })
      );
    }

    // For each reading, find its previous reading and recalculate consumption
    // on-the-fly so insertions of older readings update the chain automatically.
    // If the current reading is marked as "reset" (new meter), skip the previous.
    // Also, never look past a reset in the history — each "reset" starts a fresh chain.
    const enriched = await Promise.all(
      readings.map(async (r) => {
        let prev: { readingDate: Date; indexValue: number | null } | null = null;

        if (!r.isReset) {
          const history = historyByMeter.get(r.meterId);
          const rows = history?.rows ?? [];

          // rows est trié par date décroissante : la première correspondance
          // est la plus récente, comme le faisait findFirst + orderBy desc.
          const lastReset =
            rows.find(
              (row) => row.isReset && row.readingDate <= r.readingDate && row.id !== r.id
            ) ?? null;

          prev =
            rows.find(
              (row) =>
                row.indexValue != null &&
                row.readingDate < r.readingDate &&
                (!lastReset || row.readingDate >= lastReset.readingDate)
            ) ?? null;

          // Historique tronqué et rien trouvé : le relevé précédent est peut-être
          // hors fenêtre, on retombe sur la requête ciblée d'origine.
          if (!prev && history && !history.complete) {
            const olderReset = await prisma.meterReading.findFirst({
              where: {
                meterId: r.meterId,
                readingDate: { lte: r.readingDate },
                isReset: true,
                NOT: { id: r.id },
              },
              orderBy: { readingDate: "desc" },
              select: { readingDate: true },
            });

            prev = await prisma.meterReading.findFirst({
              where: {
                meterId: r.meterId,
                readingDate: olderReset
                  ? { lt: r.readingDate, gte: olderReset.readingDate }
                  : { lt: r.readingDate },
                indexValue: { not: null },
              },
              orderBy: { readingDate: "desc" },
              select: { readingDate: true, indexValue: true },
            });
          }
        }

        // Recalculate consumption live from index difference
        let consumption = r.consumption;
        let consumptionConverted: number | null = null;
        let unitConverted: string | null = null;
        if (r.indexValue != null && prev?.indexValue != null) {
          consumption = r.indexValue - prev.indexValue;
          // Conversion via coefficients contractuels (ContractSite), pas via Meter.conversionCoefficient
          const converted = convertDelta(r.meter.fluid, consumption, r.meter.siteId);
          if (converted) {
            consumptionConverted = converted.value;
            unitConverted = converted.unit;
          }
        } else if (r.indexValue != null && !prev) {
          // No previous reading → first reading, no consumption
          consumption = null;
          consumptionConverted = null;
          unitConverted = null;
        }

        return {
          ...r,
          consumption,
          consumptionConverted,
          unitConverted,
          previous: prev ? { readingDate: prev.readingDate, indexValue: prev.indexValue } : null,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching contract readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}
