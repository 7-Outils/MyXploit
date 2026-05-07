/**
 * Intégration Météo-France — API Données Climatologiques (DPClim v1).
 *
 * Architecture asynchrone en 3 étapes :
 *   1. POST /commande-station/quotidienne → renvoie un id de commande
 *   2. Polling GET /commande/fichier → 204 = pas prêt, 201 = CSV prêt
 *   3. Parsing du CSV (séparateur ;) pour extraire la colonne DJU chauffagiste
 *
 * Auth : header `apikey: <jwt>` (token Apigee MF, valable plusieurs années).
 * Quota : 50 req/min sur le free tier.
 */

const MF_BASE = "https://portail-api.meteofrance.fr/public/DPClim/v1";

/**
 * Mapping entre nos codes-station internes (cf WEATHER_STATIONS dans dju-sync.ts)
 * et les identifiants MF (8 chiffres : DDCCCNNN).
 *
 * Pour ajouter une station : appeler /liste-stations/quotidienne?id-departement=DD
 * (par ex. via l'endpoint admin /api/admin/dju-mf-discover-stations) puis chercher
 * la station correspondante dans le JSON retourné.
 */
const MF_STATION_IDS: Record<string, string> = {
  // Le Bourget (dept 93, INSEE 93005). À confirmer à la 1re requête.
  "LE-BOURGET": "93005001",
};

/**
 * Code de colonne dans le CSV pour le DJU chauffagiste base 18°C.
 * À ajuster après la 1re inspection du CSV (cf /api/admin/dju-mf-test).
 * Candidats vraisemblables: DJU18C, DJUC18, DJUM18, DJU18.
 */
const DJU_CHAUFFAGISTE_COLUMN_CANDIDATES = [
  "DJU18C",
  "DJUC18",
  "DJUM18",
  "DJU18CH",
  "CUMUL_DJU_18_METHODE_CHAUFFAGISTE",
];

function getApiKey(): string | null {
  return process.env.METEO_FRANCE_API_KEY ?? null;
}

async function mfFetch(url: string): Promise<Response> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("METEO_FRANCE_API_KEY missing");
  return fetch(url, {
    headers: {
      apikey: apiKey,
      Accept: "*/*",
    },
  });
}

/** Format ISO 8601 UTC requis par MF (ex: 2025-01-15T00:00:00Z) */
function toMfIsoStart(dateIso: string): string {
  return `${dateIso}T00:00:00Z`;
}
function toMfIsoEnd(dateIso: string): string {
  return `${dateIso}T23:59:59Z`;
}

/**
 * Étape 1 — passe une commande quotidienne pour une station sur une période.
 * La période ne peut pas dépasser 1 an glissant. Renvoie l'id de commande.
 */
