/**
 * Seed de démo — Calibration des cibles NB
 *
 * Crée sous l'organisation SAGE un contrat fictif [DEMO CAL] avec 5 sites,
 * chacun incarnant un scénario de calibration distinct, et 5 saisons
 * d'historique cohérent pour pouvoir tester le diagnostic.
 *
 * Scénarios :
 *   1. Mairie Démoville        — cible trop LÂCHE (signature stable)
 *   2. Gymnase Bréhault        — cible trop SERRÉE (signature stable)
 *   3. École Voltaire          — cible BIEN CALIBRÉE
 *   4. Centre Admin Jules Ferry — tendance BAISSIÈRE (site rénové → cible devient lâche)
 *   5. Piscine Municipale      — signature INSTABLE (R² bas, non calibrable)
 *
 * Idempotent — relance sans doublon.
 * Usage :
 *   npx tsx scripts/seed-calibration-demo.ts
 */

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Paramètres ──────────────────────────────────────────────────

const CONTRACT_REF = "DEMO-CAL-2020";
const CLIENT_NAME = "[DEMO] Calibration";
const DJC = 2400; // DJU contractuels (référence)
const POSTAL = "75001";
const CITY = "Paris Démo";

// 5 saisons d'historique : 2020-21 à 2024-25 (2025-26 = saison en cours, pas incluse)
const SEASONS = [
  { season: "2020-2021", year: 2021, djrApprox: 2420 },
  { season: "2021-2022", year: 2022, djrApprox: 2300 },
  { season: "2022-2023", year: 2023, djrApprox: 2350 },
  { season: "2023-2024", year: 2024, djrApprox: 2180 }, // hiver doux
  { season: "2024-2025", year: 2025, djrApprox: 2450 }, // hiver un peu rigoureux
];

// Distribution mensuelle de la conso chauffage sur la saison (somme = 1.0)
const MONTH_DIST: Array<{ month: number; year: "start" | "end"; share: number }> = [
  { month: 10, year: "start", share: 0.10 }, // Oct
  { month: 11, year: "start", share: 0.18 }, // Nov
  { month: 12, year: "start", share: 0.22 }, // Déc
  { month: 1,  year: "end",   share: 0.22 }, // Jan
  { month: 2,  year: "end",   share: 0.17 }, // Fév
  { month: 3,  year: "end",   share: 0.09 }, // Mars
  { month: 4,  year: "end",   share: 0.02 }, // Avr
];

// Bruit aléatoire déterministe (seed fixe pour reproductibilité)
function seededNoise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─── Scénarios de signature ──────────────────────────────────────

interface Scenario {
  siteName: string;
  siteType: "MAIRIE" | "GYMNASE" | "ECOLE" | "PISCINE" | "AUTRE";
  nbCurrent: number; // cible NB actuelle en MWh (constante pour les 5 saisons)
  // Formule : NC_kwh = slope(season) * DJR + intercept(season) + noise
  slope: (seasonIdx: number) => number;      // kWh par DJU
  intercept: (seasonIdx: number) => number;  // kWh (talon)
  noiseFactor: number; // fraction de bruit relatif (0.02 = ±2%)
  noiseSeed: number;
}

const SCENARIOS: Scenario[] = [
  // 1. Lâche — signature stable, NB actuel trop haut
  {
    siteName: "[DEMO] Mairie Démoville",
    siteType: "MAIRIE",
    nbCurrent: 520,
    slope: () => 180,
    intercept: () => 25_000,
    noiseFactor: 0.025,
    noiseSeed: 101,
  },
  // 2. Serrée — signature stable, NB actuel trop bas
  {
    siteName: "[DEMO] Gymnase Bréhault",
    siteType: "GYMNASE",
    nbCurrent: 210,
    slope: () => 95,
    intercept: () => 15_000,
    noiseFactor: 0.03,
    noiseSeed: 202,
  },
  // 3. Bien calibrée
  {
    siteName: "[DEMO] École Voltaire",
    siteType: "ECOLE",
    nbCurrent: 310,
    slope: () => 120,
    intercept: () => 18_000,
    noiseFactor: 0.025,
    noiseSeed: 303,
  },
  // 4. Tendance baissière (rénovation progressive) → cible devient lâche
  {
    siteName: "[DEMO] Centre Admin Jules Ferry",
    siteType: "AUTRE",
    nbCurrent: 430,
    slope: (i) => 180 - i * 10, // 180, 170, 160, 150, 140
    intercept: () => 25_000,
    noiseFactor: 0.02,
    noiseSeed: 404,
  },
  // 5. Signature instable — bruit élevé, pas de corrélation linéaire avec DJR
  {
    siteName: "[DEMO] Piscine Municipale",
    siteType: "PISCINE",
    nbCurrent: 340,
    slope: () => 120,
    intercept: () => 18_000,
    noiseFactor: 0.25, // très gros bruit
    noiseSeed: 505,
  },
];

// ─── Génération d'une saison pour un site ────────────────────────

