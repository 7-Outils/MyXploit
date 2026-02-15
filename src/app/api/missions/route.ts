import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/missions - Liste des missions
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const missionTypeId = searchParams.get("missionTypeId");
    const clientId = searchParams.get("clientId");

    // EDITOR ne voit que ses missions assignees
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
    };

    if (status) {
      where.status = status;
    }
    if (missionTypeId) {
      where.missionTypeId = missionTypeId;
    }
    if (clientId) {
      where.clientId = clientId;
    }

    if (!isAdmin) {
      where.engineers = {
        some: { userId: user.id },
      };
    }

    const missions = await prisma.mission.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        missionType: { select: { id: true, name: true } },
        engineers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        deliverables: {
          select: { id: true, status: true, dueDate: true },
        },
        _count: {
          select: { sites: true, contracts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrichir avec stats livrables
    const now = new Date();
    const result = missions.map((m) => {
      const totalDeliverables = m.deliverables.length;
      const overdueDeliverables = m.deliverables.filter(
        (d) => d.dueDate && d.dueDate < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT"
      ).length;
      const completedDeliverables = m.deliverables.filter(
        (d) => d.status === "PRODUIT" || d.status === "TRANSMIS"
      ).length;

      const { deliverables: _deliverables, ...rest } = m;
      return {
        ...rest,
        deliverableStats: {
          total: totalDeliverables,
          completed: completedDeliverables,
          overdue: overdueDeliverables,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching missions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des missions" },
      { status: 500 }
    );
  }
}

// POST /api/missions - Creer une mission
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut creer des missions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      missionTypeId,
      clientId,
      startDate,
      endDate,
      amountHT,
      billingModality,
      status,
      engineerIds,
      siteIds,
      contractIds,
    } = body;

    if (!title || !missionTypeId || !clientId) {
      return NextResponse.json(
        { error: "Le titre, le type de mission et le client sont requis" },
        { status: 400 }
      );
    }

    // Generer la reference : MIS-YYYY-NNNN
    const year = new Date().getFullYear();
    const lastMission = await prisma.mission.findFirst({
      where: {
        organizationId: effectiveOrgId,
        reference: { startsWith: `MIS-${year}-` },
      },
      orderBy: { reference: "desc" },
      select: { reference: true },
    });

    let seq = 1;
    if (lastMission) {
      const parts = lastMission.reference.split("-");
      seq = parseInt(parts[2], 10) + 1;
    }
    const reference = `MIS-${year}-${String(seq).padStart(4, "0")}`;

    const mission = await prisma.mission.create({
      data: {
        reference,
        title,
        description: description || null,
        status: status || "ACTIVE",
        missionTypeId,
        clientId,
        organizationId: effectiveOrgId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        amountHT: amountHT ? parseFloat(amountHT) : null,
        billingModality: billingModality || null,
        // Creer les assignations ingenieurs
        ...(engineerIds?.length && {
          engineers: {
            create: engineerIds.map((userId: string) => ({ userId })),
          },
        }),
        // Rattacher les sites
        ...(siteIds?.length && {
          sites: {
            create: siteIds.map((siteId: string) => ({ siteId })),
          },
        }),
        // Rattacher les contrats
        ...(contractIds?.length && {
          contracts: {
            create: contractIds.map((contractId: string) => ({ contractId })),
          },
        }),
      },
      include: {
        client: { select: { id: true, name: true } },
        missionType: { select: { id: true, name: true } },
        engineers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { deliverables: true, sites: true, contracts: true } },
      },
    });

    return NextResponse.json(mission, { status: 201 });
  } catch (error) {
    console.error("Error creating mission:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation de la mission" },
      { status: 500 }
    );
  }
}
