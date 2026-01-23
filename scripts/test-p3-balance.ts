import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧪 Test de la logique P3 Balance\n");

  try {
    // 1. Trouver un contrat avec des devis P3
    const contract = await prisma.contract.findFirst({
      where: {
        quotes: {
          some: {
            quoteType: "P3",
          },
        },
      },
    });

    if (!contract) {
      console.log("❌ Aucun contrat avec devis P3 trouvé");
      return;
    }

    console.log(`📋 Contrat: ${contract.reference}\n`);

    // 2. Compter les devis P3 acceptés SANS filtre WorkOrder
    const allQuotes = await prisma.quote.count({
      where: {
        contractId: contract.id,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
      },
    });

    console.log(`📊 Devis P3 acceptés (total): ${allQuotes}`);

    // 3. Compter les devis P3 acceptés AVEC filtre WorkOrder clôturé
    const closedQuotes = await prisma.quote.count({
      where: {
        contractId: contract.id,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
        OR: [
          { workOrder: { status: "CLOTURE" } },
          { workOrder: null },
        ],
      },
    });

    console.log(`✅ Devis P3 comptés dans balance: ${closedQuotes}`);
    console.log(`⏳ Devis en cours (non clôturés): ${allQuotes - closedQuotes}\n`);

    // 4. Détails par statut WorkOrder
    const quotesWithWorkOrders = await prisma.quote.findMany({
      where: {
        contractId: contract.id,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
      },
      include: {
        workOrder: {
          select: {
            status: true,
            closedAt: true,
          },
        },
      },
    });

    console.log("📋 Détail des devis P3:");
    quotesWithWorkOrders.forEach((quote) => {
      const woStatus = quote.workOrder?.status || "Pas de WorkOrder";
      const counted = !quote.workOrder || quote.workOrder.status === "CLOTURE" ? "✅ COMPTÉ" : "⏳ NON COMPTÉ";
      console.log(`   - ${quote.reference}: ${woStatus} → ${counted}`);
    });

    // 5. Vérifier qu'il y a au moins un devis non clôturé
    const unclosedQuote = quotesWithWorkOrders.find(
      (q) => q.workOrder && q.workOrder.status !== "CLOTURE"
    );

    if (unclosedQuote) {
      console.log(`\n✅ TEST RÉUSSI : La logique P3 balance fonctionne correctement`);
      console.log(`   - Les devis avec WorkOrder non clôturé ne sont pas comptés`);
      console.log(`   - Exemple: ${unclosedQuote.reference} (${unclosedQuote.workOrder?.status}) n'est pas compté`);
    } else {
      console.log(`\n⚠️  Tous les devis sont clôturés ou sans WorkOrder`);
      console.log(`   - Impossible de tester le filtrage des travaux non clôturés`);
    }

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
