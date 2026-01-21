import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { testGRDFConnection, getGRDFAccessToken } from "@/lib/grdf";

// POST /api/energy/grdf/connect - Connect GRDF account
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour configurer GRDF" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clientId, clientSecret } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID et Client Secret requis" },
        { status: 400 }
      );
    }

    // Test the connection
    const testResult = await testGRDFConnection({
      clientId,
      clientSecret,
    });

    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || "Échec de la connexion GRDF" },
        { status: 400 }
      );
    }

    // Get a real token to store
    const tokenResponse = await getGRDFAccessToken({
      clientId,
      clientSecret,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Upsert the provider configuration
    // Note: In production, encrypt the tokens before storing
    const provider = await prisma.energyProvider.upsert({
      where: {
        organizationId_provider: {
          organizationId: effectiveOrgId,
          provider: "GRDF",
        },
      },
      update: {
        accessToken: tokenResponse.access_token,
        refreshToken: `${clientId}:${clientSecret}`, // Store credentials for refresh
        tokenExpiresAt: expiresAt,
        isConnected: true,
        lastError: null,
        updatedAt: new Date(),
      },
      create: {
        organizationId: effectiveOrgId,
        provider: "GRDF",
        accessToken: tokenResponse.access_token,
        refreshToken: `${clientId}:${clientSecret}`,
        tokenExpiresAt: expiresAt,
        isConnected: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Connexion GRDF établie avec succès",
      expiresAt: provider.tokenExpiresAt,
    });
  } catch (error) {
    console.error("Error connecting GRDF:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion GRDF" },
      { status: 500 }
    );
  }
}

// DELETE /api/energy/grdf/connect - Disconnect GRDF account
export async function DELETE() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour déconnecter GRDF" },
        { status: 403 }
      );
    }

    await prisma.energyProvider.updateMany({
      where: {
        organizationId: effectiveOrgId,
        provider: "GRDF",
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
      message: "Déconnexion GRDF effectuée",
    });
  } catch (error) {
    console.error("Error disconnecting GRDF:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion GRDF" },
      { status: 500 }
    );
  }
}
