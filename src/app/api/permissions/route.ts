import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getGhostSession } from "@/lib/auth";

// GET /api/permissions - Récupérer les permissions de l'utilisateur connecté
export async function GET() {
  try {
    const user = await requireAuth();

    // Vérifier si l'utilisateur est en mode fantôme (SUPER_ADMIN uniquement)
    let isGhostMode = false;
    let ghostOrgId: string | null = null;
    let ghostOrgName: string | null = null;
    let effectiveOrgId = user.organizationId;

    if (user.role === "SUPER_ADMIN") {
      const ghostSession = await getGhostSession(user.id);

      if (ghostSession) {
        isGhostMode = true;
        ghostOrgId = ghostSession.targetOrganizationId;
        ghostOrgName = ghostSession.targetOrganization.name;
        effectiveOrgId = ghostSession.targetOrganizationId;
      }
    }

    // Récupérer les modules activés pour l'organisation effective
    const orgModules = await prisma.organizationModule.findMany({
      where: {
        organizationId: effectiveOrgId,
        isEnabled: true,
      },
      select: { module: true },
    });

    const enabledModules = orgModules.map((m) => m.module);

    // Vérifier si l'utilisateur a un portefeuille (assignations contrats)
    let hasPortfolio = false;
    let assignedContractCount = 0;
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      assignedContractCount = await prisma.userContractAssignment.count({
        where: { userId: user.id, organizationId: effectiveOrgId },
      });
      hasPortfolio = assignedContractCount > 0;
    }

    return NextResponse.json({
      role: user.role,
      organizationId: effectiveOrgId,
      effectiveOrganizationId: effectiveOrgId,
      enabledModules,
      isGhostMode,
      ghostOrgId,
      ghostOrgName,
      hasPortfolio,
      assignedContractCount,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des permissions" },
      { status: 500 }
    );
  }
}
