import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { exchangeEnedisCodeForToken } from "@/lib/enedis";
import { encryptSecret } from "@/lib/crypto";

// GET /api/energy/enedis/callback - OAuth callback from Enedis
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle error from Enedis
    if (error) {
      console.error("Enedis OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(`/energy?enedis_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/energy?enedis_error=Code ou state manquant", request.url)
      );
    }

    // Decode state to get organization ID
    let stateData: { organizationId: string; nonce: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    } catch {
      return NextResponse.redirect(
        new URL("/energy?enedis_error=State invalide", request.url)
      );
    }

    // Verify state is not too old (15 minutes max)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return NextResponse.redirect(
        new URL("/energy?enedis_error=Session expirée, veuillez réessayer", request.url)
      );
    }

    const { organizationId } = stateData;

    // Get Enedis config from environment
    const clientId = process.env.ENEDIS_CLIENT_ID;
    const clientSecret = process.env.ENEDIS_CLIENT_SECRET;
    const redirectUri = process.env.ENEDIS_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL("/energy?enedis_error=Configuration Enedis manquante", request.url)
      );
    }

    // Exchange code for token
    const tokenResponse = await exchangeEnedisCodeForToken(code, {
      clientId,
      clientSecret,
      redirectUri,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Upsert the provider configuration
    await prisma.energyProvider.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: "ENEDIS",
        },
      },
      update: {
        accessToken: encryptSecret(tokenResponse.access_token),
        refreshToken: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        isConnected: true,
        lastError: null,
        updatedAt: new Date(),
      },
      create: {
        organizationId,
        provider: "ENEDIS",
        accessToken: encryptSecret(tokenResponse.access_token),
        refreshToken: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        tokenExpiresAt: expiresAt,
        isConnected: true,
      },
    });

    // Redirect back to energy page with success message
    return NextResponse.redirect(
      new URL("/energy?enedis_success=true", request.url)
    );
  } catch (error) {
    console.error("Error in Enedis callback:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.redirect(
      new URL(`/energy?enedis_error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
