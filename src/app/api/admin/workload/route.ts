import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/admin/workload - Données charge de travail par ingénieur
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    // Récupérer les utilisateurs EDITOR/READER de l'org
    const engineers = await prisma.user.findMany({
      where: {
        organizationId: effectiveOrgId,
        role: { in: ["EDITOR", "MANAGER", "READER"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    // Récupérer toutes les assignations
    const allAssignments = await prisma.userContractAssignment.findMany({
      where: { organizationId: effectiveOrgId },
      include: {
        contract: {
          select: {
            id: true,
            _count: { select: { contractSites: true } },
          },
        },
      },
    });

    // Compter les réunions à venir (dans les 30 prochains jours)
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Récupérer les sites assignés par utilisateur
    const assignmentsByUser = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      const list = assignmentsByUser.get(a.userId) || [];
      list.push(a);
      assignmentsByUser.set(a.userId, list);
    }

    // Pour chaque ingénieur, calculer les métriques
    const workload = await Promise.all(
      engineers.map(async (eng) => {
        const userAssignments = assignmentsByUser.get(eng.id) || [];
        const contractIds = userAssignments.map((a) => a.contractId);
        const siteCount = userAssignments.reduce(
          (sum, a) => sum + (a.contract._count.contractSites || 0),
          0
        );

        // Réunions à venir sur les contrats assignés
        let upcomingMeetings = 0;
        // Alertes actives sur les sites des contrats assignés
        let activeAlerts = 0;

        if (contractIds.length > 0) {
          // Récupérer les siteIds des contrats assignés
          const contractSites = await prisma.contractSite.findMany({
            where: { contractId: { in: contractIds } },
            select: { siteId: true },
            distinct: ["siteId"],
          });
          const siteIds = contractSites.map((cs) => cs.siteId);

          [upcomingMeetings, activeAlerts] = await Promise.all([
            prisma.meeting.count({
              where: {
                organizationId: effectiveOrgId,
                contractId: { in: contractIds },
                date: { gte: now, lte: in30Days },
              },
            }),
            siteIds.length > 0
              ? prisma.alert.count({
                  where: {
                    organizationId: effectiveOrgId,
                    siteId: { in: siteIds },
                    isRead: false,
                  },
                })
              : 0,
          ]);
        }

        return {
          id: eng.id,
          firstName: eng.firstName,
          lastName: eng.lastName,
          email: eng.email,
          role: eng.role,
          contractCount: contractIds.length,
          siteCount,
          upcomingMeetings,
          activeAlerts,
        };
      })
    );

    return NextResponse.json(workload);
  } catch (error) {
    console.error("Error fetching workload:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
