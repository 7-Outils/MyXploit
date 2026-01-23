import prisma from "./prisma";
import { QuoteStatus } from "../generated/prisma/client";

/**
 * Hook appelé quand le statut d'un devis change
 * Auto-crée un WorkOrder quand un devis est accepté (pour P3/P5)
 */
export async function handleQuoteStatusChange(
  quoteId: string,
  newStatus: QuoteStatus
) {
  // Créer WorkOrder uniquement quand devis accepté ou commandé
  if (newStatus !== "ACCEPTE" && newStatus !== "COMMANDE") {
    return;
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { workOrder: true },
  });

  if (!quote) {
    console.error(`Quote ${quoteId} introuvable`);
    return;
  }

  // Créer WorkOrder uniquement pour les devis P3 et P5
  if (!quote.quoteType || (quote.quoteType !== "P3" && quote.quoteType !== "P5")) {
    console.log(
      `Quote ${quote.reference}: Type ${quote.quoteType} ne nécessite pas de suivi des travaux`
    );
    return;
  }

  // Ne pas dupliquer si WorkOrder existe déjà
  if (quote.workOrder) {
    console.log(
      `Quote ${quote.reference}: WorkOrder ${quote.workOrder.id} existe déjà`
    );
    return;
  }

  // Créer le WorkOrder
  const workOrder = await prisma.workOrder.create({
    data: {
      quoteId: quote.id,
      status: "PLANIFIE",
      planifiedDate: new Date(),
    },
  });

  // Créer l'événement initial dans l'historique
  await prisma.workEvent.create({
    data: {
      workOrderId: workOrder.id,
      eventType: "STATUS_CHANGE",
      oldValue: null,
      newValue: "PLANIFIE",
      performedBy: "system",
      notes: `WorkOrder créé automatiquement lors de l'acceptation du devis ${quote.reference}`,
    },
  });

  console.log(
    `✅ WorkOrder ${workOrder.id} créé pour devis ${quote.reference} (${quote.quoteType})`
  );

  return workOrder;
}

/**
 * Créer un WorkOrder manuellement (par un utilisateur)
 */
export async function createWorkOrderManually(
  quoteId: string,
  userId: string
) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { workOrder: true },
  });

  if (!quote) {
    throw new Error("Devis introuvable");
  }

  if (quote.workOrder) {
    throw new Error("Un WorkOrder existe déjà pour ce devis");
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      quoteId: quote.id,
      status: "PLANIFIE",
      planifiedDate: new Date(),
    },
  });

  await prisma.workEvent.create({
    data: {
      workOrderId: workOrder.id,
      eventType: "STATUS_CHANGE",
      oldValue: null,
      newValue: "PLANIFIE",
      performedBy: userId,
      notes: `WorkOrder créé manuellement`,
    },
  });

  return workOrder;
}
