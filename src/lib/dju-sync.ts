import prisma from "@/lib/prisma";

// Stations météo COSTIC avec coordonnées
const WEATHER_STATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  "PARIS-MONTSOURIS": { lat: 48.8222, lon: 2.3378, name: "Paris-Montsouris" },
  "LE-BOURGET": { lat: 48.9694, lon: 2.4414, name: "Paris-Le Bourget" },
  ORLY: { lat: 48.7167, lon: 2.4, name: "Paris-Orly" },
  MELUN: { lat: 48.5961, lon: 2.6750, name: "Melun" },
  VILLACOUBLAY: { lat: 48.7744, lon: 2.2017, name: "Villacoublay" },
  "LYON-BRON": { lat: 45.7267, lon: 4.9433, name: "Lyon-Bron" },
  MARIGNANE: { lat: 43.4392, lon: 5.2214, name: "Marseille-Marignane" },
  LILLE: { lat: 50.5617, lon: 3.0892, name: "Lille-Lesquin" },
  BORDEAUX: { lat: 44.8306, lon: -0.6914, name: "Bordeaux-Mérignac" },
  TOULOUSE: { lat: 43.6294, lon: 1.3678, name: "Toulouse-Blagnac" },
  NANTES: { lat: 47.1533, lon: -1.6106, name: "Nantes-Atlantique" },
  STRASBOURG: { lat: 48.5494, lon: 7.6372, name: "Strasbourg-Entzheim" },
  NICE: { lat: 43.6653, lon: 7.2103, name: "Nice" },
  RENNES: { lat: 48.0686, lon: -1.7342, name: "Rennes" },
  "CLERMONT-FERRAND": { lat: 45.7867, lon: 3.1497, name: "Clermont-Ferrand" },
  NANCY: { lat: 48.6936, lon: 6.2222, name: "Nancy" },
  GRENOBLE: { lat: 45.3628, lon: 5.3294, name: "Grenoble" },
  DIJON: { lat: 47.2686, lon: 5.0878, name: "Dijon" },
  TOURS: { lat: 47.4325, lon: 0.7278, name: "Tours" },
  ROUEN: { lat: 49.3867, lon: 1.1817, name: "Rouen" },
  MONTPELLIER: { lat: 43.5764, lon: 3.9631, name: "Montpellier" },
  BREST: { lat: 48.4478, lon: -4.4186, name: "Brest" },
  LIMOGES: { lat: 45.8628, lon: 1.1794, name: "Limoges" },
  POITIERS: { lat: 46.5878, lon: 0.3067, name: "Poitiers" },
  ORLEANS: { lat: 47.9878, lon: 1.7606, name: "Orléans" },
  REIMS: { lat: 49.3100, lon: 4.0650, name: "Reims" },
  METZ: { lat: 49.0775, lon: 6.1317, name: "Metz" },
  CAEN: { lat: 49.1733, lon: -0.4500, name: "Caen" },
  "LE-MANS": { lat: 47.9486, lon: 0.1117, name: "Le Mans" },
  ANGERS: { lat: 47.4397, lon: -0.5614, name: "Angers" },
  BESANCON: { lat: 47.2547, lon: 5.9928, name: "Besançon" },
  PAU: { lat: 43.3800, lon: -0.4186, name: "Pau" },
  PERPIGNAN: { lat: 42.7400, lon: 2.8700, name: "Perpignan" },
  AJACCIO: { lat: 41.9236, lon: 8.8028, name: "Ajaccio" },
  BASTIA: { lat: 42.5528, lon: 9.4836, name: "Bastia" },
  BEAUVAIS: { lat: 49.4544, lon: 2.1128, name: "Beauvais" },
  EVREUX: { lat: 49.0286, lon: 1.2197, name: "Évreux" },
  CHATEAUDUN: { lat: 48.0572, lon: 1.3767, name: "Châteaudun" },
  "SAINT-QUENTIN": { lat: 49.8167, lon: 3.2000, name: "Saint-Quentin" },
  TROYES: { lat: 48.3222, lon: 4.0167, name: "Troyes" },
  BOURGES: { lat: 47.0653, lon: 2.3608, name: "Bourges" },
  CHATEAUROUX: { lat: 46.8622, lon: 1.7211, name: "Châteauroux" },
  AUXERRE: { lat: 47.8014, lon: 3.5550, name: "Auxerre" },
  NEVERS: { lat: 47.0014, lon: 3.1131, name: "Nevers" },
  VICHY: { lat: 46.1697, lon: 3.4028, name: "Vichy" },
  "SAINT-ETIENNE": { lat: 45.5333, lon: 4.2964, name: "Saint-Étienne" },
  COGNAC: { lat: 45.6667, lon: -0.3167, name: "Cognac" },
  "LA-ROCHELLE": { lat: 46.1522, lon: -1.1522, name: "La Rochelle" },
  AGEN: { lat: 44.1747, lon: 0.5903, name: "Agen" },
  NIMES: { lat: 43.8567, lon: 4.4064, name: "Nîmes" },
  ABBEVILLE: { lat: 50.1364, lon: 1.8350, name: "Abbeville" },
  DUNKERQUE: { lat: 51.0500, lon: 2.3333, name: "Dunkerque" },
  "CHARLEVILLE-MEZIERES": { lat: 49.7833, lon: 4.7167, name: "Charleville-Mézières" },
  MULHOUSE: { lat: 47.6833, lon: 7.4000, name: "Mulhouse" },
  "SAINT-BRIEUC": { lat: 48.5378, lon: -2.8489, name: "Saint-Brieuc" },
  LORIENT: { lat: 47.7603, lon: -3.4400, name: "Lorient" },
  LAVAL: { lat: 48.0683, lon: -0.7706, name: "Laval" },
  NIORT: { lat: 46.3147, lon: -0.3964, name: "Niort" },
  BRIVE: { lat: 45.1500, lon: 1.5167, name: "Brive" },
  AURILLAC: { lat: 44.9167, lon: 2.4167, name: "Aurillac" },
  MONTELIMAR: { lat: 44.5586, lon: 4.7342, name: "Montélimar" },
  ORANGE: { lat: 44.1167, lon: 4.8333, name: "Orange" },
  TOULON: { lat: 43.1167, lon: 5.9333, name: "Toulon" },
};

