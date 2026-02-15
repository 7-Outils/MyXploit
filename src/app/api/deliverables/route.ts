import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/deliverables - Vue croisee de tous les livrables (page Rapports)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const missionId = searchParams.get("missionId");
    const clientId = searchParams.get("clientId");

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const now = new Date();

    const where: Record<string, unknown> = {
      mission: {
        organizationId: effectiveOrgId,
        ...(missionId && { id: missionId }),
        ...(clientId && { clientId }),
        // EDITOR ne voit que ses missions
        ...(!isAdmin && {
          engineers: { some: { userId: user.id } },
        }),
      },
    };

    // Filtre statut special "EN_RETARD"
    if (status === "EN_RETARD") {
      where.dueDate = { lt: now };
      where.status = { in: ["A_FAIRE", "EN_COURS"] };
    } else if (status) {
      where.status = status;
    }

    const deliverables = await prisma.deliverable.findMany({
      where,
      include: {
        mission: {
          select: {
            id: true,
            reference: true,
            title: true,
            client: { select: { id: true, name: true } },
            engineers: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Stats agregees
    const allDeliverables = await prisma.deliverable.findMany({
      where: {
        mission: {
          organizationId: effectiveOrgId,
          ...(!isAdmin && { engineers: { some: { userId: user.id } } }),
        },
      },
      select: { status: true, dueDate: true },
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const stats = {
      total: allDeliverables.length,
      aFaire: allDeliverables.filter((d) => d.status === "A_FAIRE").length,
      enCours: allDeliverables.filter((d) => d.status === "EN_COURS").length,
      produit: allDeliverables.filter((d) => d.status === "PRODUIT").length,
      transmis: allDeliverables.filter((d) => d.status === "TRANSMIS").length,
      enRetard: allDeliverables.filter(
        (d) => d.dueDate && d.dueDate < now && (d.status === "A_FAIRE" || d.status === "EN_COURS")
      ).length,
      produitCeMois: allDeliverables.filter(
        (d) => d.status === "PRODUIT" && d.dueDate && d.dueDate >= startOfMonth && d.dueDate <= endOfMonth
      ).length,
    };

    return NextResponse.json({ deliverables, stats });
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des livrables" },
      { status: 500 }
    );
  }
}
