import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Force dynamic rendering - disable caching for this route
export const dynamic = 'force-dynamic';

// Stations météo COSTIC avec coordonnées et nom complet
// Source: Plaquette DJU COSTIC - 102 stations réparties sur la France
const WEATHER_STATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  // Île-de-France
  "PARIS-MONTSOURIS": { lat: 48.8222, lon: 2.3378, name: "Paris-Montsouris" },
  "LE-BOURGET": { lat: 48.9694, lon: 2.4414, name: "Paris-Le Bourget" },
  ORLY: { lat: 48.7167, lon: 2.4, name: "Paris-Orly" },
  MELUN: { lat: 48.5961, lon: 2.6750, name: "Melun" },
  VILLACOUBLAY: { lat: 48.7744, lon: 2.2017, name: "Villacoublay" },
  // Grandes métropoles
  "LYON-BRON": { lat: 45.7267, lon: 4.9433, name: "Lyon-Bron" },
  MARIGNANE: { lat: 43.4392, lon: 5.2214, name: "Marseille-Marignane" },
  LILLE: { lat: 50.5617, lon: 3.0892, name: "Lille-Lesquin" },
  BORDEAUX: { lat: 44.8306, lon: -0.6914, name: "Bordeaux-Mérignac" },
  TOULOUSE: { lat: 43.6294, lon: 1.3678, name: "Toulouse-Blagnac" },
  NANTES: { lat: 47.1533, lon: -1.6106, name: "Nantes-Atlantique" },
  STRASBOURG: { lat: 48.5494, lon: 7.6372, name: "Strasbourg-Entzheim" },
  NICE: { lat: 43.6653, lon: 7.2103, name: "Nice" },
  RENNES: { lat: 48.0686, lon: -1.7342, name: "Rennes" },
  // Autres stations COSTIC
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
  // Stations additionnelles COSTIC
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

