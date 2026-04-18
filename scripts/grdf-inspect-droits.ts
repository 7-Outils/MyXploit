/**
 * Liste les droits d'accès GRDF avec leurs périodes complètes
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";
const URL = "https://api.grdf.fr/adict/v2/droits_acces";

async function main() {
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
  const token = (await r.json()).access_token;

  const res = await fetch(URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);

  const lines = text.trim().split("\n").filter(Boolean);
  console.log(`${lines.length} ligne(s) NDJSON\n`);

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      console.log(JSON.stringify(obj, null, 2));
      console.log("---");
    } catch {
      console.log(`PARSE ERROR: ${line.slice(0, 200)}`);
    }
  }
}

main().catch(console.error);
