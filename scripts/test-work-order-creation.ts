import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { handleQuoteStatusChange } from "../src/lib/work-order-hooks";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧪 Test de création automatique de WorkOrder\n");

  try {
    // 1. Chercher un devis P3 existant sans WorkOrder
    let quote = await prisma.quote.findFirst({
      where: {
        quoteType: "P3",
        workOrder: null,
      },
      include: {
        workOrder: true,
      },
    });

    // Si aucun devis P3 n'existe, en créer un
    if (!quote) {
      console.log("📝 Aucun devis P3 trouvé, création d'un devis de test...");

      const org = await prisma.organization.findFirst();
      const contract = await prisma.contract.findFirst();
      const site = await prisma.site.findFirst();

      if (!org || !contract || !site) {
        console.error("❌ Impossible de créer un devis : organisation, contrat ou site manquant");
        return;
      }

      quote = await prisma.quote.create({
        data: {
          reference: `TEST-P3-${Date.now()}`,
          title: "Test suivi des travaux - Remplacement chaudière",
          provider: "Test Provider",
          quoteType: "P3",
          amountHT: 5000,
          amountTTC: 6000,
          status: "BROUILLON",
          organizationId: org.id,
          contractId: contract.id,
          siteId: site.id,
        },
        include: {
          workOrder: true,
        },
      });

      console.log(`✅ Devis créé: ${quote.reference}\n`);
    } else {
      console.log(`📋 Devis trouvé: ${quote.reference} (${quote.quoteType})\n`);
    }

    // 2. Vérifier qu'il n'y a pas de WorkOrder
    console.log(`📊 État avant acceptation:`);
    console.log(`   - Statut devis: ${quote.status}`);
    console.log(`   - WorkOrder: ${quote.workOrder ? quote.workOrder.id : "Aucun"}\n`);

    // 3. Accepter le devis (simuler l'appel du hook)
    console.log(`✅ Acceptation du devis...`);
    await handleQuoteStatusChange(quote.id, "ACCEPTE");

    // 4. Vérifier qu'un WorkOrder a été créé
    const updatedQuote = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: {
        workOrder: {
          include: {
            events: true,
          },
        },
      },
    });

    console.log(`\n📊 État après acceptation:`);
    console.log(`   - Statut devis: ${updatedQuote?.status || "inconnu"}`);

    if (updatedQuote?.workOrder) {
      console.log(`   - WorkOrder créé: ${updatedQuote.workOrder.id}`);
      console.log(`   - Statut WorkOrder: ${updatedQuote.workOrder.status}`);
      console.log(`   - Date planifiée: ${updatedQuote.workOrder.planifiedDate}`);
      console.log(`   - Événements: ${updatedQuote.workOrder.events.length}`);
      console.log(`\n✅ TEST RÉUSSI : WorkOrder créé automatiquement !`);
    } else {
      console.log(`\n❌ TEST ÉCHOUÉ : Aucun WorkOrder créé`);
    }

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
