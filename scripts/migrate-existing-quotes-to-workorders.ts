/**
 * Script de migration : Créer des WorkOrders pour les devis P3/P5 déjà acceptés
 *
 * Usage: npx tsx scripts/migrate-existing-quotes-to-workorders.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Charger les variables d'environnement
config({ path: resolve(__dirname, "../.env.local") });

import prisma from "../src/lib/prisma";

async function migrateExistingQuotes() {
  console.log("🔍 Recherche des devis P3/P5 acceptés sans WorkOrder...\n");

  // Trouver tous les devis P3/P5 acceptés/commandés/facturés sans WorkOrder
  const quotesWithoutWorkOrder = await prisma.quote.findMany({
    where: {
      quoteType: {
        in: ["P3", "P5"],
      },
      status: {
        in: ["ACCEPTE", "COMMANDE", "FACTURE"],
      },
      workOrder: null, // Pas de WorkOrder existant
    },
    include: {
      site: {
        select: {
          name: true,
        },
      },
      contract: {
        select: {
          reference: true,
        },
      },
    },
  });

  console.log(`📊 Trouvé ${quotesWithoutWorkOrder.length} devis sans WorkOrder\n`);

  if (quotesWithoutWorkOrder.length === 0) {
    console.log("✅ Aucune migration nécessaire - tous les devis ont déjà un WorkOrder");
    return;
  }

  // Afficher la liste
  console.log("Devis à migrer:");
  quotesWithoutWorkOrder.forEach((quote, index) => {
    console.log(
      `${index + 1}. ${quote.reference} - ${quote.title} (${quote.quoteType}) - ${quote.status}`
    );
    console.log(
      `   Site: ${quote.site?.name || "N/A"} | Contrat: ${quote.contract?.reference || "N/A"}`
    );
    console.log(`   Montant: ${quote.amountHT.toLocaleString("fr-FR")} € HT\n`);
  });

  // Demander confirmation (en production, vous pourriez ajouter readline pour confirmation)
  console.log("⚠️  ATTENTION: Cette opération va créer des WorkOrders avec status=CLOTURE");
  console.log(
    "   (car ces devis sont déjà anciens et probablement terminés)\n"
  );

  // Créer les WorkOrders
  let successCount = 0;
  let errorCount = 0;

  for (const quote of quotesWithoutWorkOrder) {
    try {
      // Créer le WorkOrder avec status CLOTURE
      const workOrder = await prisma.workOrder.create({
        data: {
          quoteId: quote.id,
          status: "CLOTURE",
          planifiedDate: quote.issueDate, // Utiliser la date du devis
          startDate: quote.issueDate,
          completionDate: quote.acceptedAt || quote.issueDate,
          closedAt: quote.acceptedAt || new Date(),
          closedBy: quote.acceptedBy || "migration-script",
        },
      });

      // Créer l'événement dans l'historique
      await prisma.workEvent.create({
        data: {
          workOrderId: workOrder.id,
          eventType: "CLOSED",
          oldValue: null,
          newValue: "CLOTURE",
          performedBy: "migration-script",
          notes: `WorkOrder créé par migration automatique pour devis ${quote.reference} déjà accepté`,
        },
      });

      console.log(`✅ WorkOrder créé pour ${quote.reference}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Erreur pour ${quote.reference}:`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Migration terminée`);
  console.log(`   Succès: ${successCount}`);
  console.log(`   Erreurs: ${errorCount}`);
  console.log(`   Total: ${quotesWithoutWorkOrder.length}`);
  console.log("=".repeat(60) + "\n");
}

// Exécuter la migration
migrateExistingQuotes()
  .then(() => {
    console.log("✨ Migration complète!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erreur lors de la migration:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