// Mapping département -> station météo
const DEPT_TO_STATION: Record<string, string> = {
  "75": "PARIS-MONTSOURIS", "77": "MELUN", "78": "VILLACOUBLAY",
  "91": "ORLY", "92": "PARIS-MONTSOURIS", "93": "LE-BOURGET",
  "94": "ORLY", "95": "LE-BOURGET", "02": "SAINT-QUENTIN",
  "59": "LILLE", "60": "BEAUVAIS", "62": "LILLE", "80": "ABBEVILLE",
  "08": "CHARLEVILLE-MEZIERES", "10": "TROYES", "51": "REIMS",
  "52": "NANCY", "54": "NANCY", "55": "NANCY", "57": "METZ",
  "67": "STRASBOURG", "68": "MULHOUSE", "88": "NANCY",
  "21": "DIJON", "25": "BESANCON", "39": "BESANCON",
  "58": "NEVERS", "70": "BESANCON", "71": "DIJON", "89": "AUXERRE",
  "90": "MULHOUSE", "22": "SAINT-BRIEUC", "29": "BREST",
  "35": "RENNES", "56": "LORIENT", "44": "NANTES", "49": "ANGERS",
  "53": "LAVAL", "72": "LE-MANS", "85": "NANTES", "14": "CAEN",
  "27": "EVREUX", "50": "CAEN", "61": "CAEN", "76": "ROUEN",
  "18": "BOURGES", "28": "CHATEAUDUN", "36": "CHATEAUROUX",
  "37": "TOURS", "41": "TOURS", "45": "ORLEANS", "16": "COGNAC",
  "17": "LA-ROCHELLE", "79": "NIORT", "86": "POITIERS",
  "19": "BRIVE", "23": "LIMOGES", "24": "BORDEAUX", "33": "BORDEAUX",
  "40": "BORDEAUX", "47": "AGEN", "64": "PAU", "87": "LIMOGES",
  "09": "TOULOUSE", "12": "AURILLAC", "31": "TOULOUSE",
  "32": "TOULOUSE", "46": "AURILLAC", "65": "PAU", "81": "TOULOUSE",
  "82": "TOULOUSE", "01": "LYON-BRON", "03": "VICHY", "07": "MONTELIMAR",
  "15": "AURILLAC", "26": "MONTELIMAR", "38": "GRENOBLE",
  "42": "SAINT-ETIENNE", "43": "CLERMONT-FERRAND", "63": "CLERMONT-FERRAND",
  "69": "LYON-BRON", "73": "GRENOBLE", "74": "GRENOBLE",
  "04": "ORANGE", "05": "GRENOBLE", "06": "NICE", "11": "PERPIGNAN",
  "13": "MARIGNANE", "30": "NIMES", "34": "MONTPELLIER",
  "48": "MONTPELLIER", "66": "PERPIGNAN", "83": "TOULON",
  "84": "ORANGE", "2A": "AJACCIO", "2B": "BASTIA",
};

