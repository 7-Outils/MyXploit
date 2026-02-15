import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const orgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    await prisma.organization.update({
      where: { id: orgId },
      data: { onboardingCompleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Non authentifié") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
