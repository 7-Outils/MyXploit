/**
 * Inspecte la STRUCTURE COMPLÈTE d'un relevé GRDF pour comprendre
 * comment parser les données conso en v2.
 *
 * Usage:
 *   npx tsx scripts/grdf-inspect-conso.ts --pce=GI038189 --periode=2025
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";
const API_HOST = "https://api.grdf.fr";
const BASE_PATH = "/adict/v2";
const SCOPE = "/adict/v2";

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
      scope: SCOPE,
    }),
  });
  return (await r.json()).access_token as string;
}

async function main() {
  const pce = getArg("pce") || "GI038189";
  const periode = getArg("periode") || "2025";

  const token = await getToken();
  const url = `${API_HOST}${BASE_PATH}/pce/${pce}/donnees_consos_publiees?periode=${periode}`;
  console.log(`→ ${url}\n`);

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  const lines = text.trim().split("\n").filter(Boolean);

  console.log(`Statut: ${r.status}`);
  console.log(`Lignes: ${lines.length}\n`);

  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      console.log(`─────── Ligne ${i} ───────`);
      console.log(JSON.stringify(obj, null, 2));
      console.log("");
    } catch {
      console.log(`[${i}] PARSE ERROR: ${lines[i]}`);
    }
  }
}

main().catch((e) => console.error(e));