export async function orderClimatoQuotidienne(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const url = `${MF_BASE}/commande-station/quotidienne?id-station=${encodeURIComponent(
    stationId
  )}&date-deb-periode=${encodeURIComponent(toMfIsoStart(startDate))}&date-fin-periode=${encodeURIComponent(toMfIsoEnd(endDate))}`;
  const res = await mfFetch(url);
  if (res.status !== 202) {
    const txt = await res.text();
    throw new Error(`MF order failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  // Format réponse: { elaboreProduitAvecDemandeResponse: { return: "770657073297" } }
  const orderId = data?.elaboreProduitAvecDemandeResponse?.return;
  if (!orderId) {
    throw new Error(`MF order: orderId missing in response. Body: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return String(orderId);
}

/**
 * Étape 2 — poll le fichier de données. 204 = en cours, 201 = prêt (CSV en body).
 * Quotidien typique = 1-5s; on tente plusieurs fois avec backoff.
 */
export async function pollCommandeFichier(
  orderId: string,
  maxAttempts = 8,
  initialDelayMs = 1500
): Promise<string> {
  const url = `${MF_BASE}/commande/fichier?id-cmde=${encodeURIComponent(orderId)}`;
  let delay = initialDelayMs;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delay));
    const res = await mfFetch(url);
    if (res.status === 201) return res.text();
    if (res.status === 204) {
      delay = Math.min(delay * 1.5, 5000); // backoff plafonné à 5s
      continue;
    }
    const txt = await res.text();
    throw new Error(`MF download failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  throw new Error(`MF download timeout: 204 after ${maxAttempts} attempts`);
}

/**
 * Étape 3 — parse le CSV (séparateur ;) et renvoie une Map<dateIso, dju>.
 *
 * Format CSV attendu (cf doc) : 1re ligne = header avec codes courts
 * (POSTE, DATE, RR, TN, TX, TM, ...). On cherche la colonne DJU chauffagiste
 * via la liste de candidats (le nom exact varie selon les sources MF).
 *
 * Si aucune colonne candidate n'est trouvée, la fonction retourne une Map
 * vide ET log les headers reçus (pour qu'on puisse identifier le bon code).
 */
export function parseClimatoCsv(csv: string): { djus: Map<string, number>; columnUsed: string | null; headers: string[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { djus: new Map(), columnUsed: null, headers: [] };

  const SEP = ";";
  const headers = lines[0].split(SEP).map((h) => h.trim().toUpperCase());
  const dateIdx = headers.indexOf("DATE");
  if (dateIdx < 0) {
    return { djus: new Map(), columnUsed: null, headers };
  }
  // Recherche de la colonne DJU chauffagiste
  let djuIdx = -1;
  let columnUsed: string | null = null;
  for (const candidate of DJU_CHAUFFAGISTE_COLUMN_CANDIDATES) {
    const idx = headers.indexOf(candidate.toUpperCase());
    if (idx >= 0) {
      djuIdx = idx;
      columnUsed = candidate;
      break;
    }
  }
  if (djuIdx < 0) {
    // Aucun candidat trouvé — on log les headers pour debug
    return { djus: new Map(), columnUsed: null, headers };
  }

  const djus = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cols = line.split(SEP);
    const rawDate = cols[dateIdx]?.trim();
    const rawDju = cols[djuIdx]?.trim();
    if (!rawDate || !rawDju || rawDju === "") continue;
    // Date au format AAAAMMJJ → YYYY-MM-DD
    const iso =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate; // fallback si déjà ISO
    const dju = parseFloat(rawDju.replace(",", "."));
    if (!isNaN(dju)) djus.set(iso, dju);
  }
  return { djus, columnUsed, headers };
}

/**
 * Helper de haut niveau : récupère les DJU CHAUFFAGISTE pour une station
 * sur une période. Renvoie une Map vide en cas de souci (la couche
 * appelante peut alors fallback sur Open-Meteo).
 *
 * Limitation API MF : période max 1 an glissant. Au-delà, on chunke.
 */
export async function fetchDjuFromMeteoFrance(
  stationKey: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  if (!getApiKey()) return new Map();
  const stationId = MF_STATION_IDS[stationKey];
  if (!stationId) return new Map();
  if (startDate > endDate) return new Map();

  // Découpage par tranches de ~360j pour rester sous la limite 1 an glissant
  const chunks: Array<{ start: string; end: string }> = [];
  const start = new Date(startDate + "T00:00:00Z");
  const finalEnd = new Date(endDate + "T00:00:00Z");
  let cursor = start;
  while (cursor <= finalEnd) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 360);
    const chunkEnd = next > finalEnd ? finalEnd : next;
    chunks.push({
      start: cursor.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const merged = new Map<string, number>();
  for (const { start: s, end: e } of chunks) {
    try {
      const orderId = await orderClimatoQuotidienne(stationId, s, e);
      const csv = await pollCommandeFichier(orderId);
      const { djus, columnUsed, headers } = parseClimatoCsv(csv);
      if (djus.size === 0 && columnUsed === null) {
        // Aucune colonne DJU candidate trouvée — log les headers pour ajuster
        console.warn(
          `[MF] Aucune colonne DJU chauffagiste trouvée. Headers reçus: ${headers.slice(0, 50).join("|")}${
            headers.length > 50 ? "..." : ""
          }`
        );
      }
      for (const [date, dju] of djus.entries()) merged.set(date, dju);
    } catch (e) {
      console.warn(`[MF] Échec récupération DJU station=${stationKey} ${s}→${e}:`, e instanceof Error ? e.message : e);
      // On continue les autres chunks; les jours manquants seront comblés par fallback
    }
  }
  return merged;
}
