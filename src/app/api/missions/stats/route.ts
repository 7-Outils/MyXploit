import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/missions/stats - Stats agregees pour le dashboard ADMIN
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    // Missions actives par type
    const activeMissionsByType = await prisma.mission.groupBy({
      by: ["missionTypeId"],
      where: {
        organizationId: effectiveOrgId,
        status: "ACTIVE",
      },
      _count: true,
    });

    // Recuperer les noms des types
    const typeIds = activeMissionsByType.map((m) => m.missionTypeId);
    const types = await prisma.missionType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });
    const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));

    // CA par statut
    const caByStatus = await prisma.mission.groupBy({
      by: ["status"],
      where: {
        organizationId: effectiveOrgId,
        amountHT: { not: null },
      },
      _sum: { amountHT: true },
      _count: true,
    });

    // Livrables ce mois-ci
    const deliverablesThisMonth = await prisma.deliverable.findMany({
      where: {
        mission: { organizationId: effectiveOrgId },
        dueDate: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { id: true, status: true, dueDate: true },
    });

    // Livrables en retard (tout l'org)
    const overdueDeliverables = await prisma.deliverable.findMany({
      where: {
        mission: { organizationId: effectiveOrgId, status: "ACTIVE" },
        dueDate: { lt: now },
        status: { in: ["A_FAIRE", "EN_COURS"] },
      },
      include: {
        mission: {
          select: { id: true, title: true, reference: true, client: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    });

    // Missions arrivant a echeance (renouvellements)
    const expiringMissions = await prisma.mission.findMany({
      where: {
        organizationId: effectiveOrgId,
        status: "ACTIVE",
        endDate: { gte: now, lte: sixMonthsFromNow },
      },
      include: {
        client: { select: { name: true } },
        missionType: { select: { name: true } },
      },
      orderBy: { endDate: "asc" },
      take: 10,
    });

    // Pipeline (missions PROSPECT)
    const pipeline = await prisma.mission.findMany({
      where: {
        organizationId: effectiveOrgId,
        status: "PROSPECT",
      },
      include: {
        client: { select: { name: true } },
        missionType: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const pipelineTotal = pipeline.reduce((sum, m) => sum + (m.amountHT || 0), 0);

    // Charge par ingenieur
    const engineers = await prisma.user.findMany({
      where: {
        organizationId: effectiveOrgId,
        role: { in: ["EDITOR", "ADMIN"] },
        password: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        missionAssignments: {
          where: { mission: { status: "ACTIVE" } },
          select: {
            mission: {
              select: {
                id: true,
                deliverables: {
                  where: { status: { in: ["A_FAIRE", "EN_COURS"] } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    const engineerWorkload = engineers.map((eng) => ({
      id: eng.id,
      firstName: eng.firstName,
      lastName: eng.lastName,
      email: eng.email,
      activeMissions: eng.missionAssignments.length,
      pendingDeliverables: eng.missionAssignments.reduce(
        (sum, a) => sum + a.mission.deliverables.length,
        0
      ),
    }));

    // Totaux
    const totalActiveMissions = activeMissionsByType.reduce((sum, m) => sum + m._count, 0);
    const caActive = caByStatus.find((c) => c.status === "ACTIVE")?._sum.amountHT || 0;
    const caTerminee = caByStatus.find((c) => c.status === "TERMINEE")?._sum.amountHT || 0;

    return NextResponse.json({
      activeMissions: {
        total: totalActiveMissions,
        byType: activeMissionsByType.map((m) => ({
          type: typeMap[m.missionTypeId] || "Inconnu",
          count: m._count,
        })),
      },
      ca: {
        active: caActive,
        terminated: caTerminee,
        pipeline: pipelineTotal,
      },
      deliverablesThisMonth: {
        total: deliverablesThisMonth.length,
        aFaire: deliverablesThisMonth.filter((d) => d.status === "A_FAIRE").length,
        enCours: deliverablesThisMonth.filter((d) => d.status === "EN_COURS").length,
        produit: deliverablesThisMonth.filter((d) => d.status === "PRODUIT").length,
        transmis: deliverablesThisMonth.filter((d) => d.status === "TRANSMIS").length,
      },
      overdueDeliverables,
      expiringMissions,
      pipeline: {
        missions: pipeline,
        totalAmount: pipelineTotal,
      },
      engineerWorkload,
    });
  } catch (error) {
    console.error("Error fetching mission stats:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des stats" },
      { status: 500 }
    );
  }
}
