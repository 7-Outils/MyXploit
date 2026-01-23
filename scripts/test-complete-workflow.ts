import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { handleQuoteStatusChange } from "../src/lib/work-order-hooks";
import { canCloseWorkOrder } from "../src/lib/work-order-validation";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧪 Test du workflow complet: Devis → WorkOrder → Clôture → P3 Balance\n");

  try {
    // 0. Récupérer les données nécessaires
    const org = await prisma.organization.findFirst();
    const contract = await prisma.contract.findFirst();
    const site = await prisma.site.findFirst();

    if (!org || !contract || !site) {
      console.error("❌ Données manquantes (org/contract/site)");
      return;
    }

    // 1. Créer un devis P3
    console.log("📝 Étape 1: Création d'un devis P3");
    const quote = await prisma.quote.create({
      data: {
        reference: `TEST-WORKFLOW-${Date.now()}`,
        title: "Test workflow complet - Installation PAC",
        provider: "Test Provider",
        quoteType: "P3",
        amountHT: 12000,
        amountTTC: 14400,
        status: "BROUILLON",
        organizationId: org.id,
        contractId: contract.id,
        siteId: site.id,
      },
    });
    console.log(`✅ Devis créé: ${quote.reference} (${quote.amountHT}€ HT)\n`);

    // 2. Accepter le devis → WorkOrder auto-créé
    console.log("📝 Étape 2: Acceptation du devis");
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTE" },
    });
    await handleQuoteStatusChange(quote.id, "ACCEPTE");

    const quoteWithWO = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: { workOrder: true },
    });
    console.log(`✅ WorkOrder créé: ${quoteWithWO?.workOrder?.id} (status: ${quoteWithWO?.workOrder?.status})\n`);

    // 3. Vérifier P3 balance AVANT clôture
    console.log("📝 Étape 3: Vérification P3 balance (AVANT clôture)");
    const beforeClosure = await prisma.quote.count({
      where: {
        contractId: contract.id,
        id: quote.id,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
        OR: [
          { workOrder: { status: "CLOTURE" } },
          { workOrder: null },
        ],
      },
    });
    console.log(`   Devis compté dans P3: ${beforeClosure === 0 ? "❌ NON" : "✅ OUI"}`);
    if (beforeClosure === 0) {
      console.log(`   ✅ Correct: Le devis n'est PAS compté (WorkOrder pas clôturé)\n`);
    } else {
      console.log(`   ❌ Erreur: Le devis est compté alors qu'il ne devrait pas l'être\n`);
    }

    // 4. Passer le WorkOrder à TERMINE
    console.log("📝 Étape 4: Passage du WorkOrder à TERMINE");
    await prisma.workOrder.update({
      where: { id: quoteWithWO!.workOrder!.id },
      data: {
        status: "EN_COURS",
        startDate: new Date(),
      },
    });
    await prisma.workOrder.update({
      where: { id: quoteWithWO!.workOrder!.id },
      data: {
        status: "TERMINE",
        completionDate: new Date(),
      },
    });
    console.log(`✅ WorkOrder status: TERMINE\n`);

    // 5. Ajouter un attachement (obligatoire pour clôture)
    console.log("📝 Étape 5: Ajout d'un attachement");
    await prisma.workAttachement.create({
      data: {
        workOrderId: quoteWithWO!.workOrder!.id,
        type: "PHOTO",
        fileName: "test-photo.jpg",
        fileUrl: "/test/photo.jpg",
        fileSize: 1024,
        uploadedBy: "test-user",
      },
    });
    console.log(`✅ Attachement ajouté\n`);

    // 6. Vérifier conditions de clôture
    console.log("📝 Étape 6: Vérification des conditions de clôture");
    const validation = await canCloseWorkOrder(quoteWithWO!.workOrder!.id);
    console.log(`   Peut être clôturé: ${validation.canClose ? "✅ OUI" : "❌ NON"}`);
    if (!validation.canClose) {
      console.log(`   Raisons: ${validation.reasons.join(", ")}\n`);
      return;
    }
    console.log(`✅ Toutes les conditions sont remplies\n`);

    // 7. Clôturer le WorkOrder
    console.log("📝 Étape 7: Clôture du WorkOrder");
    await prisma.workOrder.update({
      where: { id: quoteWithWO!.workOrder!.id },
      data: {
        status: "CLOTURE",
        closedAt: new Date(),
        closedBy: "test-user",
      },
    });
    console.log(`✅ WorkOrder clôturé\n`);

    // 8. Vérifier P3 balance APRÈS clôture
    console.log("📝 Étape 8: Vérification P3 balance (APRÈS clôture)");
    const afterClosure = await prisma.quote.count({
      where: {
        contractId: contract.id,
        id: quote.id,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
        OR: [
          { workOrder: { status: "CLOTURE" } },
          { workOrder: null },
        ],
      },
    });
    console.log(`   Devis compté dans P3: ${afterClosure === 1 ? "✅ OUI" : "❌ NON"}`);
    if (afterClosure === 1) {
      console.log(`   ✅ Correct: Le devis EST maintenant compté (WorkOrder clôturé)\n`);
    } else {
      console.log(`   ❌ Erreur: Le devis n'est pas compté alors qu'il devrait l'être\n`);
    }

    // 9. Résumé
    console.log("=" . repeat(60));
    console.log("📊 RÉSUMÉ DU TEST");
    console.log("=" . repeat(60));
    console.log(`Devis: ${quote.reference} (${quote.amountHT}€ HT)`);
    console.log(`WorkOrder: ${quoteWithWO!.workOrder!.id}`);
    console.log(`Status final: CLOTURE`);
    console.log(`Avant clôture: ${beforeClosure === 0 ? "✅ NON compté" : "❌ Compté"}`);
    console.log(`Après clôture: ${afterClosure === 1 ? "✅ Compté" : "❌ NON compté"}`);

    if (beforeClosure === 0 && afterClosure === 1) {
      console.log(`\n✅ TEST RÉUSSI : Le workflow complet fonctionne correctement !`);
      console.log(`   - Les devis avec WorkOrder non clôturé ne sont pas comptés dans P3`);
      console.log(`   - Les devis avec WorkOrder clôturé sont comptés dans P3`);
    } else {
      console.log(`\n❌ TEST ÉCHOUÉ : La logique P3 balance ne fonctionne pas correctement`);
    }

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