export function getStationFromPostalCode(postalCode: string | null): string {
  if (!postalCode) return "PARIS-MONTSOURIS";

  // Special-case Corsica (postal codes 20xxx, 2Axxx, 2Bxxx)
  if (postalCode.startsWith("20")) {
    const num = parseInt(postalCode.substring(0, 3));
    if (num >= 200 && num <= 201) return "AJACCIO";
    if (num >= 202 && num <= 206) return "BASTIA";
    return "AJACCIO";
  }

  const dept = postalCode.substring(0, 2);
  return DEPT_TO_STATION[dept] || "PARIS-MONTSOURIS";
}

// ─── DJU trentenaires (1991-2020 averages, base 18°C, source COSTIC) ──
// Used as the contractual baseline (DJC) when a site has no djuContractuel
// explicitly set. The user no longer has to manually fill it in — we infer
// it from the site's stationMeteo or postalCode.
export const DJU_TRENTENAIRES: Record<string, number> = {
  // Île-de-France
  "PARIS-MONTSOURIS": 2400,
  "LE-BOURGET": 2450,
  ORLY: 2450,
  MELUN: 2500,
  VILLACOUBLAY: 2480,
  // Grandes métropoles
  "LYON-BRON": 2250,
  MARIGNANE: 1550,
  LILLE: 2700,
  BORDEAUX: 1850,
  TOULOUSE: 1850,
  NANTES: 2100,
  STRASBOURG: 2800,
  NICE: 1250,
  RENNES: 2200,
  // Autres stations COSTIC
  "CLERMONT-FERRAND": 2400,
  NANCY: 2750,
  GRENOBLE: 2450,
  DIJON: 2600,
  TOURS: 2200,
  ROUEN: 2500,
  MONTPELLIER: 1450,
  BREST: 2050,
  LIMOGES: 2300,
  POITIERS: 2200,
  ORLEANS: 2350,
  REIMS: 2650,
  METZ: 2700,
  CAEN: 2350,
  "LE-MANS": 2250,
  ANGERS: 2150,
  BESANCON: 2650,
  PAU: 1800,
  PERPIGNAN: 1350,
  AJACCIO: 1200,
  BASTIA: 1350,
  // Stations additionnelles
  BEAUVAIS: 2550,
  EVREUX: 2450,
  CHATEAUDUN: 2400,
  "SAINT-QUENTIN": 2750,
  TROYES: 2650,
  BOURGES: 2400,
  CHATEAUROUX: 2350,
  AUXERRE: 2550,
  NEVERS: 2450,
  VICHY: 2400,
  "SAINT-ETIENNE": 2350,
  COGNAC: 2050,
  "LA-ROCHELLE": 1950,
  AGEN: 1900,
  NIMES: 1500,
  ABBEVILLE: 2600,
  DUNKERQUE: 2650,
  "CHARLEVILLE-MEZIERES": 2800,
  MULHOUSE: 2750,
  "SAINT-BRIEUC": 2200,
  LORIENT: 2100,
  LAVAL: 2250,
  NIORT: 2100,
  BRIVE: 2150,
  AURILLAC: 2550,
  MONTELIMAR: 1850,
  ORANGE: 1600,
  TOULON: 1350,
};

/**
 * Resolve the contractual DJU (DJC) for a site with the following priority:
 *  1. Explicit `djuContractuel` set on the Site or HeatingSeason record
 *  2. Trentenaire for the site's stationMeteo (if known)
 *  3. Trentenaire for the station inferred from the postalCode
 *  4. Fallback to PARIS-MONTSOURIS (2400)
 *
 * Returns null only if no postalCode AND no stationMeteo are available.
 */
export function resolveDjuContractuel(
  djuContractuel: number | null,
  stationMeteo: string | null,
  postalCode: string | null
): number | null {
  if (djuContractuel != null && djuContractuel > 0) return djuContractuel;

  if (stationMeteo && DJU_TRENTENAIRES[stationMeteo]) {
    return DJU_TRENTENAIRES[stationMeteo];
  }

  if (postalCode) {
    const station = getStationFromPostalCode(postalCode);
    if (DJU_TRENTENAIRES[station]) return DJU_TRENTENAIRES[station];
  }

  return null;
}

