import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { createWorkOrderManually } from "@/lib/work-order-hooks";

/**
 * GET /api/work-orders
 * Liste tous les WorkOrders de l'organisation avec filtres optionnels
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    // Récupérer les paramètres de filtrage
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const status = searchParams.get("status");
    const siteId = searchParams.get("siteId");

    // Construire les filtres
    const where: any = {
      quote: {
        organizationId: effectiveOrgId,
      },
    };

    if (contractId) {
      where.quote.contractId = contractId;
    }

    if (status) {
      where.status = status;
    }

    if (siteId) {
      where.quote.siteId = siteId;
    }

    // Récupérer les WorkOrders
    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        quote: {
          select: {
            id: true,
            reference: true,
            title: true,
            amountHT: true,
            amountTTC: true,
            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachements: {
          select: {
            id: true,
          },
        },
        reservations: {
          select: {
            id: true,
            isResolved: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculer les métriques pour chaque WorkOrder
    const workOrdersWithMetrics = workOrders.map((wo) => ({
      id: wo.id,
      status: wo.status,
      quote: wo.quote,
      planifiedDate: wo.planifiedDate,
      startDate: wo.startDate,
      completionDate: wo.completionDate,
      closedAt: wo.closedAt,
      closedBy: wo.closedBy,
      attachementCount: wo.attachements.length,
      reservationCount: wo.reservations.length,
      unresolvedReservationCount: wo.reservations.filter((r) => !r.isResolved)
        .length,
      canBeClosed:
        wo.status === "TERMINE" &&
        wo.attachements.length > 0 &&
        wo.reservations.every((r) => r.isResolved),
    }));

    return NextResponse.json({ workOrders: workOrdersWithMetrics });
  } catch (error) {
    console.error("GET /api/work-orders error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des WorkOrders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders
 * Créer un WorkOrder manuellement
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Seuls EDITOR, ADMIN et SUPER_ADMIN peuvent créer des WorkOrders
    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permission refusée" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { quoteId } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId est requis" },
        { status: 400 }
      );
    }

    // Vérifier que le devis appartient à l'organisation de l'utilisateur
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        organizationId: effectiveOrgId,
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Devis introuvable" },
        { status: 404 }
      );
    }

    // Créer le WorkOrder
    const workOrder = await createWorkOrderManually(quoteId, user.id);

    // Récupérer le WorkOrder complet avec relations
    const fullWorkOrder = await prisma.workOrder.findUnique({
      where: { id: workOrder.id },
      include: {
        quote: {
          include: {
            site: true,
          },
        },
        attachements: true,
        reservations: true,
      },
    });

    return NextResponse.json({ workOrder: fullWorkOrder }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/work-orders error:", error);

    if (error.message === "Un WorkOrder existe déjà pour ce devis") {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Erreur lors de la création du WorkOrder" },
      { status: 500 }
    );
  }
}
