import prisma from "@/lib/prisma";
import { addDays, endOfMonth } from "date-fns";
import { EnergyType, EnergyUsage, MeterFluid } from "@/generated/prisma/client";
import { prorateAcrossMonths, periodKeyToDate } from "@/lib/date-prorate";

type MeterWithReadings = {
  id: string;
  name: string;
  fluid: MeterFluid;
  unit: string;
  conversionCoefficient: number | null;
  conversionUnit: string | null;
  siteId: string;
  readings: {
    id: string;
    readingDate: Date;
    indexValue: number | null;
    isReset: boolean;
  }[];
};

function fluidToEnergyContext(
  fluid: MeterFluid,
  meterName: string
): { energyType: EnergyType; usage: EnergyUsage } {
  const nameLower = meterName.toLowerCase();
  const isEcsName = /\becs\b|sanitaire|eau chaude/.test(nameLower);

  switch (fluid) {
    case "GAZ":
      return { energyType: "GAZ", usage: isEcsName ? "ECS" : "CHAUFFAGE" };
    case "ELECTRICITE":
      return { energyType: "ELECTRICITE", usage: "MIXTE" };
    case "EAU_CHAUDE":
      return { energyType: "EAU", usage: "ECS" };
    case "EAU_FROIDE":
      return { energyType: "EAU", usage: "AUTRE" };
    case "CHALEUR":
      return { energyType: "RESEAU_CHALEUR", usage: "CHAUFFAGE" };
    case "FIOUL":
      return { energyType: "FIOUL", usage: "CHAUFFAGE" };
    default:
      return { energyType: "AUTRE", usage: "AUTRE" };
  }
}

/**
 * Régénère les lignes Consumption (source=EXPLOITANT) pour un site, à partir des MeterReading.
 * Supprime toutes les Consumption source=EXPLOITANT du site puis les recalcule depuis zéro.
 */
export async function regenerateConsumptionForSite(
  siteId: string,
  organizationId: string
): Promise<{ generated: number; deleted: number }> {
  // Paramètres contractuels (source de vérité unique)
  // Si le site appartient à plusieurs contrats, on prend le plus récemment intégré
  // et non sorti. Fallback 10.5 PCS / 0.13 qECS si aucun contrat actif.
  const contractSites = await prisma.contractSite.findMany({
    where: { siteId, exitDate: null },
    orderBy: { integrationDate: "desc" },
    select: { coefficientPCS: true, coefficientQ: true },
  });
  const activeCs = contractSites[0] ?? null;
  const sitePcs = activeCs?.coefficientPCS ?? 10.5;
  const siteQMwh = activeCs?.coefficientQ ?? 0.13; // MWh/m³

  const meters = await prisma.meter.findMany({
    where: { siteId, isActive: true },
    select: {
      id: true,
      name: true,
      fluid: true,
      unit: true,
      conversionCoefficient: true,
      conversionUnit: true,
      siteId: true,
      readings: {
        where: { indexValue: { not: null } },
        orderBy: { readingDate: "asc" },
        select: {
          id: true,
          readingDate: true,
          indexValue: true,
          isReset: true,
        },
      },
    },
  });

  // Coefficient energy/m³ à appliquer à delta (output en kWh pour Consumption.quantity).
  // Sémantique par fluide (Meter.unit historiquement peu fiable — artefact de l'ancien
  // import qui pré-convertissait au stockage).
  //   GAZ      → index en m³,  * PCS                → kWh
  //   EAU_CHAUDE → m³,          * qECS × 1000       → kWh
  //   FIOUL    → L,             * 10 (PCI kWh/L)    → kWh
  //   ELECTRICITE / CHALEUR → déjà en kWh (no-op)
  //   EAU_FROIDE → m³ (pas de conversion énergétique)
  const coefFor = (fluid: MeterFluid, unit: string): { coef: number | null; outUnit: string } => {
    if (fluid === "GAZ") return { coef: sitePcs, outUnit: "kWh" };
    if (fluid === "EAU_CHAUDE") return { coef: siteQMwh * 1000, outUnit: "kWh" };
    if (fluid === "FIOUL") return { coef: 10, outUnit: "kWh" };
    if (fluid === "ELECTRICITE" || fluid === "CHALEUR") return { coef: 1, outUnit: "kWh" };
    return { coef: null, outUnit: unit };
  };

  // Agrégation: key = "siteId|energyType|usage|periodKey" → { quantity, periodEnd, meterNames }
  type Bucket = {
    siteId: string;
    energyType: EnergyType;
    usage: EnergyUsage;
    period: Date;
    quantity: number;
    unit: string;
    meterNames: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const meter of meters as MeterWithReadings[]) {
    const { energyType, usage } = fluidToEnergyContext(meter.fluid, meter.name);
    const { coef, outUnit } = coefFor(meter.fluid, meter.unit);
    const outputUnit = outUnit;

    // Itérer paires (prev, curr). isReset ferme la chaîne.
    let prev: (typeof meter.readings)[number] | null = null;
    for (const curr of meter.readings) {
      if (curr.isReset) {
        // Ce relevé est une baseline (nouveau compteur). Pas de delta à calculer avec le précédent.
        prev = curr;
        continue;
      }
      if (!prev || prev.indexValue == null || curr.indexValue == null) {
        prev = curr;
        continue;
      }

      const delta = curr.indexValue - prev.indexValue;
      if (delta <= 0) {
        // Index en décroissance ou nul — skip (le flag isReset aurait dû être utilisé)
        prev = curr;
        continue;
      }

      const converted = coef != null ? delta * coef : delta;

      const startDate = addDays(prev.readingDate, 1);
      const endDate = curr.readingDate;
      const monthsMap = prorateAcrossMonths(startDate, endDate, converted);

      for (const [periodIso, monthQty] of monthsMap.entries()) {
        const bucketKey = `${meter.siteId}|${energyType}|${usage}|${periodIso}`;
        const existing = buckets.get(bucketKey);
        if (existing) {
          existing.quantity += monthQty;
          existing.meterNames.add(meter.name);
        } else {
          buckets.set(bucketKey, {
            siteId: meter.siteId,
            energyType,
            usage,
            period: periodKeyToDate(periodIso),
            quantity: monthQty,
            unit: outputUnit,
            meterNames: new Set([meter.name]),
          });
        }
      }

      prev = curr;
    }
  }

  const rows = Array.from(buckets.values()).map((b) => ({
    siteId: b.siteId,
    organizationId,
    energyType: b.energyType,
    usage: b.usage,
    source: "EXPLOITANT" as const,
    period: b.period,
    periodEnd: endOfMonth(b.period),
    quantity: b.quantity,
    unit: b.unit,
    meterName: Array.from(b.meterNames).join(", "),
  }));

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.consumption.deleteMany({
      where: { siteId, source: "EXPLOITANT" },
    });
    if (rows.length === 0) {
      return { generated: 0, deleted: deleted.count };
    }
    const created = await tx.consumption.createMany({ data: rows });
    return { generated: created.count, deleted: deleted.count };
  });

  return result;
}
