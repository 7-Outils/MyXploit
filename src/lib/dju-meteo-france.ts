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
  // Auto-découvert via /api/admin/dju-mf-auto-discover
  // (station MF active la plus proche par dept, typePoste 0/1/2).
  // Distance médiane ~1 km, max 12.9 km (REIMS = Prunay banlieue).
  ABBEVILLE: "80001001", // ABBEVILLE (0.1 km, type 0)
  AGEN: "47091001", // AGEN-LA GARENNE (0.4 km, type 0)
  ANGERS: "49007011", // ANGERS VILLE (1.5 km, type 2)
  AURILLAC: "15014001", // AURILLAC - VILL (2.7 km, type 2)
  AUXERRE: "89295001", // AUXERRE-PERRIGNY (2.6 km, type 0)
  BEAUVAIS: "60639001", // BEAUVAIS-TILLE (1.4 km, type 0)
  BESANCON: "25056001", // BESANCON (0.7 km, type 0)
  BORDEAUX: "33281001", // BORDEAUX-MERIGNAC (0 km, type 0)
  BOURGES: "18033001", // BOURGES (0.7 km, type 0)
  BREST: "29075001", // BREST-GUIPAVAS (2.1 km, type 0)
  BRIVE: "19031008", // BRIVE (3.4 km, type 0)
  CAEN: "14137001", // CAEN-CARPIQUET (0.9 km, type 0)
  "CHARLEVILLE-MEZIERES": "08105005", // CHARLEVILLE-MEZ (5.3 km, type 0)
  CHATEAUDUN: "28198001", // CHATEAUDUN (0.5 km, type 0)
  CHATEAUROUX: "36063001", // CHATEAUROUX DEOLS (1.7 km, type 0)
  "CLERMONT-FERRAND": "63113001", // CLERMONT-FD (0 km, type 0)
  COGNAC: "16089001", // COGNAC (0.2 km, type 0)
  DIJON: "21473001", // DIJON-LONGVIC (0.1 km, type 0)
  EVREUX: "27347001", // EVREUX-HUEST (0.4 km, type 0)
  GRENOBLE: "38384001", // GRENOBLE-ST GEOIRS (1.3 km, type 0)
  "LA-ROCHELLE": "17300009", // LA ROCHELLE-ILE DE RE (4.3 km, type 0)
  LAVAL: "53130008", // LAVAL-ETRONNIER (4.6 km, type 0)
  "LE-BOURGET": "95088001", // LE BOURGET (1 km, type 0)
  "LE-MANS": "72181001", // LE MANS (6.1 km, type 0)
  LILLE: "59343001", // LILLE-LESQUIN (1.1 km, type 0)
  LIMOGES: "87085006", // LIMOGES-BELLEGARDE (0.4 km, type 0)
  LORIENT: "56185001", // LORIENT-LANN BIHOUE (0.4 km, type 0)
  "LYON-BRON": "69029001", // LYON-BRON (0.8 km, type 0)
  MARIGNANE: "13054001", // MARIGNANE (0.8 km, type 0)
  MELUN: "77306001", // MELUN (1.6 km, type 0)
  METZ: "57039001", // METZ-FRESCATY (1 km, type 1)
  MONTELIMAR: "26198001", // MONTELIMAR (2.5 km, type 0)
  MONTPELLIER: "34154001", // MONTPELLIER-AEROPORT (0.1 km, type 0)
  MULHOUSE: "68224006", // MULHOUSE (11.1 km, type 1)
  NANCY: "54526001", // NANCY-ESSEY (0.6 km, type 0)
  NANTES: "44020001", // NANTES-BOUGUENAIS (0.4 km, type 0)
  NEVERS: "58160001", // NEVERS-MARZY (0.3 km, type 0)
  NICE: "06088001", // NICE (1.8 km, type 0)
  NIMES: "30189001", // NIMES-COURBESSAC (0 km, type 0)
  NIORT: "79191005", // NIORT (0.3 km, type 0)
  ORANGE: "84087001", // ORANGE (3.8 km, type 0)
  ORLEANS: "45055001", // ORLEANS (1.3 km, type 0)
  ORLY: "91027002", // ORLY (0.3 km, type 0)
  "PARIS-MONTSOURIS": "75114001", // PARIS-MONTSOURIS (0.1 km, type 0)
  PAU: "64549001", // PAU-UZEIN (0.6 km, type 0)
  PERPIGNAN: "66136001", // PERPIGNAN (0.4 km, type 0)
  POITIERS: "86027001", // POITIERS-BIARD (0.9 km, type 0)
  REIMS: "51449002", // REIMS-PRUNAY (12.9 km, type 0)
  RENNES: "35281001", // RENNES-ST JACQUES (0 km, type 0)
  ROUEN: "76116001", // ROUEN-BOOS (0.4 km, type 0)
  "SAINT-BRIEUC": "22372001", // ST BRIEUC (0.3 km, type 0)
  "SAINT-ETIENNE": "42005001", // ST ETIENNE-BOUTHEON (1.4 km, type 0)
  "SAINT-QUENTIN": "02320001", // ST QUENTIN (0.5 km, type 0)
  STRASBOURG: "67124001", // STRASBOURG-ENTZHEIM (0.2 km, type 0)
  TOULON: "83137001", // TOULON (2.7 km, type 1)
  TOULOUSE: "31069001", // TOULOUSE-BLAGNAC (1.3 km, type 0)
  TOURS: "37179001", // TOURS (1.3 km, type 0)
  TROYES: "10030001", // TROYES-BARBEREY (0.4 km, type 0)
  VICHY: "03060001", // VICHY-CHARMEIL (0.5 km, type 0)
  VILLACOUBLAY: "78640001", // VILLACOUBLAY (0.3 km, type 0)
  // Stations non mappées (fallback Open-Meteo):
  //   AJACCIO, BASTIA — MF refuse les codes dept 2A/2B
  //   DUNKERQUE — pas dans DEPT_TO_STATION
};

