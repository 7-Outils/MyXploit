import prisma from "./prisma";

export interface ValidationResult {
  canClose: boolean;
  reasons: string[];
}

/**
 * Vérifie si un WorkOrder peut être clôturé
 *
 * Conditions requises :
 * 1. Status = TERMINE
 * 2. Au moins 1 attachement uploadé
 * 3. Toutes les réserves résolues (ou aucune réserve)
 */
export async function canCloseWorkOrder(
  workOrderId: string
): Promise<ValidationResult> {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      attachements: true,
      reservations: true,
    },
  });

  if (!workOrder) {
    return {
      canClose: false,
      reasons: ["WorkOrder introuvable"],
    };
  }

  const reasons: string[] = [];

  // Vérifier que les travaux sont terminés
  if (workOrder.status !== "TERMINE") {
    reasons.push("Les travaux doivent être terminés (status=TERMINE)");
  }

  // Vérifier qu'il y a au moins un attachement
  if (workOrder.attachements.length === 0) {
    reasons.push("Au moins un attachement est requis (photo, document, etc.)");
  }

  // Vérifier que toutes les réserves sont résolues
  const unresolvedReservations = workOrder.reservations.filter(
    (r) => !r.isResolved
  );
  if (unresolvedReservations.length > 0) {
    reasons.push(
      `${unresolvedReservations.length} réservation(s) non résolue(s). Toutes les réserves doivent être levées avant clôture.`
    );
  }

  return {
    canClose: reasons.length === 0,
    reasons,
  };
}

/**
 * Valide les données avant de créer/modifier un WorkOrder
 */
export async function validateWorkOrderData(data: {
  startDate?: Date | null;
  completionDate?: Date | null;
  planifiedDate?: Date | null;
}): Promise<ValidationResult> {
  const reasons: string[] = [];

  // Vérifier la cohérence des dates
  if (data.startDate && data.planifiedDate) {
    if (data.startDate < data.planifiedDate) {
      reasons.push(
        "La date de début ne peut pas être antérieure à la date planifiée"
      );
    }
  }

  if (data.completionDate && data.startDate) {
    if (data.completionDate < data.startDate) {
      reasons.push(
        "La date de fin ne peut pas être antérieure à la date de début"
      );
    }
  }

  return {
    canClose: reasons.length === 0,
    reasons,
  };
}

/**
 * Vérifie si un WorkOrder peut changer de statut
 */
export function canChangeStatus(
  currentStatus: string,
  newStatus: string
): ValidationResult {
  const validTransitions: Record<string, string[]> = {
    PLANIFIE: ["EN_COURS", "ANNULE"],
    EN_COURS: ["TERMINE", "ANNULE"],
    TERMINE: ["ATTENTE_ATTACHEMENT", "ATTENTE_LEVEE", "CLOTURE", "EN_COURS"],
    ATTENTE_ATTACHEMENT: ["ATTENTE_LEVEE", "CLOTURE"],
    ATTENTE_LEVEE: ["CLOTURE", "TERMINE"],
    CLOTURE: [], // Un WorkOrder clôturé ne peut plus changer de statut
    ANNULE: [], // Un WorkOrder annulé ne peut plus changer de statut
  };

  const allowedStatuses = validTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    return {
      canClose: false,
      reasons: [
        `Transition invalide : ${currentStatus} → ${newStatus}. Transitions autorisées : ${allowedStatuses.join(", ")}`,
      ],
    };
  }

  return {
    canClose: true,
    reasons: [],
  };
}
