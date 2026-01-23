import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Vérification des tables de suivi des travaux...\n");

  try {
    // Test WorkOrder table
    const workOrderCount = await prisma.workOrder.count();
    console.log("✅ Table work_orders existe:", workOrderCount, "records");

    // Test WorkAttachement table
    const attachementCount = await prisma.workAttachement.count();
    console.log("✅ Table work_attachements existe:", attachementCount, "records");

    // Test WorkReservation table
    const reservationCount = await prisma.workReservation.count();
    console.log("✅ Table work_reservations existe:", reservationCount, "records");

    // Test WorkLevee table
    const leveeCount = await prisma.workLevee.count();
    console.log("✅ Table work_levees existe:", leveeCount, "records");

    // Test WorkEvent table
    const eventCount = await prisma.workEvent.count();
    console.log("✅ Table work_events existe:", eventCount, "records");

    console.log("\n✅ Toutes les tables de suivi des travaux ont été créées avec succès!");
  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
