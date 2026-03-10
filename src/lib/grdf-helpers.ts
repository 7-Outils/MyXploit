import prisma from "@/lib/prisma";
import { getGRDFAccessToken, GRDFEnvironment } from "@/lib/grdf";

/**
 * Parse le refreshToken stocké en DB pour extraire env + credentials
 * Format: "environment|clientId|clientSecret" (nouveau)
 *      ou "clientId:clientSecret" (ancien, fallback prod)
 */
export function parseCredentials(refreshToken: string): {
  environment: GRDFEnvironment;
  clientId: string;
  clientSecret: string;
} {
  if (refreshToken.includes("|")) {
    const [environment, clientId, ...rest] = refreshToken.split("|");
    return {
      environment: environment as GRDFEnvironment,
      clientId,
      clientSecret: rest.join("|"),
    };
  }
  const [clientId, ...rest] = refreshToken.split(":");
  return {
    environment: "production",
    clientId,
    clientSecret: rest.join(":"),
  };
}

/**
 * Récupère le provider GRDF et un access token frais
 * Retourne null si GRDF n'est pas connecté
 */
export async function getGRDFProviderAndToken(organizationId: string): Promise<{
  provider: { id: string };
  accessToken: string;
  environment: GRDFEnvironment;
  clientId: string;
  clientSecret: string;
} | null> {
  const provider = await prisma.energyProvider.findUnique({
    where: {
      organizationId_provider: {
        organizationId,
        provider: "GRDF",
      },
    },
  });

  if (!provider || !provider.isConnected || !provider.refreshToken) {
    return null;
  }

  const { environment, clientId, clientSecret } = parseCredentials(provider.refreshToken);

  if (!clientId || !clientSecret) {
    return null;
  }

  const tokenResponse = await getGRDFAccessToken({
    clientId,
    clientSecret,
    environment,
  });

  // Update token in DB
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
  await prisma.energyProvider.update({
    where: { id: provider.id },
    data: {
      accessToken: tokenResponse.access_token,
      tokenExpiresAt: expiresAt,
    },
  });

  return {
    provider: { id: provider.id },
    accessToken: tokenResponse.access_token,
    environment,
    clientId,
    clientSecret,
  };
}
