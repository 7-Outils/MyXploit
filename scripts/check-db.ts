import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Checking database...\n");

  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          contracts: true,
          sites: true,
          users: true,
        },
      },
    },
  });

  console.log("📦 Organizations:");
  orgs.forEach(org => {
    console.log(`  - ${org.name} (${org.slug})`);
    console.log(`    Contracts: ${org._count.contracts}`);
    console.log(`    Sites: ${org._count.sites}`);
    console.log(`    Users: ${org._count.users}`);
  });

  const contracts = await prisma.contract.findMany({
    include: {
      organization: true,
    },
  });

  console.log("\n📋 Contracts:");
  contracts.forEach(c => {
    console.log(`  - ${c.reference}: ${c.title} (${c.organization.name})`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