function calculateDJU(tMoy: number): number {
  const base = 18;
  return tMoy < base ? base - tMoy : 0;
}

export async function fetchWeatherData(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; dju: number }>> {
  // Cap endDate to yesterday — weather APIs don't have today or future data
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (endDate > yesterdayIso) endDate = yesterdayIso;
  if (startDate > endDate) return [];

  // Open-Meteo: archive covers old data (~5 days ago and older),
  // forecast covers last ~3 months + 16 days ahead.
  // We fetch from both and merge to cover the full range.
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean&timezone=Europe/Paris`;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean&timezone=Europe/Paris`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: Array<{ date: string; tMoy: number }> = [];
  const seenDates = new Set<string>();

  // Try both APIs, merge results (archive first for older data, forecast fills gaps)
  for (const url of [archiveUrl, forecastUrl]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.daily?.time && json.daily?.temperature_2m_mean) {
        for (let i = 0; i < json.daily.time.length; i++) {
          const date = json.daily.time[i];
          const tMoy = json.daily.temperature_2m_mean[i];
          if (tMoy !== null && !seenDates.has(date)) {
            results.push({ date, tMoy });
            seenDates.add(date);
          }
        }
      }
    } catch {
      // Continue to next API
    }
  }

  if (results.length === 0) {
    throw new Error("No weather data from either API");
  }

  return results.map((r) => ({ date: r.date, dju: calculateDJU(r.tMoy) }));
}

/**
 * Fetch monthly DJU totals for a station over a date range.
 * Uses Open-Meteo archive API directly.
 */
export async function getMonthlyDjuForStation(
  stationMeteo: string | null,
  postalCode: string | null,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  const station = stationMeteo || getStationFromPostalCode(postalCode);
  const coords = WEATHER_STATIONS[station];
  if (!coords) return new Map();

  try {
    const dailyData = await fetchWeatherData(coords.lat, coords.lon, startDate, endDate);
    const byMonth = new Map<string, number>();
    for (const d of dailyData) {
      const key = d.date.substring(0, 7); // "YYYY-MM"
      byMonth.set(key, (byMonth.get(key) || 0) + d.dju);
    }
    return byMonth;
  } catch (err) {
    console.error(`DJU fetch failed for station ${station}:`, err);
    return new Map();
  }
}

export interface DjuSyncResult {
  updated: number;
  total: number;
  errors: string[];
}

/**
 * Synchronize DJU réels for consumptions of given sites
 * @param siteIds - Array of site IDs to sync
 * @param organizationId - Organization ID for filtering
 * @param overwrite - Whether to overwrite existing djuReel values
 */
