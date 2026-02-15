import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/admin/contract-assignments - Liste des assignations
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
      user: { role: { not: "SUPER_ADMIN" } },
    };
    if (userId) where.userId = userId;

    const assignments = await prisma.userContractAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        contract: { select: { id: true, reference: true, title: true, provider: true, status: true, _count: { select: { contractSites: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des assignations" }, { status: 500 });
  }
}

// POST /api/admin/contract-assignments - Assigner des contrats à un utilisateur
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();
    const { userId, contractIds } = body;

    if (!userId || !contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json({ error: "userId et contractIds[] sont requis" }, { status: 400 });
    }

    // Vérifier que l'utilisateur appartient à l'organisation
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: effectiveOrgId },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Vérifier que les contrats appartiennent à l'organisation
    const contracts = await prisma.contract.findMany({
      where: { id: { in: contractIds }, organizationId: effectiveOrgId },
      select: { id: true },
    });
    const validContractIds = contracts.map((c) => c.id);

    if (validContractIds.length === 0) {
      return NextResponse.json({ error: "Aucun contrat valide" }, { status: 400 });
    }

    // Créer les assignations (ignorer les doublons)
    const results = await prisma.$transaction(
      validContractIds.map((contractId) =>
        prisma.userContractAssignment.upsert({
          where: { userId_contractId: { userId, contractId } },
          update: {},
          create: {
            userId,
            contractId,
            organizationId: effectiveOrgId,
            assignedById: user.id,
          },
        })
      )
    );

    return NextResponse.json({ created: results.length }, { status: 201 });
  } catch (error) {
    console.error("Error creating assignments:", error);
    return NextResponse.json({ error: "Erreur lors de la création des assignations" }, { status: 500 });
  }
}

// DELETE /api/admin/contract-assignments - Retirer une assignation
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();
    const { userId, contractId } = body;

    if (!userId || !contractId) {
      return NextResponse.json({ error: "userId et contractId sont requis" }, { status: 400 });
    }

    // Vérifier que l'assignation existe et appartient à l'organisation
    const assignment = await prisma.userContractAssignment.findFirst({
      where: { userId, contractId, organizationId: effectiveOrgId },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignation non trouvée" }, { status: 404 });
    }

    await prisma.userContractAssignment.delete({
      where: { id: assignment.id },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de l'assignation" }, { status: 500 });
  }
}
