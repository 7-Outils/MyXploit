/**
 * Teste si GRDF v2 accepte date_debut + date_fin pour récupérer plusieurs années
 * en un seul appel (au lieu de boucler par année)
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function getToken() {
  const r = await fetch(
    "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.GRDF_CLIENT_ID!,
        client_secret: process.env.GRDF_CLIENT_SECRET!,
        scope: "/adict/v2",
      }),
    }
  );
  return (await r.json()).access_token;
}

async function tryFetch(pce: string, params: Record<string, string>) {
  const token = await getToken();
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.grdf.fr/adict/v2/pce/${pce}/donnees_consos_publiees?${qs}`;
  console.log(`\n→ ${url}`);
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  const lines = text.trim().split("\n").filter(Boolean);
  console.log(`  ${r.status}, ${lines.length} ligne(s)`);

  // Compter celles avec consommation calculée
  let withConso = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.consommation?.date_debut_consommation) withConso++;
    } catch {}
  }
  console.log(`  Lignes avec consommation calculée: ${withConso}`);
}

async function main() {
  // Test 1: date_debut + date_fin sur Piscine (3 ans)
  await tryFetch("GI038189", {
    date_debut: "2023-01-01",
    date_fin: "2026-04-08",
  });

  // Test 2: date_debut + date_fin sur Mairie (depuis perim debut)
  await tryFetch("GI038161", {
    date_debut: "2026-03-01",
    date_fin: "2027-02-28",
  });

  // Test 3: Groupe Scolaire
  await tryFetch("GI038148", {
    date_debut: "2026-03-01",
    date_fin: "2027-02-28",
  });
}

main().catch(console.error);
