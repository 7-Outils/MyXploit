/**
 * Teste l'endpoint donnees_consos_informatives (données journalières Gazpar)
 * et compare avec donnees_consos_publiees (données mensuelles publiées).
 *
 * Usage:
 *   npx tsx scripts/grdf-test-informatives.ts --pce=GI038161
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";
const API_HOST = "https://api.grdf.fr";
const BASE = "/adict/v2";

function getArg(name: string): string | undefined {
  return process.argv.find((x) => x.startsWith(`--${name}=`))?.split("=")[1];
}

async function getToken() {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.GRDF_CLIENT_ID!,
      client_secret: process.env.GRDF_CLIENT_SECRET!,
      scope: "/adict/v2",
    }),
  });
  return (await r.json()).access_token;
}

async function call(endpoint: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_HOST}${BASE}${endpoint}?${qs}`;
  console.log(`\n→ ${url}`);
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  const lines = text.trim().split("\n").filter(Boolean);
  console.log(`  ${r.status}, ${lines.length} ligne(s)`);

  if (!r.ok) {
    console.log(`  ${text.slice(0, 400)}`);
    return;
  }

  // Compter celles avec consommation
  let withConso = 0;
  let firstLine: any = null;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.consommation?.date_debut_consommation) {
        withConso++;
        if (!firstLine) firstLine = obj;
      }
    } catch {}
  }
  console.log(`  Lignes avec consommation: ${withConso}`);
  if (firstLine) {
    console.log(`  Exemple [0]:`);
    console.log(JSON.stringify(firstLine, null, 2));
  }
}

async function main() {
  const pce = getArg("pce") || "GI038161";
  const token = await getToken();

  console.log("═══ donnees_consos_PUBLIEES (mensuelles certifiées) ═══");
  await call(`/pce/${pce}/donnees_consos_publiees`, { periode: "2026" }, token);

  console.log("\n═══ donnees_consos_INFORMATIVES (journalières Gazpar) ═══");
  await call(
    `/pce/${pce}/donnees_consos_informatives`,
    { date_debut: "2026-01-01", date_fin: "2026-04-08" },
    token
  );
}

main().catch(console.error);
