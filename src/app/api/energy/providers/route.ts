import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/energy/providers - List energy providers status
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const providers = await prisma.energyProvider.findMany({
      where: {
        organizationId: effectiveOrgId,
      },
      select: {
        id: true,
        provider: true,
        isConnected: true,
        lastSyncAt: true,
        lastError: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return status for both providers (even if not configured)
    const grdf = providers.find((p) => p.provider === "GRDF");
    const enedis = providers.find((p) => p.provider === "ENEDIS");

    return NextResponse.json({
      grdf: grdf
        ? {
            isConnected: grdf.isConnected,
            lastSyncAt: grdf.lastSyncAt,
            lastError: grdf.lastError,
            tokenExpiresAt: grdf.tokenExpiresAt,
          }
        : {
            isConnected: false,
            lastSyncAt: null,
            lastError: null,
            tokenExpiresAt: null,
          },
      enedis: enedis
        ? {
            isConnected: enedis.isConnected,
            lastSyncAt: enedis.lastSyncAt,
            lastError: enedis.lastError,
            tokenExpiresAt: enedis.tokenExpiresAt,
          }
        : {
            isConnected: false,
            lastSyncAt: null,
            lastError: null,
            tokenExpiresAt: null,
          },
    });
  } catch (error) {
    console.error("Error fetching energy providers:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des fournisseurs" },
      { status: 500 }
    );
  }
}