function seasonNcKwh(scenario: Scenario, seasonIdx: number, djrReal: number): number {
  const noise = seededNoise(scenario.noiseSeed + seasonIdx * 17);
  const slope = scenario.slope(seasonIdx);
  const intercept = scenario.intercept(seasonIdx);
  const base = slope * djrReal + intercept;
  const delta = base * scenario.noiseFactor * (noise() * 2 - 1);
  return Math.max(1000, Math.round(base + delta));
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  // 1. Org SAGE
  const sage = await prisma.organization.findFirst({
    where: { name: { equals: "SAGE", mode: "insensitive" } },
  });
  if (!sage) throw new Error("Organisation SAGE introuvable.");
  console.log(`✓ Org: ${sage.name}`);

  // 2. Client démo
  let client = await prisma.client.findFirst({
    where: { organizationId: sage.id, name: CLIENT_NAME },
  });
  if (!client) {
    client = await prisma.client.create({
      data: { name: CLIENT_NAME, city: CITY, postalCode: POSTAL, organizationId: sage.id },
    });
    console.log(`+ Client: ${client.name}`);
  } else {
    console.log(`✓ Client: ${client.name}`);
  }

  // 3. Contrat démo
  let contract = await prisma.contract.findFirst({
    where: { organizationId: sage.id, reference: CONTRACT_REF },
  });
  if (!contract) {
    contract = await prisma.contract.create({
      data: {
        reference: CONTRACT_REF,
        title: "[DEMO] Calibration des cibles NB",
        provider: "Démo Exploitant",
        startDate: new Date("2020-07-01"),
        endDate: new Date("2026-06-30"),
        status: "ACTIF",
        description: "Contrat de démonstration pour le rapport de calibration.",
        organizationId: sage.id,
        clientId: client.id,
        yearType: "HEATING_SEASON",
        yearStartMonth: 7,
        yearStartDay: 1,
        billingFrequency: "TRIMESTRIEL",
        djuContractuel: DJC,
      },
    });
    console.log(`+ Contrat: ${contract.reference}`);
  } else {
    console.log(`✓ Contrat: ${contract.reference}`);
  }

  // 4. Pour chaque scénario : site + contractSite + 5 saisons de data
  for (const sc of SCENARIOS) {
    console.log(`\n── ${sc.siteName} ──`);

    // Site
    let site = await prisma.site.findFirst({
      where: { organizationId: sage.id, clientId: client.id, name: sc.siteName },
    });
    if (!site) {
      site = await prisma.site.create({
        data: {
          name: sc.siteName,
          type: sc.siteType,
          address: "Démo",
          city: CITY,
          postalCode: POSTAL,
          energyType: "GAZ",
          organizationId: sage.id,
          clientId: client.id,
          djuContractuel: DJC,
        },
      });
      console.log(`  + Site créé`);
    } else {
      await prisma.site.update({
        where: { id: site.id },
        data: { djuContractuel: DJC },
      });
      console.log(`  ✓ Site existant (DJC mis à jour)`);
    }

    // ContractSite
    const link = await prisma.contractSite.findFirst({
      where: { contractId: contract.id, siteId: site.id },
    });
    if (!link) {
      await prisma.contractSite.create({
        data: {
          contractId: contract.id,
          siteId: site.id,
          contractType: "MTI",
          hasP1: true,
          hasP2: true,
          hasP3: false,
        },
      });
      console.log(`  + Lien contrat ↔ site`);
    } else {
      console.log(`  ✓ Lien existant`);
    }

    // Par saison
    for (let i = 0; i < SEASONS.length; i++) {
      const s = SEASONS[i];

      // HeatingSeason (NB + DJC) — NB constant sur toutes les saisons = cible actuelle
      await prisma.heatingSeason.upsert({
        where: { siteId_season: { siteId: site.id, season: s.season } },
        update: { nb: sc.nbCurrent, nbUnit: "PCS", djuContractuel: DJC },
        create: {
          siteId: site.id,
          season: s.season,
          nb: sc.nbCurrent,
          nbUnit: "PCS",
          djuContractuel: DJC,
        },
      });

      // HeatingPeriod (allumage 1er oct, arrêt 15 avril typique)
      const startDate = new Date(s.year - 1, 9, 1);   // 1er oct de l'année année-1
      const endDate = new Date(s.year, 3, 15);        // 15 avr de l'année
      const existingPeriod = await prisma.heatingPeriod.findFirst({
        where: { siteId: site.id, startDate },
      });
      if (!existingPeriod) {
        await prisma.heatingPeriod.create({
          data: { siteId: site.id, startDate, endDate },
        });
      }

      // Conso mensuelle répartie sur Oct-Avr
      const ncTotal = seasonNcKwh(sc, i, s.djrApprox);

      for (const md of MONTH_DIST) {
        const yearForMonth = md.year === "start" ? s.year - 1 : s.year;
        const period = new Date(yearForMonth, md.month - 1, 1);
        const quantity = Math.round(ncTotal * md.share);

        await prisma.consumption.upsert({
          where: {
            siteId_energyType_usage_period_source: {
              siteId: site.id,
              energyType: "GAZ",
              usage: "CHAUFFAGE",
              period,
              source: "MANUAL",
            },
          },
          update: { quantity, unit: "kWh", organizationId: sage.id },
          create: {
            siteId: site.id,
            organizationId: sage.id,
            energyType: "GAZ",
            usage: "CHAUFFAGE",
            source: "MANUAL",
            period,
            quantity,
            unit: "kWh",
          },
        });
      }

      console.log(`  · saison ${s.season}: NC=${Math.round(ncTotal / 1000)} MWh, NB=${sc.nbCurrent} MWh`);
    }
  }

  console.log("\n✅ Seed démo calibration terminé.");
  console.log(`   Contrat : ${CONTRACT_REF}`);
  console.log(`   Sélectionne-le dans le contract switcher pour voir les 5 scénarios.`);
  console.log(`   → /rapports/calibration-cibles?contract=${contract.id}`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