// Mapping département (2 premiers chiffres du code postal) -> station météo la plus proche
// Source: Plaquette DJU COSTIC
const DEPT_TO_STATION: Record<string, string> = {
  // Île-de-France
  "75": "PARIS-MONTSOURIS", // Paris
  "77": "MELUN",            // Seine-et-Marne
  "78": "VILLACOUBLAY",     // Yvelines
  "91": "ORLY",             // Essonne
  "92": "PARIS-MONTSOURIS", // Hauts-de-Seine
  "93": "LE-BOURGET",       // Seine-Saint-Denis
  "94": "ORLY",             // Val-de-Marne
  "95": "LE-BOURGET",       // Val-d'Oise (Gonesse, etc.)
  // Hauts-de-France
  "02": "SAINT-QUENTIN",    // Aisne
  "59": "LILLE",            // Nord
  "60": "BEAUVAIS",         // Oise
  "62": "LILLE",            // Pas-de-Calais
  "80": "ABBEVILLE",        // Somme
  // Grand Est
  "08": "CHARLEVILLE-MEZIERES", // Ardennes
  "10": "TROYES",               // Aube
  "51": "REIMS",                // Marne
  "52": "NANCY",                // Haute-Marne
  "54": "NANCY",                // Meurthe-et-Moselle
  "55": "NANCY",                // Meuse
  "57": "METZ",                 // Moselle
  "67": "STRASBOURG",           // Bas-Rhin
  "68": "MULHOUSE",             // Haut-Rhin
  "88": "NANCY",                // Vosges
  // Normandie
  "14": "CAEN",                 // Calvados
  "27": "EVREUX",               // Eure
  "50": "CAEN",                 // Manche
  "61": "CAEN",                 // Orne
  "76": "ROUEN",                // Seine-Maritime
  // Bretagne
  "22": "SAINT-BRIEUC",         // Côtes-d'Armor
  "29": "BREST",                // Finistère
  "35": "RENNES",               // Ille-et-Vilaine
  "56": "LORIENT",              // Morbihan
  // Pays de la Loire
  "44": "NANTES",               // Loire-Atlantique
  "49": "ANGERS",               // Maine-et-Loire
  "53": "LAVAL",                // Mayenne
  "72": "LE-MANS",              // Sarthe
  "85": "NANTES",               // Vendée
  // Centre-Val de Loire
  "18": "BOURGES",              // Cher
  "28": "CHATEAUDUN",           // Eure-et-Loir
  "36": "CHATEAUROUX",          // Indre
  "37": "TOURS",                // Indre-et-Loire
  "41": "TOURS",                // Loir-et-Cher
  "45": "ORLEANS",              // Loiret
  // Bourgogne-Franche-Comté
  "21": "DIJON",                // Côte-d'Or
  "25": "BESANCON",             // Doubs
  "39": "BESANCON",             // Jura
  "58": "NEVERS",               // Nièvre
  "70": "BESANCON",             // Haute-Saône
  "71": "DIJON",                // Saône-et-Loire
  "89": "AUXERRE",              // Yonne
  "90": "BESANCON",             // Territoire de Belfort
  // Nouvelle-Aquitaine
  "16": "COGNAC",               // Charente
  "17": "LA-ROCHELLE",          // Charente-Maritime
  "19": "BRIVE",                // Corrèze
  "23": "LIMOGES",              // Creuse
  "24": "BORDEAUX",             // Dordogne
  "33": "BORDEAUX",             // Gironde
  "40": "BORDEAUX",             // Landes
  "47": "AGEN",                 // Lot-et-Garonne
  "64": "PAU",                  // Pyrénées-Atlantiques
  "79": "NIORT",                // Deux-Sèvres
  "86": "POITIERS",             // Vienne
  "87": "LIMOGES",              // Haute-Vienne
  // Occitanie
  "09": "TOULOUSE",           // Ariège
  "11": "PERPIGNAN",          // Aude
  "12": "TOULOUSE",           // Aveyron
  "30": "NIMES",              // Gard
  "31": "TOULOUSE",           // Haute-Garonne
  "32": "AGEN",               // Gers
  "34": "MONTPELLIER",        // Hérault
  "46": "TOULOUSE",           // Lot
  "48": "MONTPELLIER",        // Lozère
  "65": "PAU",                // Hautes-Pyrénées
  "66": "PERPIGNAN",          // Pyrénées-Orientales
  "81": "TOULOUSE",           // Tarn
  "82": "AGEN",               // Tarn-et-Garonne
  // Auvergne-Rhône-Alpes
  "01": "LYON-BRON",           // Ain
  "03": "VICHY",               // Allier
  "07": "MONTELIMAR",          // Ardèche
  "15": "AURILLAC",            // Cantal
  "26": "MONTELIMAR",          // Drôme
  "38": "GRENOBLE",            // Isère
  "42": "SAINT-ETIENNE",       // Loire
  "43": "CLERMONT-FERRAND",    // Haute-Loire
  "63": "CLERMONT-FERRAND",    // Puy-de-Dôme
  "69": "LYON-BRON",           // Rhône
  "73": "GRENOBLE",            // Savoie
  "74": "GRENOBLE",            // Haute-Savoie
  // PACA
  "04": "NICE",                // Alpes-de-Haute-Provence
  "05": "GRENOBLE",            // Hautes-Alpes
  "06": "NICE",                // Alpes-Maritimes
  "13": "MARIGNANE",           // Bouches-du-Rhône
  "83": "TOULON",              // Var
  "84": "ORANGE",              // Vaucluse
  // Corse
  "2A": "AJACCIO",          // Corse-du-Sud
  "2B": "BASTIA",           // Haute-Corse
  "20": "AJACCIO",          // Corse (ancien code)
};

