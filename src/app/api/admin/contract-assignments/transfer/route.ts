import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// POST /api/admin/contract-assignments/transfer - Passation de portefeuille
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();
    const { fromUserId, toUserId } = body;

    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: "fromUserId et toUserId sont requis" }, { status: 400 });
    }

    if (fromUserId === toUserId) {
      return NextResponse.json({ error: "Les deux utilisateurs doivent être différents" }, { status: 400 });
    }

    // Vérifier que les deux utilisateurs appartiennent à l'organisation
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findFirst({ where: { id: fromUserId, organizationId: effectiveOrgId } }),
      prisma.user.findFirst({ where: { id: toUserId, organizationId: effectiveOrgId } }),
    ]);

    if (!fromUser) {
      return NextResponse.json({ error: "Utilisateur source non trouvé" }, { status: 404 });
    }
    if (!toUser) {
      return NextResponse.json({ error: "Utilisateur cible non trouvé" }, { status: 404 });
    }

    // Récupérer les assignations du source
    const sourceAssignments = await prisma.userContractAssignment.findMany({
      where: { userId: fromUserId, organizationId: effectiveOrgId },
      include: { contract: { select: { id: true, title: true } } },
    });

    if (sourceAssignments.length === 0) {
      return NextResponse.json({ error: "Aucune assignation à transférer" }, { status: 400 });
    }

    // Récupérer les assignations existantes du destinataire pour éviter les doublons
    const existingTargetAssignments = await prisma.userContractAssignment.findMany({
      where: { userId: toUserId, organizationId: effectiveOrgId },
      select: { contractId: true },
    });
    const existingContractIds = new Set(existingTargetAssignments.map((a) => a.contractId));

    // Transaction : supprimer source + créer cible + log d'activité
    const contractIdsToTransfer = sourceAssignments.map((a) => a.contractId);
    const newAssignments = contractIdsToTransfer.filter((id) => !existingContractIds.has(id));

    // Récupérer les sites des contrats transférés pour le log d'activité
    const affectedSites = await prisma.contractSite.findMany({
      where: { contractId: { in: contractIdsToTransfer } },
      select: { siteId: true },
      distinct: ["siteId"],
    });

    await prisma.$transaction([
      // Supprimer les assignations du source
      prisma.userContractAssignment.deleteMany({
        where: { userId: fromUserId, organizationId: effectiveOrgId },
      }),
      // Créer les assignations pour le destinataire (seulement les nouvelles)
      ...newAssignments.map((contractId) =>
        prisma.userContractAssignment.create({
          data: {
            userId: toUserId,
            contractId,
            organizationId: effectiveOrgId,
            assignedById: user.id,
          },
        })
      ),
      // Journaliser la passation sur chaque site affecté
      ...affectedSites.map((site) =>
        prisma.siteActivityLog.create({
          data: {
            siteId: site.siteId,
            userId: user.id,
            organizationId: effectiveOrgId,
            activityType: "ASSIGNATION",
            title: "Passation de portefeuille",
            description: `Transfert de ${fromUser.firstName || ""} ${fromUser.lastName || ""} vers ${toUser.firstName || ""} ${toUser.lastName || ""}`,
          },
        })
      ),
    ]);

    return NextResponse.json({
      transferred: contractIdsToTransfer.length,
      fromUser: `${fromUser.firstName || ""} ${fromUser.lastName || ""}`.trim(),
      toUser: `${toUser.firstName || ""} ${toUser.lastName || ""}`.trim(),
    });
  } catch (error) {
    console.error("Error transferring assignments:", error);
    return NextResponse.json({ error: "Erreur lors de la passation" }, { status: 500 });
  }
}
