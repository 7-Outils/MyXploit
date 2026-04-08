/**
 * Seed: Ville d'Avray comme client + contrat sous l'organisation SAGE
 *
 * Étapes :
 *   1. Cleanup : supprime l'org "Ville d'Avray" si elle existe (créée par erreur)
 *   2. Crée un client "Ville d'Avray" sous SAGE
 *   3. Crée 3 sites (Mairie, Piscine, Groupe Scolaire La Ronce) avec leurs PCEs prod
 *   4. Crée un contrat de prestation rattaché aux 3 sites via ContractSite
 *
 * Idempotent : peut être relancé sans créer de doublons.
 *
 * Usage:
 *   npx tsx scripts/seed-ville-davray.ts
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SITES = [
  {
    name: "Mairie",
    type: "MAIRIE" as const,
    pce: "GI038161",
    address: "Place Charles de Gaulle",
  },
  {
    name: "Piscine",
    type: "PISCINE" as const,
    pce: "GI038189",
    address: "Avenue de Balzac",
  },
  {
    name: "Groupe Scolaire La Ronce",
    type: "ECOLE" as const,
    pce: "GI038148",
    address: "Rue de la Ronce",
  },
];

async function main() {
  // ─── 1. CLEANUP : supprimer l'org "Ville d'Avray" créée par erreur ─────────
  const wrongOrg = await prisma.organization.findUnique({
    where: { slug: "ville-davray" },
  });
  if (wrongOrg) {
    await prisma.organization.delete({ where: { id: wrongOrg.id } });
    console.log(`🗑  Org "Ville d'Avray" supprimée (cascade) → ${wrongOrg.id}`);
  }

  // ─── 2. Trouver l'org SAGE ─────────────────────────────────────────────────
  const sage = await prisma.organization.findFirst({
    where: { name: { equals: "SAGE", mode: "insensitive" } },
  });
  if (!sage) {
    throw new Error("Organisation SAGE introuvable.");
  }
  console.log(`✓ Organisation cible: ${sage.name} (${sage.id})`);

  // ─── 3. Upsert Client "Ville d'Avray" sous SAGE ────────────────────────────
  let client = await prisma.client.findFirst({
    where: {
      organizationId: sage.id,
      name: { equals: "Ville d'Avray", mode: "insensitive" },
    },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: "Ville d'Avray",
        city: "Ville-d'Avray",
        postalCode: "92410",
        organizationId: sage.id,
      },
    });
    console.log(`+ Client créé: ${client.name} (${client.id})`);
  } else {
    console.log(`✓ Client existant: ${client.name} (${client.id})`);
  }

  // ─── 4. Upsert les 3 sites sous SAGE / Ville d'Avray ───────────────────────
  const createdSites: { id: string; name: string; pce: string }[] = [];
  for (const s of SITES) {
    const existing = await prisma.site.findFirst({
      where: {
        organizationId: sage.id,
        clientId: client.id,
        name: { equals: s.name, mode: "insensitive" },
      },
    });
    if (existing) {
      const updated = await prisma.site.update({
        where: { id: existing.id },
        data: { pce: s.pce },
      });
      console.log(`  ↻ Site MAJ: ${updated.name} → PCE ${updated.pce}`);
      createdSites.push({ id: updated.id, name: updated.name, pce: s.pce });
    } else {
      const created = await prisma.site.create({
        data: {
          name: s.name,
          type: s.type,
          address: s.address,
          city: "Ville-d'Avray",
          postalCode: "92410",
          energyType: "GAZ",
          pce: s.pce,
          organizationId: sage.id,
          clientId: client.id,
        },
      });
      console.log(`  + Site créé: ${created.name} (PCE ${created.pce})`);
      createdSites.push({ id: created.id, name: created.name, pce: s.pce });
    }
  }

  // ─── 5. Upsert Contract de prestation Ville d'Avray ────────────────────────
  const contractRef = "MARCHE-AVRAY-2026";
  let contract = await prisma.contract.findFirst({
    where: {
      organizationId: sage.id,
      reference: contractRef,
    },
  });
  if (!contract) {
    contract = await prisma.contract.create({
      data: {
        reference: contractRef,
        title: "Marché d'exploitation CVC — Ville d'Avray",
        provider: "À définir",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2030-12-31"),
        status: "ACTIF",
        description: "Contrat d'exploitation des installations CVC de la Ville d'Avray",
        organizationId: sage.id,
        clientId: client.id,
      },
    });
    console.log(`+ Contrat créé: ${contract.reference} (${contract.id})`);
  } else {
    console.log(`✓ Contrat existant: ${contract.reference} (${contract.id})`);
  }

  // ─── 6. Lier les sites au contrat via ContractSite ─────────────────────────
  for (const site of createdSites) {
    const link = await prisma.contractSite.findFirst({
      where: { contractId: contract.id, siteId: site.id },
    });
    if (!link) {
      await prisma.contractSite.create({
        data: {
          contractId: contract.id,
          siteId: site.id,
          contractType: "MC",
          hasP1: false,
          hasP2: true,
          hasP3: true,
        },
      });
      console.log(`  + Lien contrat ↔ site: ${site.name}`);
    } else {
      console.log(`  ✓ Lien contrat ↔ site existant: ${site.name}`);
    }
  }

  console.log("\n✅ Seed terminé. Tu peux maintenant lancer Synchroniser GRDF depuis l'org SAGE.");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