/** Clés des stations couvertes par Météo France (DPClim). */
export const METEO_FRANCE_STATION_KEYS = new Set(Object.keys(MF_STATION_IDS));

/**
 * Le CSV quotidien MF ne contient PAS de colonne DJU pré-calculée
 * (le DJU CHAUFFAGISTE n'est dispo que dans l'endpoint mensuel pour certaines
 * stations). On extrait les vraies mesures synoptiques TN/TX et on applique
 * notre formule COSTIC dessus — résultat ≈ DJU officiel MF à ~1% près.
 */
const COL_DATE = "DATE";
const COL_TN = "TN";
const COL_TX = "TX";

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
 * Le CSV quotidien MF contient TN/TX (vraies mesures synoptiques de la station,
 * séparateur décimal ","). On calcule le DJU localement via la formule COSTIC
 * (3 cas) — résultat ≈ DJU officiel MF à ~1% près, en gardant la granularité
 * journalière nécessaire pour la proratisation.
 *
 * Si TN ou TX manquent (colonnes absentes du CSV), retourne une Map vide pour
 * déclencher le fallback Open-Meteo côté appelant.
 */
import { calculateDJU } from "./dju-sync";

export function parseClimatoCsv(csv: string): { djus: Map<string, number>; headers: string[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { djus: new Map(), headers: [] };

  const SEP = ";";
  const headers = lines[0].split(SEP).map((h) => h.trim().toUpperCase());
  const dateIdx = headers.indexOf(COL_DATE);
  const tnIdx = headers.indexOf(COL_TN);
  const txIdx = headers.indexOf(COL_TX);
  if (dateIdx < 0 || tnIdx < 0 || txIdx < 0) {
    return { djus: new Map(), headers };
  }

  const djus = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cols = line.split(SEP);
    const rawDate = cols[dateIdx]?.trim();
    const rawTn = cols[tnIdx]?.trim();
    const rawTx = cols[txIdx]?.trim();
    if (!rawDate || !rawTn || !rawTx || rawTn === "" || rawTx === "") continue;
    // Date AAAAMMJJ → YYYY-MM-DD
    const iso =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    // Décimales avec virgule (ex "0,7")
    const tn = parseFloat(rawTn.replace(",", "."));
    const tx = parseFloat(rawTx.replace(",", "."));
    if (isNaN(tn) || isNaN(tx)) continue;
    djus.set(iso, calculateDJU(tn, tx));
  }
  return { djus, headers };
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
      const { djus, headers } = parseClimatoCsv(csv);
      if (djus.size === 0) {
        // TN ou TX absents du CSV — log pour debug
        console.warn(
          `[MF] CSV vide ou TN/TX manquants pour station=${stationKey} ${s}→${e}. Headers: ${headers
            .slice(0, 30)
            .join("|")}`
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
