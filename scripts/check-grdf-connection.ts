/**
 * Check GRDF connection stored in DB for SAGE org
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sage = await prisma.organization.findFirst({
    where: { name: { equals: "SAGE", mode: "insensitive" } },
  });
  if (!sage) throw new Error("SAGE introuvable");

  const providers = await prisma.energyProvider.findMany({
    where: { organizationId: sage.id },
  });

  console.log(`\n📡 Providers énergie pour SAGE (${providers.length}):\n`);
  for (const p of providers) {
    const payload = p.refreshToken ?? "";
    const [env, cid, csecret] = payload.split("|");
    console.log(`  Provider:    ${p.provider}`);
    console.log(`  Connecté:    ${p.isConnected}`);
    console.log(`  Environment: ${env || "—"}`);
    console.log(`  ClientId:    ${cid || "—"}`);
    console.log(`  Secret:      ${csecret ? csecret.slice(0, 8) + "…(masqué)" : "—"}`);
    console.log(`  TokenExpiry: ${p.tokenExpiresAt ?? "—"}`);
    console.log(`  LastSync:    ${p.lastSyncAt ?? "—"}`);
    console.log(`  LastError:   ${p.lastError ?? "—"}`);
    console.log("");
  }
}

main()
  .catch((e) => console.error("❌", e))
  .finally(() => prisma.$disconnect());
