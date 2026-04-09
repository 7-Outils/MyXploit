/**
 * Quick debug script to verify the N'B calculation for Piscine de Ville d'Avray.
 *
 * Reproduces the analytics endpoint logic locally and compares with what
 * the user sees in the UI.
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const site = await prisma.site.findFirst({
    where: { pce: "GI038189" },
    select: {
      id: true,
      name: true,
      nb: true,
      nbUnit: true,
      djuContractuel: true,
      stationMeteo: true,
      postalCode: true,
    },
  });
  if (!site) {
    console.log("Piscine introuvable");
    return;
  }
  console.log("Site:", site);

  const consos = await prisma.consumption.findMany({
    where: {
      siteId: site.id,
      energyType: "GAZ",
      period: { gte: new Date(2024, 6, 1), lte: new Date(2025, 5, 30) },
    },
    select: {
      period: true,
      quantity: true,
      usage: true,
      djuReel: true,
    },
    orderBy: { period: "asc" },
  });
  console.log(`\n${consos.length} consumption rows`);

  const byMonth = new Map<
    string,
    { kwh: number; djr: number; count: number; usages: Set<string> }
  >();
  for (const c of consos) {
    const k = `${c.period.getFullYear()}-${String(c.period.getMonth() + 1).padStart(2, "0")}`;
    const e = byMonth.get(k) || {
      kwh: 0,
      djr: 0,
      count: 0,
      usages: new Set<string>(),
    };
    if (c.usage === "CHAUFFAGE") {
      e.kwh += c.quantity;
      if (c.djuReel) e.djr += c.djuReel;
    }
    e.count++;
    e.usages.add(c.usage);
    byMonth.set(k, e);
  }

  console.log("\nPer-month aggregation (CHAUFFAGE only — same as analytics):");
  let totalKwh = 0;
  let totalDjr = 0;
  for (const [k, v] of [...byMonth.entries()].sort()) {
    console.log(
      `  ${k}: ${(v.kwh / 1000).toFixed(1)} MWh, DJR=${v.djr.toFixed(0)} (${v.count} rows, usages: ${[...v.usages].join("/")})`
    );
    totalKwh += v.kwh;
    totalDjr += v.djr;
  }
  console.log(`\nTotal NC: ${(totalKwh / 1000).toFixed(1)} MWh`);
  console.log(`Total DJR: ${totalDjr.toFixed(0)}`);

  const nbKwh = (site.nb || 0) * 1000;
  const djuc = site.djuContractuel || 2400;
  console.log(`\nNB: ${site.nb} MWh = ${nbKwh} kWh`);
  console.log(`DJC: ${djuc}`);

  // Direct N'B
  const directNbPrime = (nbKwh * totalDjr) / djuc;
  console.log(
    `\nN'B direct (NB × DJR_total / DJC) = ${(directNbPrime / 1000).toFixed(1)} MWh`
  );

  // Per-month N'B as analytics endpoint computes it
  console.log(
    `\nPer-month N'B (analytics formula: monthlyNbBase × (monthDjr / (DJC/12))):`
  );
  let totalMonthlyNbPrime = 0;
  for (const [k, v] of [...byMonth.entries()].sort()) {
    const monthlyNbBase = nbKwh / 12;
    const nbPrime =
      v.djr > 0 ? monthlyNbBase * (v.djr / (djuc / 12)) : 0;
    totalMonthlyNbPrime += nbPrime;
    console.log(`  ${k}: ${(nbPrime / 1000).toFixed(1)} MWh`);
  }
  console.log(
    `\nTotal N'B (sum of monthly): ${(totalMonthlyNbPrime / 1000).toFixed(1)} MWh`
  );
  console.log(
    `→ Ratio direct vs sum: ${(totalMonthlyNbPrime / directNbPrime).toFixed(2)}×`
  );
}

main()
  .catch((e) => console.error("ERR:", e))
  .finally(() => prisma.$disconnect());
