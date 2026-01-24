import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/admin/migrate-workorders
 * Créer des WorkOrders pour tous les devis P3/P5 déjà acceptés
 * Endpoint admin uniquement
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Seuls les SUPER_ADMIN peuvent exécuter cette migration
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Permission refusée - SUPER_ADMIN requis" },
        { status: 403 }
      );
    }

    console.log("🔍 Recherche des devis P3/P5 acceptés sans WorkOrder...");

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

    console.log(`📊 Trouvé ${quotesWithoutWorkOrder.length} devis sans WorkOrder`);

    if (quotesWithoutWorkOrder.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucune migration nécessaire - tous les devis ont déjà un WorkOrder",
        migrated: 0,
        errors: 0,
      });
    }

    // Créer les WorkOrders
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

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
            closedBy: quote.acceptedBy || user.id,
          },
        });

        // Créer l'événement dans l'historique
        await prisma.workEvent.create({
          data: {
            workOrderId: workOrder.id,
            eventType: "CLOSED",
            oldValue: null,
            newValue: "CLOTURE",
            performedBy: user.id,
            notes: `WorkOrder créé par migration automatique pour devis ${quote.reference} déjà accepté`,
          },
        });

        console.log(`✅ WorkOrder créé pour ${quote.reference}`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Erreur pour ${quote.reference}:`, error);
        errorCount++;
        errors.push({
          quoteId: quote.id,
          reference: quote.reference,
          error: error.message,
        });
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Migration terminée`);
    console.log(`   Succès: ${successCount}`);
    console.log(`   Erreurs: ${errorCount}`);
    console.log(`   Total: ${quotesWithoutWorkOrder.length}`);
    console.log("=".repeat(60) + "\n");

    return NextResponse.json({
      success: true,
      message: "Migration terminée",
      total: quotesWithoutWorkOrder.length,
      migrated: successCount,
      errors: errorCount,
      errorDetails: errors,
    });
  } catch (error) {
    console.error("💥 Erreur lors de la migration:", error);
    return NextResponse.json(
      { error: "Erreur lors de la migration" },
      { status: 500 }
    );
  }
}