export async function syncDjuForSites(
  siteIds: string[],
  organizationId: string,
  overwrite: boolean = false
): Promise<DjuSyncResult> {
  const result: DjuSyncResult = { updated: 0, total: 0, errors: [] };

  if (siteIds.length === 0) {
    return result;
  }

  // Get sites with their postal codes and station météo
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds }, organizationId },
    select: { id: true, name: true, postalCode: true, stationMeteo: true },
  });

  if (sites.length === 0) {
    return result;
  }

  // Get consumptions that need DJU sync
  const consumptionsWhere: Record<string, unknown> = {
    siteId: { in: siteIds },
    organizationId,
  };
  if (!overwrite) {
    consumptionsWhere.djuReel = null;
  }

  const consumptions = await prisma.consumption.findMany({
    where: consumptionsWhere,
    select: { id: true, siteId: true, period: true, djuReel: true },
    orderBy: { period: "asc" },
  });

  result.total = consumptions.length;
  if (consumptions.length === 0) {
    return result;
  }

  // Group consumptions by site
  const consumptionsBySite = new Map<string, typeof consumptions>();
  for (const c of consumptions) {
    const siteConsumptions = consumptionsBySite.get(c.siteId) || [];
    siteConsumptions.push(c);
    consumptionsBySite.set(c.siteId, siteConsumptions);
  }

  // For each site, fetch DJU data and update consumptions
  for (const site of sites) {
    const siteConsumptions = consumptionsBySite.get(site.id);
    if (!siteConsumptions || siteConsumptions.length === 0) continue;

    // Determine weather station
    let stationCode = site.stationMeteo;
    if (!stationCode || !WEATHER_STATIONS[stationCode]) {
      stationCode = getStationFromPostalCode(site.postalCode);
    }

    const stationData = WEATHER_STATIONS[stationCode];
    if (!stationData) {
      result.errors.push(`${site.name}: Station météo non trouvée`);
      continue;
    }

    // Find date range needed
    const periods = siteConsumptions.map((c) => c.period);
    const minDate = new Date(Math.min(...periods.map((p) => p.getTime())));
    const maxDate = new Date(Math.max(...periods.map((p) => p.getTime())));

    const startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

    // Cap endDate to today
    const today = new Date();
    const fetchEndDate = endDate > today ? today : endDate;

    try {
      const djuData = await fetchWeatherData(
        stationData.lat,
        stationData.lon,
        startDate.toISOString().split("T")[0],
        fetchEndDate.toISOString().split("T")[0]
      );

      // Index DJU by exact day for daily granularity
      const dailyDju = new Map<string, number>();
      for (const d of djuData) {
        // d.date is "YYYY-MM-DD"
        dailyDju.set(d.date, d.dju);
      }

      // Compute monthly totals so we can split them across rows of the same
      // month — preserves backwards compatibility for sites that have only
      // one consumption row per month (legacy Excel imports).
      const monthlyTotal = new Map<string, number>();
      const monthlyCount = new Map<string, number>();
      for (const d of djuData) {
        const mKey = d.date.substring(0, 7);
        monthlyTotal.set(mKey, (monthlyTotal.get(mKey) || 0) + d.dju);
      }

      // Count how many consumption rows exist per month so we can detect
      // daily-granularity rows and avoid the over-counting bug where the
      // analytics endpoint would sum the monthly DJR ~30 times.
      for (const c of siteConsumptions) {
        const mKey = `${c.period.getFullYear()}-${String(c.period.getMonth() + 1).padStart(2, "0")}`;
        monthlyCount.set(mKey, (monthlyCount.get(mKey) || 0) + 1);
      }

      // Update each consumption with the correct DJR.
      for (const consumption of siteConsumptions) {
        const dateKey = consumption.period.toISOString().split("T")[0];
        const monthKey = `${consumption.period.getFullYear()}-${String(consumption.period.getMonth() + 1).padStart(2, "0")}`;
        const rowsInMonth = monthlyCount.get(monthKey) || 1;

        let djr: number | null = null;

        if (rowsInMonth >= 20) {
          // Daily granularity (≥ 20 rows in this month). Use the exact day's
          // DJU so summing over the month gives the right total.
          const dailyValue = dailyDju.get(dateKey);
          if (dailyValue !== undefined) {
            djr = dailyValue;
          }
        } else {
          // Monthly (or coarser) granularity — store the full month total
          // on the single row, same as the legacy behaviour.
          const monthlyValue = monthlyTotal.get(monthKey);
          if (monthlyValue !== undefined) {
            djr = monthlyValue;
          }
        }

        if (djr !== null) {
          await prisma.consumption.update({
            where: { id: consumption.id },
            data: { djuReel: Math.round(djr * 10) / 10 },
          });
          result.updated++;
        }
      }
    } catch (error) {
      console.error(`Error syncing DJU for site ${site.name}:`, error);
      result.errors.push(`${site.name}: Erreur lors de la récupération des DJU`);
    }
  }

  return result;
}

/**
 * Synchronize DJU réels for every site of an organization that has at least
 * one consumption record. Designed for the nightly Vercel Cron — same shape
 * as syncGrdfForOrg() in src/lib/grdf-helpers.ts.
 *
 * Returns the same DjuSyncResult as syncDjuForSites().
 */
export async function syncDjuForOrg(
  organizationId: string
): Promise<DjuSyncResult> {
  // Pick every site that has at least one consumption record. We don't sync
  // sites with zero consumption — there's nothing to enrich, and it would
  // waste Open-Meteo round-trips.
  const sitesWithConso = await prisma.site.findMany({
    where: {
      organizationId,
      consumptions: { some: {} },
    },
    select: { id: true },
  });

  if (sitesWithConso.length === 0) {
    return { updated: 0, total: 0, errors: [] };
  }

  return syncDjuForSites(
    sitesWithConso.map((s) => s.id),
    organizationId,
    true // overwrite — we want fresh DJU on every nightly run
  );
}
