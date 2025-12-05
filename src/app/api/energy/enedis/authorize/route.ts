import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getEnedisAuthorizationUrl } from "@/lib/enedis";
import { randomBytes } from "crypto";

// GET /api/energy/enedis/authorize - Get Enedis authorization URL
export async function GET() {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour configurer Enedis" },
        { status: 403 }
      );
    }

    const clientId = process.env.ENEDIS_CLIENT_ID;
    const redirectUri = process.env.ENEDIS_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Configuration Enedis manquante (ENEDIS_CLIENT_ID, ENEDIS_REDIRECT_URI)" },
        { status: 500 }
      );
    }

    // Generate state token (includes organization ID for callback)
    const stateData = {
      organizationId: user.organizationId,
      nonce: randomBytes(16).toString("hex"),
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

    const authUrl = getEnedisAuthorizationUrl(
      {
        clientId,
        clientSecret: "", // Not needed for auth URL
        redirectUri,
      },
      state,
      "P6M" // 6 months consent
    );

    return NextResponse.json({
      authorizationUrl: authUrl,
      state,
    });
  } catch (error) {
    console.error("Error generating Enedis auth URL:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'URL Enedis" },
      { status: 500 }
    );
  }
}
