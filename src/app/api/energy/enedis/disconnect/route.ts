import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// DELETE /api/energy/enedis/disconnect - Disconnect Enedis account
export async function DELETE() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour déconnecter Enedis" },
        { status: 403 }
      );
    }

    await prisma.energyProvider.updateMany({
      where: {
        organizationId: effectiveOrgId,
        provider: "ENEDIS",
      },
      data: {
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isConnected: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Déconnexion Enedis effectuée",
    });
  } catch (error) {
    console.error("Error disconnecting Enedis:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion Enedis" },
      { status: 500 }
    );
  }
}
