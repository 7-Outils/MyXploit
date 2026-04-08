/**
 * Test la récupération de conso GRDF pour un PCE donné, sans passer par l'app.
 * Utile pour vérifier rapidement qu'un PCE remonte bien des données.
 *
 * Variables d'env requises (.env.local) :
 *   GRDF_CLIENT_ID
 *   GRDF_CLIENT_SECRET
 *
 * Usage:
 *   npx tsx scripts/grdf-test-conso.ts --pce=GI038189
 *   npx tsx scripts/grdf-test-conso.ts --pce=GI038189 --periode=2025
 *   npx tsx scripts/grdf-test-conso.ts --pce=GI038189 --env=production
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";
const API_HOST = "https://api.grdf.fr";

const ENV_CONFIG = {
  sandbox: { basePath: "/adict/bas/v6", scope: "/adict/bas/v6" },
  production: { basePath: "/adict/v2", scope: "/adict/v2" },
} as const;

type Env = keyof typeof ENV_CONFIG;

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
      scope: ENV_CONFIG[env].scope,
    }),
  });
  if (!r.ok) throw new Error(`Token error (${r.status}): ${await r.text()}`);
  return (await r.json()).access_token as string;
}

async function fetchConsos(
  pce: string,
  periode: string,
  token: string,
  env: Env
) {
  const url = `${API_HOST}${ENV_CONFIG[env].basePath}/pce/${pce}/donnees_consos_publiees?periode=${periode}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  console.log(`\n→ ${url}`);
  console.log(`  ${r.status} ${r.headers.get("content-type")}`);
  const text = await r.text();
  if (!r.ok) {
    console.log(`  ${text.slice(0, 400)}`);
    return;
  }
  const lines = text.trim().split("\n").filter(Boolean);
  console.log(`  ${lines.length} ligne(s) NDJSON`);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    try {
      const obj = JSON.parse(lines[i]);
      console.log(`  [${i}] ${JSON.stringify(obj).slice(0, 300)}`);
    } catch {
      console.log(`  [${i}] (parse error)`);
    }
  }
}

async function main() {
  const clientId = process.env.GRDF_CLIENT_ID;
  const clientSecret = process.env.GRDF_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Variables GRDF_CLIENT_ID et GRDF_CLIENT_SECRET requises dans .env.local"
    );
  }

  const pce = getArg("pce");
  const periode = getArg("periode") || String(new Date().getFullYear() - 1);
  const env = (getArg("env") || "production") as Env;
  if (!pce) throw new Error("Argument --pce=<id_pce> requis.");
  if (!ENV_CONFIG[env]) throw new Error(`Env invalide: ${env}`);

  console.log(`🔑 Token GRDF (${env})…`);
  const token = await getToken(clientId, clientSecret, env);
  console.log(`✓\n📊 PCE ${pce}, periode ${periode}`);

  await fetchConsos(pce, periode, token, env);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
