import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * POST /api/admin/seed-calibration-demo
 *
 * Crée dans l'organisation de l'utilisateur auth'd un contrat démo
 * [DEMO] Calibration avec 5 sites représentant les 5 cas de figure
 * du diagnostic signature énergétique. Idempotent via upsert.
 */

const CONTRACT_REF = "DEMO-CAL-2020";
const CLIENT_NAME = "[DEMO] Calibration";
const DJC = 2400;
const POSTAL = "75001";
const CITY = "Paris Démo";

const SEASONS = [
  { season: "2020-2021", year: 2021, djrApprox: 2420 },
  { season: "2021-2022", year: 2022, djrApprox: 2300 },
  { season: "2022-2023", year: 2023, djrApprox: 2350 },
  { season: "2023-2024", year: 2024, djrApprox: 2180 },
  { season: "2024-2025", year: 2025, djrApprox: 2450 },
];

const MONTH_DIST: Array<{ month: number; part: "start" | "end"; share: number }> = [
  { month: 10, part: "start", share: 0.10 },
  { month: 11, part: "start", share: 0.18 },
  { month: 12, part: "start", share: 0.22 },
  { month: 1,  part: "end",   share: 0.22 },
  { month: 2,  part: "end",   share: 0.17 },
  { month: 3,  part: "end",   share: 0.09 },
  { month: 4,  part: "end",   share: 0.02 },
];

function seededNoise(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

interface Scenario {
  siteName: string;
  siteType: "MAIRIE" | "GYMNASE" | "ECOLE" | "PISCINE" | "AUTRE";
  nbCurrent: number;
  slope: (i: number) => number;
  intercept: (i: number) => number;
  noiseFactor: number;
  noiseSeed: number;
}

const SCENARIOS: Scenario[] = [
  { siteName: "[DEMO] Mairie Démoville",         siteType: "MAIRIE",  nbCurrent: 520, slope: () => 180,           intercept: () => 25_000, noiseFactor: 0.025, noiseSeed: 101 },
  { siteName: "[DEMO] Gymnase Bréhault",         siteType: "GYMNASE", nbCurrent: 210, slope: () =>  95,           intercept: () => 15_000, noiseFactor: 0.03,  noiseSeed: 202 },
  { siteName: "[DEMO] École Voltaire",           siteType: "ECOLE",   nbCurrent: 310, slope: () => 120,           intercept: () => 18_000, noiseFactor: 0.025, noiseSeed: 303 },
  { siteName: "[DEMO] Centre Admin Jules Ferry", siteType: "AUTRE",   nbCurrent: 430, slope: (i) => 180 - i * 10, intercept: () => 25_000, noiseFactor: 0.02,  noiseSeed: 404 },
  { siteName: "[DEMO] Piscine Municipale",       siteType: "PISCINE", nbCurrent: 340, slope: () => 120,           intercept: () => 18_000, noiseFactor: 0.25,  noiseSeed: 505 },
];

function seasonNcKwh(sc: Scenario, i: number, djr: number): number {
  const noise = seededNoise(sc.noiseSeed + i * 17);
  const base = sc.slope(i) * djr + sc.intercept(i);
  const delta = base * sc.noiseFactor * (noise() * 2 - 1);
  return Math.max(1000, Math.round(base + delta));
}

export async function POST(_req: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Permission refusée — ADMIN ou SUPER_ADMIN requis" },
        { status: 403 }
      );
    }

    const orgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const logs: string[] = [];

    // 1. Client démo
    let client = await prisma.client.findFirst({
      where: { organizationId: orgId, name: CLIENT_NAME },
    });
    if (!client) {
      client = await prisma.client.create({
        data: { name: CLIENT_NAME, city: CITY, postalCode: POSTAL, organizationId: orgId },
      });
      logs.push(`+ Client créé : ${client.name}`);
    } else {
      logs.push(`✓ Client existant : ${client.name}`);
    }

    // 2. Contrat démo
    let contract = await prisma.contract.findFirst({
      where: { organizationId: orgId, reference: CONTRACT_REF },
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
          description: "Contrat de démonstration — 5 scénarios de calibration signature énergétique.",
          organizationId: orgId,
          clientId: client.id,
          yearType: "HEATING_SEASON",
          yearStartMonth: 7,
          yearStartDay: 1,
          billingFrequency: "TRIMESTRIEL",
          djuContractuel: DJC,
        },
      });
      logs.push(`+ Contrat créé : ${contract.reference}`);
    } else {
      logs.push(`✓ Contrat existant : ${contract.reference}`);
    }

    let sitesCreated = 0;
    let consoRows = 0;

    // 3. Par scénario : site + contractSite + 5 saisons
    for (const sc of SCENARIOS) {
      let site = await prisma.site.findFirst({
        where: { organizationId: orgId, clientId: client.id, name: sc.siteName },
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
            organizationId: orgId,
            clientId: client.id,
            djuContractuel: DJC,
          },
        });
        sitesCreated++;
      } else {
        await prisma.site.update({
          where: { id: site.id },
          data: { djuContractuel: DJC },
        });
      }

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
      }

      for (let i = 0; i < SEASONS.length; i++) {
        const s = SEASONS[i];

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

        const startDate = new Date(s.year - 1, 9, 1);
        const endDate = new Date(s.year, 3, 15);
        const existingPeriod = await prisma.heatingPeriod.findFirst({
          where: { siteId: site.id, startDate },
        });
        if (!existingPeriod) {
          await prisma.heatingPeriod.create({
            data: { siteId: site.id, startDate, endDate },
          });
        }

        const ncTotal = seasonNcKwh(sc, i, s.djrApprox);
        for (const md of MONTH_DIST) {
          const yearForMonth = md.part === "start" ? s.year - 1 : s.year;
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
            update: { quantity, unit: "kWh", organizationId: orgId },
            create: {
              siteId: site.id,
              organizationId: orgId,
              energyType: "GAZ",
              usage: "CHAUFFAGE",
              source: "MANUAL",
              period,
              quantity,
              unit: "kWh",
            },
          });
          consoRows++;
        }
      }
      logs.push(`  · ${sc.siteName} — 5 saisons`);
    }

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      contractRef: contract.reference,
      sitesCreated,
      consoRows,
      logs,
      redirectTo: `/rapports/calibration-cibles?contract=${contract.id}`,
    });
  } catch (error) {
    console.error("seed-calibration-demo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
