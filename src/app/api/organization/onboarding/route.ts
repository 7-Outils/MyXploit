import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const orgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { onboardingCompleted: true, name: true },
    });

    const membersCount = await prisma.user.count({
      where: { organizationId: orgId, role: { not: "SUPER_ADMIN" }, id: { not: user.id } },
    });

    const sitesCount = await prisma.site.count({
      where: { organizationId: orgId },
    });

    const missionTypesCount = await prisma.missionType.count({
      where: { organizationId: orgId },
    });

    return NextResponse.json({
      onboardingCompleted: org?.onboardingCompleted ?? false,
      organizationName: org?.name || "",
      missionTypesConfigured: missionTypesCount > 0,
      membersInvited: membersCount,
      sitesCreated: sitesCount,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Non authentifié") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
