/**
 * Provisionne / met à jour la connexion GRDF d'une organisation directement en DB.
 * Utile pour bootstrapper une org sans passer par l'UI.
 *
 * Variables d'env requises (.env.local) :
 *   GRDF_CLIENT_ID
 *   GRDF_CLIENT_SECRET
 *
 * Usage:
 *   npx tsx scripts/grdf-connect.ts --org=SAGE
 *   npx tsx scripts/grdf-connect.ts --org=<orgId>
 *   npx tsx scripts/grdf-connect.ts --org=SAGE --env=sandbox   # par défaut: production
 */
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";

const SCOPES = {
  sandbox: "/adict/bas/v6",
  production: "/adict/v2",
} as const;

type Env = keyof typeof SCOPES;

function getArg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a?.split("=")[1];
}

async function getToken(clientId: string, clientSecret: string, env: Env) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPES[env],
    }),
  });
  if (!r.ok) {
    throw new Error(`Erreur token GRDF (${r.status}): ${await r.text()}`);
  }
  return r.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function main() {
  const clientId = process.env.GRDF_CLIENT_ID;
  const clientSecret = process.env.GRDF_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Variables GRDF_CLIENT_ID et GRDF_CLIENT_SECRET requises dans .env.local"
    );
  }

  const orgArg = getArg("org");
  const envArg = (getArg("env") || "production") as Env;
  if (!SCOPES[envArg]) {
    throw new Error(`Environnement invalide: ${envArg}. Utilise sandbox ou production.`);
  }
  if (!orgArg) {
    throw new Error("Argument --org=<id ou nom> requis.");
  }

  // Trouver l'org par id ou nom
  const org =
    (await prisma.organization.findUnique({ where: { id: orgArg } })) ??
    (await prisma.organization.findFirst({
      where: { name: { equals: orgArg, mode: "insensitive" } },
    }));
  if (!org) throw new Error(`Organisation introuvable: ${orgArg}`);
  console.log(`✓ Org cible: ${org.name} (${org.id})`);

  console.log(`🔑 Récupération d'un access_token GRDF (${envArg})…`);
  const token = await getToken(clientId, clientSecret, envArg);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + token.expires_in);
  console.log(`✓ Token reçu (expire dans ${token.expires_in}s)`);

  const credentialPayload = `${envArg}|${clientId}|${clientSecret}`;

  await prisma.energyProvider.upsert({
    where: {
      organizationId_provider: { organizationId: org.id, provider: "GRDF" },
    },
    update: {
      accessToken: token.access_token,
      refreshToken: credentialPayload,
      tokenExpiresAt: expiresAt,
      isConnected: true,
      lastError: null,
    },
    create: {
      organizationId: org.id,
      provider: "GRDF",
      accessToken: token.access_token,
      refreshToken: credentialPayload,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
  });

  console.log(`✅ EnergyProvider GRDF de "${org.name}" mis à jour (${envArg})`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
