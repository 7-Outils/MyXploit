import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/permissions - Récupérer les permissions de l'utilisateur connecté
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    // Vérifier si l'utilisateur est en mode fantôme (SUPER_ADMIN uniquement)
    let isGhostMode = false;
    let ghostOrgId: string | null = null;
    let ghostOrgName: string | null = null;
    let effectiveOrgId = user.organizationId;

    if (user.role === "SUPER_ADMIN") {
      const ghostSession = await prisma.ghostSession.findFirst({
        where: {
          superAdminId: user.id,
          expiresAt: { gt: new Date() },
        },
        include: {
          targetOrganization: { select: { id: true, name: true } },
        },
      });

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

    return NextResponse.json({
      role: user.role,
      organizationId: effectiveOrgId,
      effectiveOrganizationId: effectiveOrgId,
      enabledModules,
      isGhostMode,
      ghostOrgId,
      ghostOrgName,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des permissions" },
      { status: 500 }
    );
  }
}