// DJU trentenaires par station (moyennes 1991-2020, base 18°C)
// Source: Plaquette DJU COSTIC
const DJU_TRENTENAIRES: Record<string, number> = {
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

// Déterminer la station météo à partir du code postal
function getStationFromPostalCode(postalCode: string | null): string {
  if (!postalCode) return "PARIS-MONTSOURIS";

  // Gérer la Corse (codes 20xxx, 2Axxx, 2Bxxx)
  if (postalCode.startsWith("20")) {
    const num = parseInt(postalCode.substring(0, 3));
    if (num >= 200 && num <= 201) return "AJACCIO"; // Corse-du-Sud
    if (num >= 202 && num <= 206) return "BASTIA"; // Haute-Corse
    return "AJACCIO";
  }

  // Extraire le département (2 premiers chiffres)
  const dept = postalCode.substring(0, 2);

  return DEPT_TO_STATION[dept] || "PARIS-MONTSOURIS";
}

// DJU trentenaires mensuels moyens (proportion du total annuel)
const DJU_MONTHLY_RATIO: Record<string, number> = {
  "01": 0.18, // Janvier
  "02": 0.15, // Février
  "03": 0.12, // Mars
  "04": 0.08, // Avril
  "05": 0.03, // Mai
  "06": 0.01, // Juin
  "07": 0.00, // Juillet
  "08": 0.00, // Août
  "09": 0.02, // Septembre
  "10": 0.07, // Octobre
  "11": 0.13, // Novembre
  "12": 0.17, // Décembre
};

interface DJUData {
  date: string;
  tMin: number;
  tMax: number;
  tMoy: number;
  dju: number;
}

// Calculate DJU from temperature (base 18°C unified method)
function calculateDJU(tMoy: number): number {
  return Math.max(0, 18 - tMoy);
}

// Fetch weather data from Open-Meteo
async function fetchWeatherData(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<DJUData[]> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=Europe/Paris`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.daily || !data.daily.time) {
    return [];
  }

  const results: DJUData[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    const tMin = data.daily.temperature_2m_min[i];
    const tMax = data.daily.temperature_2m_max[i];
    const tMoy = data.daily.temperature_2m_mean[i] ?? (tMin + tMax) / 2;

    results.push({
      date: data.daily.time[i],
      tMin,
      tMax,
      tMoy,
      dju: calculateDJU(tMoy),
    });
  }

  return results;
}

// GET /api/dju - Get DJU data for contract sites
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const contractId = searchParams.get("contractId");
    const siteId = searchParams.get("siteId");
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : new Date().getFullYear();

    if (!contractId && !siteId) {
      return NextResponse.json(
        { error: "contractId ou siteId requis" },
        { status: 400 }
      );
    }

    // Get sites
    let sites;
    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: user.organizationId },
        select: {
          id: true,
          name: true,
          city: true,
          postalCode: true,
          stationMeteo: true,
          djuContractuel: true,
        },
      });
      sites = site ? [site] : [];
    } else {
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId: contractId! },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              city: true,
              postalCode: true,
              stationMeteo: true,
              djuContractuel: true,
            },
          },
        },
      });
      sites = contractSites.map((cs) => cs.site);
    }

    if (sites.length === 0) {
      return NextResponse.json({ sites: [], summary: null });
    }

    // Récupérer les saisons de chauffage pour tous les sites
    const season = `${year - 1}-${year}`; // Ex: "2024-2025"
    const heatingSeasons = await prisma.heatingSeason.findMany({
      where: {
        siteId: { in: sites.map((s) => s.id) },
        season,
      },
    });

    // Map des saisons par siteId
    const heatingSeasonMap = new Map(
      heatingSeasons.map((hs) => [hs.siteId, hs])
    );

    // Récupérer la date du dernier relevé/consommation pour chaque site
    // (utilisé quand la saison est en cours, pas de date de fin)
    const lastConsumptions = await prisma.consumption.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: sites.map((s) => s.id) },
        period: {
          gte: new Date(`${year - 1}-07-01`),
          lte: new Date(`${year}-06-30`),
        },
      },
      _max: { period: true },
    });
    const lastConsumptionMap = new Map(
      lastConsumptions.map((lc) => [lc.siteId, lc._max.period])
    );

    // Déterminer la période globale (min startDate, max endDate)
    const today = new Date();
    let globalStartDate = new Date(`${year - 1}-07-01`); // Fallback: 1er juillet N-1

    // Trouver la date max nécessaire: max entre les dates de fin de saison et les derniers relevés
    let maxNeededDate = new Date(`${year - 1}-07-01`);
    heatingSeasons.forEach((hs) => {
      if (hs.startDate && hs.startDate < globalStartDate) {
        globalStartDate = hs.startDate;
      }
      if (hs.endDate && hs.endDate > maxNeededDate) {
        maxNeededDate = hs.endDate;
      }
    });
    lastConsumptions.forEach((lc) => {
      if (lc._max.period) {
        // period = 1er du mois de consommation (normalisé dans import IDEX)
        // Ex: period = 01/12 → consommation de décembre
        // Use period directly (it already represents the consumption month)
        if (lc._max.period > maxNeededDate) {
          maxNeededDate = lc._max.period;
        }
      }
    });

    // Cap to today for Open-Meteo archive API (only historical data available)
    let globalEndDate = maxNeededDate > today ? today : maxNeededDate;

    const startDate = globalStartDate.toISOString().split("T")[0];
    const endDate = globalEndDate.toISOString().split("T")[0];

    // Fetch DJU for each unique station
    const stationMap = new Map<
      string,
      { lat: number; lon: number; stationName: string; djuData: DJUData[] | null }
    >();

    for (const site of sites) {
      // Priorité: 1) stationMeteo explicite du site, 2) code postal -> station
      let stationCode = site.stationMeteo;

      if (!stationCode || !WEATHER_STATIONS[stationCode]) {
        // Déterminer la station à partir du code postal
        stationCode = getStationFromPostalCode(site.postalCode);
      }

      const stationData = WEATHER_STATIONS[stationCode];
      if (stationData && !stationMap.has(stationCode)) {
        stationMap.set(stationCode, {
          lat: stationData.lat,
          lon: stationData.lon,
          stationName: stationData.name,
          djuData: null,
        });
      }
    }

    // Fetch weather data for each unique station
    for (const [stationCode, stationInfo] of stationMap) {
      try {
        const djuData = await fetchWeatherData(
          stationInfo.lat,
          stationInfo.lon,
          startDate,
          endDate
        );
        stationMap.set(stationCode, { ...stationInfo, djuData });
      } catch (error) {
        console.error(`Error fetching DJU for ${stationCode}:`, error);
        stationMap.set(stationCode, { ...stationInfo, djuData: [] });
      }
    }

    // Calculate results for each site
    const siteResults = sites.map((site) => {
      // Déterminer la station: priorité à stationMeteo explicite, sinon code postal
      let stationCode = site.stationMeteo;
      if (!stationCode || !WEATHER_STATIONS[stationCode]) {
        stationCode = getStationFromPostalCode(site.postalCode);
      }

      const stationInfo = stationMap.get(stationCode);
      const stationData = WEATHER_STATIONS[stationCode];
      const allDjuData = stationInfo?.djuData || [];

      // Récupérer la saison de chauffage du site
      const heatingSeason = heatingSeasonMap.get(site.id);

      // Déterminer les dates de la période de chauffage pour ce site
      let siteStartDate: Date;
      let siteEndDate: Date;

      // Date du dernier relevé pour ce site (si saison en cours)
      const lastConsumptionDate = lastConsumptionMap.get(site.id);

      // Check if heatingSeason has a real start date (not null)
      // After the schema change, startDate is null until IDEX import sets it
      const hasRealStartDate = !!heatingSeason?.startDate;

      if (heatingSeason && hasRealStartDate) {
        // Utiliser les dates de la saison de chauffage
        siteStartDate = heatingSeason.startDate!; // Safe: already checked by hasRealStartDate

        if (heatingSeason.endDate) {
          // endDate = date exacte du dernier relevé (pas normalisée)
          // Ex: si relevé le 04/11, endDate = 04/11 → calculer DJU jusqu'au 04/11
          siteEndDate = heatingSeason.endDate;
        } else if (lastConsumptionDate) {
          // Fallback: utiliser la date exacte du dernier relevé
          siteEndDate = lastConsumptionDate;
        } else {
          // Pas de relevé encore: utiliser la date de début
          siteEndDate = heatingSeason.startDate!; // Safe: already checked by hasRealStartDate
        }
      } else {
        // Fallback: période par défaut (1er oct - 30 avril)
        // Used when no HeatingSeason or when startDate is the default July 1st
        siteStartDate = new Date(`${year - 1}-10-01`);
        if (lastConsumptionDate) {
          // period = 1er du mois du relevé, donc conso jusqu'à period - 1 jour
          siteEndDate = new Date(lastConsumptionDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          const defaultEndDate = new Date(`${year}-04-30`);
          siteEndDate = defaultEndDate > today ? today : defaultEndDate;
        }
      }

      // Cap siteEndDate to today (Open-Meteo only has historical data)
      if (siteEndDate > today) {
        siteEndDate = today;
      }

      // Convert dates to YYYY-MM-DD strings for comparison (avoid timezone issues)
      const startDateStr = siteStartDate.toISOString().split("T")[0];
      const endDateStr = siteEndDate.toISOString().split("T")[0];

      console.log(`[DJU] Site ${site.name}: ${startDateStr} → ${endDateStr}`);

      // Filtrer les données DJU selon la période de chauffage du site
      const djuData = allDjuData.filter((d: DJUData) => {
        // d.date is already YYYY-MM-DD string from weather API
        return d.date >= startDateStr && d.date <= endDateStr;
      });

      console.log(`[DJU] Site ${site.name}: ${djuData.length} jours, total=${djuData.reduce((s, d) => s + d.dju, 0)}`);

      // Calculate totals
      const djuTotal = djuData.reduce((sum: number, d: DJUData) => sum + d.dju, 0);

      // Calculate monthly breakdown
      const monthlyDju: Record<string, { dju: number; days: number; avgTemp: number }> = {};
      djuData.forEach((d: DJUData) => {
        const month = d.date.substring(0, 7); // YYYY-MM
        if (!monthlyDju[month]) {
          monthlyDju[month] = { dju: 0, days: 0, avgTemp: 0 };
        }
        monthlyDju[month].dju += d.dju;
        monthlyDju[month].days += 1;
        monthlyDju[month].avgTemp += d.tMoy;
      });

      // Calculate average temperatures
      Object.keys(monthlyDju).forEach((month) => {
        monthlyDju[month].avgTemp = monthlyDju[month].avgTemp / monthlyDju[month].days;
      });

      // Get DJU trentenaire from station or site config
      const djuTrentenaire = DJU_TRENTENAIRES[stationCode] || site.djuContractuel || 2400;

      // Calculate expected DJU to date based on trentenaire
      const monthsElapsed = Object.keys(monthlyDju);
      let djuTrentenaireToDate = 0;
      monthsElapsed.forEach((month) => {
        const monthNum = month.split("-")[1];
        djuTrentenaireToDate += djuTrentenaire * (DJU_MONTHLY_RATIO[monthNum] || 0);
      });

      return {
        siteId: site.id,
        siteName: site.name,
        city: site.city,
        postalCode: site.postalCode,
        // Nom complet de la station pour affichage
        station: stationData?.name || stationCode,
        stationCode: stationCode,
        djuContractuel: site.djuContractuel,
        djuTrentenaire,
        djuReel: Math.round(djuTotal),
        djuTrentenaireToDate: Math.round(djuTrentenaireToDate),
        ecartTrentenaire: Math.round(djuTotal - djuTrentenaireToDate),
        ecartPercent:
          djuTrentenaireToDate > 0
            ? Math.round(((djuTotal - djuTrentenaireToDate) / djuTrentenaireToDate) * 100)
            : 0,
        // Dates de la saison de chauffage
        heatingStartDate: siteStartDate.toISOString().split("T")[0],
        heatingEndDate: siteEndDate.toISOString().split("T")[0],
        hasHeatingSeason: !!heatingSeason,
        monthlyData: Object.entries(monthlyDju)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            dju: Math.round(data.dju),
            days: data.days,
            avgTemp: Math.round(data.avgTemp * 10) / 10,
          })),
        dailyData: djuData.slice(-30).map((d: DJUData) => ({
          date: d.date,
          dju: Math.round(d.dju * 10) / 10,
          tMoy: Math.round(d.tMoy * 10) / 10,
        })),
        // Flag pour savoir si le site a des relevés
        hasConsumptions: !!lastConsumptionDate,
        // Flag pour savoir si le site a un NB (engagement)
        hasNb: !!(heatingSeason?.nb),
      };
    });

    // Filtrer pour ne garder que les sites avec des relevés OU avec NB
    const sitesWithData = siteResults.filter((s) => s.hasConsumptions || s.hasNb);

    // Calculate global DJU from weather station for the entire period
    // Use the first station's data (all sites in same area use same station)
    const firstStationEntry = Array.from(stationMap.entries())[0];
    const globalStationData = firstStationEntry ? firstStationEntry[1].djuData || [] : [];

    // Calculate DJU for the global period (earliest start to latest consumption)
    let globalEarliestStart = new Date(`${year}-12-31`);
    let globalLatestEnd = new Date(`${year - 1}-01-01`);

    sitesWithData.forEach((s) => {
      const sStart = new Date(s.heatingStartDate);
      const sEnd = new Date(s.heatingEndDate);
      if (sStart < globalEarliestStart) globalEarliestStart = sStart;
      if (sEnd > globalLatestEnd) globalLatestEnd = sEnd;
    });

    // Filter station data for the global period
    const globalPeriodDju = globalStationData.filter((d: DJUData) => {
      const date = new Date(d.date);
      return date >= globalEarliestStart && date <= globalLatestEnd;
    });

    const totalDjuReel = globalPeriodDju.reduce((sum: number, d: DJUData) => sum + d.dju, 0);

    // Calculate DJU trentenaire for the same period
    const globalMonths = new Set<string>();
    globalPeriodDju.forEach((d: DJUData) => {
      globalMonths.add(d.date.substring(5, 7)); // Extract month "MM"
    });

    const avgDjuTrentenaire = firstStationEntry
      ? (DJU_TRENTENAIRES[firstStationEntry[0]] || 2450)
      : 2450;

    let totalDjuTrentenaireToDate = 0;
    globalMonths.forEach((monthNum) => {
      totalDjuTrentenaireToDate += avgDjuTrentenaire * (DJU_MONTHLY_RATIO[monthNum] || 0);
    });

    // Aggregate monthly data from station (not from sites)
    const monthlyFromStation = new Map<string, number>();
    globalPeriodDju.forEach((d: DJUData) => {
      const month = d.date.substring(0, 7); // "YYYY-MM"
      const existing = monthlyFromStation.get(month) || 0;
      monthlyFromStation.set(month, existing + d.dju);
    });

    const globalMonthlyData = Array.from(monthlyFromStation.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, dju]) => ({
        month,
        label: formatMonthLabel(month),
        dju: Math.round(dju),
      }));

    return NextResponse.json({
      year,
      period: { start: startDate, end: endDate },
      summary: {
        djuReelMoyen: Math.round(totalDjuReel),
        djuTrentenaireMoyen: Math.round(avgDjuTrentenaire),
        djuTrentenaireToDate: Math.round(totalDjuTrentenaireToDate),
        ecart: Math.round(totalDjuReel - totalDjuTrentenaireToDate),
        ecartPercent:
          totalDjuTrentenaireToDate > 0
            ? Math.round(
                ((totalDjuReel - totalDjuTrentenaireToDate) / totalDjuTrentenaireToDate) * 100
              )
            : 0,
        interpretation:
          totalDjuReel > totalDjuTrentenaireToDate
            ? "Saison plus froide que la moyenne"
            : "Saison plus douce que la moyenne",
      },
      monthlyData: globalMonthlyData,
      sites: sitesWithData,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      }
    });
  } catch (error) {
    console.error("Error fetching DJU:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des DJU" },
      { status: 500 }
    );
  }
}

function formatMonthLabel(month: string): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [, m] = month.split("-");
  return months[parseInt(m) - 1] || month;
}

// POST /api/dju - Sync DJU réels to consumption records
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier les données" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { contractId, siteId, overwrite } = body;

    if (!contractId && !siteId) {
      return NextResponse.json(
        { error: "contractId ou siteId requis" },
        { status: 400 }
      );
    }

    // Get sites
    let sites: Array<{
      id: string;
      name: string;
      postalCode: string | null;
      stationMeteo: string | null;
    }>;

    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: user.organizationId },
        select: { id: true, name: true, postalCode: true, stationMeteo: true },
      });
      sites = site ? [site] : [];
    } else {
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId: contractId! },
        include: {
          site: {
            select: { id: true, name: true, postalCode: true, stationMeteo: true },
          },
        },
      });
      sites = contractSites.map((cs) => cs.site);
    }

    if (sites.length === 0) {
      console.log("[DJU Sync] No sites found for contract:", contractId);
      return NextResponse.json({
        success: false,
        updated: 0,
        total: 0,
        errors: ["Aucun site trouvé pour ce contrat"],
      }, { status: 404 });
    }

    console.log(`[DJU Sync] Found ${sites.length} sites:`, sites.map(s => ({ name: s.name, postalCode: s.postalCode, stationMeteo: s.stationMeteo })));

    // Get consumptions that need DJU sync
    const consumptionsWhere: Record<string, unknown> = {
      siteId: { in: sites.map((s) => s.id) },
      organizationId: user.organizationId,
    };

    // Only update consumptions without djuReel unless overwrite is true
    if (!overwrite) {
      consumptionsWhere.djuReel = null;
    }

    const consumptions = await prisma.consumption.findMany({
      where: consumptionsWhere,
      select: {
        id: true,
        siteId: true,
        period: true,
        djuReel: true,
      },
      orderBy: { period: "asc" },
    });

    if (consumptions.length === 0) {
      console.log("[DJU Sync] No consumptions found for sites");
      return NextResponse.json({
        success: true,
        updated: 0,
        total: 0,
        errors: ["Aucune consommation trouvée pour les sites de ce contrat. Importez d'abord les consommations."],
      });
    }

    console.log(`[DJU Sync] Found ${consumptions.length} consumptions to update`);

    // Group consumptions by site
    const consumptionsBySite = new Map<string, typeof consumptions>();
    for (const c of consumptions) {
      const siteConsumptions = consumptionsBySite.get(c.siteId) || [];
      siteConsumptions.push(c);
      consumptionsBySite.set(c.siteId, siteConsumptions);
    }

    // For each site, fetch DJU data and update consumptions
    let updatedCount = 0;
    const errors: string[] = [];

    for (const site of sites) {
      const siteConsumptions = consumptionsBySite.get(site.id);
      if (!siteConsumptions || siteConsumptions.length === 0) continue;

      // Determine weather station
      let stationCode = site.stationMeteo;
      if (!stationCode || !WEATHER_STATIONS[stationCode]) {
        stationCode = getStationFromPostalCode(site.postalCode);
        console.log(`[DJU Sync] ${site.name}: Using station from postal code ${site.postalCode} -> ${stationCode}`);
      } else {
        console.log(`[DJU Sync] ${site.name}: Using configured station ${stationCode}`);
      }

      const stationData = WEATHER_STATIONS[stationCode];
      if (!stationData) {
        console.log(`[DJU Sync] ${site.name}: Station ${stationCode} not found in WEATHER_STATIONS`);
        errors.push(`${site.name}: Station météo non trouvée (code postal: ${site.postalCode || 'non défini'})`);
        continue;
      }

      // Find date range needed
      const periods = siteConsumptions.map((c) => c.period);
      const minDate = new Date(Math.min(...periods.map((p) => p.getTime())));
      const maxDate = new Date(Math.max(...periods.map((p) => p.getTime())));

      // Extend to cover full months
      const startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

      // Cap endDate to today (Open-Meteo only has historical data)
      const today = new Date();
      const fetchEndDate = endDate > today ? today : endDate;

      try {
        console.log(`[DJU Sync] ${site.name}: Fetching weather from ${startDate.toISOString().split("T")[0]} to ${fetchEndDate.toISOString().split("T")[0]}`);

        // Fetch weather data
        const djuData = await fetchWeatherData(
          stationData.lat,
          stationData.lon,
          startDate.toISOString().split("T")[0],
          fetchEndDate.toISOString().split("T")[0]
        );

        console.log(`[DJU Sync] ${site.name}: Got ${djuData.length} days of weather data`);

        // Calculate monthly DJU totals
        const monthlyDju = new Map<string, number>();
        for (const d of djuData) {
          const monthKey = d.date.substring(0, 7); // "YYYY-MM"
          const existing = monthlyDju.get(monthKey) || 0;
          monthlyDju.set(monthKey, existing + d.dju);
        }

        console.log(`[DJU Sync] ${site.name}: Monthly DJU:`, Object.fromEntries(monthlyDju));

        // Update each consumption with its month's DJU
        let siteUpdatedCount = 0;
        for (const consumption of siteConsumptions) {
          const monthKey = `${consumption.period.getFullYear()}-${String(consumption.period.getMonth() + 1).padStart(2, "0")}`;
          const djuForMonth = monthlyDju.get(monthKey);

          if (djuForMonth !== undefined) {
            await prisma.consumption.update({
              where: { id: consumption.id },
              data: { djuReel: Math.round(djuForMonth) },
            });
            updatedCount++;
            siteUpdatedCount++;
          }
        }
        console.log(`[DJU Sync] ${site.name}: Updated ${siteUpdatedCount} consumptions`);
      } catch (error) {
        console.error(`[DJU Sync] Error fetching DJU for site ${site.name}:`, error);
        errors.push(`${site.name}: Erreur lors de la récupération des DJU`);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: consumptions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error syncing DJU:", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation des DJU" },
      { status: 500 }
    );
  }
}
