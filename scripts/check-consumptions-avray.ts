/**
 * Compte les Consumption en base pour les 3 sites Avray
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
  const sites = await prisma.site.findMany({
    where: { pce: { in: ["GI038161", "GI038189", "GI038148"] } },
    select: { id: true, name: true, pce: true },
  });

  console.log(`\n${sites.length} sites trouvés\n`);

  for (const s of sites) {
    const count = await prisma.consumption.count({
      where: { siteId: s.id, energyType: "GAZ" },
    });
    const sum = await prisma.consumption.aggregate({
      where: { siteId: s.id, energyType: "GAZ" },
      _sum: { quantity: true },
    });
    const first = await prisma.consumption.findFirst({
      where: { siteId: s.id, energyType: "GAZ" },
      orderBy: { period: "asc" },
      select: { period: true, quantity: true },
    });
    const last = await prisma.consumption.findFirst({
      where: { siteId: s.id, energyType: "GAZ" },
      orderBy: { period: "desc" },
      select: { period: true, quantity: true },
    });

    console.log(`${s.name} (${s.pce})`);
    console.log(`  ${count} relevés en base`);
    console.log(`  Total: ${Math.round(sum._sum.quantity || 0)} kWh`);
    if (first && last) {
      console.log(
        `  Période: ${first.period.toISOString().split("T")[0]} → ${last.period.toISOString().split("T")[0]}`
      );
    }
    console.log("");
  }
}

main().finally(() => prisma.$disconnect());
