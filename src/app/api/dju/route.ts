import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Stations météo françaises avec coordonnées et nom complet
const WEATHER_STATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  ORLY: { lat: 48.7167, lon: 2.4, name: "Paris-Orly" },
  "PARIS-MONTSOURIS": { lat: 48.8222, lon: 2.3378, name: "Paris-Montsouris" },
  TRAPPES: { lat: 48.7744, lon: 2.0097, name: "Trappes" },
  "LYON-BRON": { lat: 45.7267, lon: 4.9433, name: "Lyon-Bron" },
  MARSEILLE: { lat: 43.4392, lon: 5.2214, name: "Marseille-Marignane" },
  LILLE: { lat: 50.5617, lon: 3.0892, name: "Lille-Lesquin" },
  BORDEAUX: { lat: 44.8306, lon: -0.6914, name: "Bordeaux-Mérignac" },
  TOULOUSE: { lat: 43.6294, lon: 1.3678, name: "Toulouse-Blagnac" },
  NANTES: { lat: 47.1533, lon: -1.6106, name: "Nantes-Atlantique" },
  STRASBOURG: { lat: 48.5494, lon: 7.6372, name: "Strasbourg-Entzheim" },
  NICE: { lat: 43.6653, lon: 7.2103, name: "Nice-Côte d'Azur" },
  RENNES: { lat: 48.0686, lon: -1.7342, name: "Rennes-Saint-Jacques" },
  CLERMONT: { lat: 45.7867, lon: 3.1497, name: "Clermont-Ferrand" },
  NANCY: { lat: 48.6936, lon: 6.2222, name: "Nancy-Essey" },
  GRENOBLE: { lat: 45.3628, lon: 5.3294, name: "Grenoble-Saint-Geoirs" },
  DIJON: { lat: 47.2686, lon: 5.0878, name: "Dijon-Longvic" },
  TOURS: { lat: 47.4325, lon: 0.7278, name: "Tours" },
  ROUEN: { lat: 49.3867, lon: 1.1817, name: "Rouen-Boos" },
  MONTPELLIER: { lat: 43.5764, lon: 3.9631, name: "Montpellier-Fréjorgues" },
  BREST: { lat: 48.4478, lon: -4.4186, name: "Brest-Guipavas" },
  LIMOGES: { lat: 45.8628, lon: 1.1794, name: "Limoges-Bellegarde" },
  POITIERS: { lat: 46.5878, lon: 0.3067, name: "Poitiers-Biard" },
  ORLEANS: { lat: 47.9878, lon: 1.7606, name: "Orléans-Bricy" },
  REIMS: { lat: 49.3100, lon: 4.0650, name: "Reims-Prunay" },
  METZ: { lat: 49.0775, lon: 6.1317, name: "Metz-Frescaty" },
  CAEN: { lat: 49.1733, lon: -0.4500, name: "Caen-Carpiquet" },
  "LE-MANS": { lat: 47.9486, lon: 0.1117, name: "Le Mans-Arnage" },
  ANGERS: { lat: 47.4397, lon: -0.5614, name: "Angers-Marcé" },
  BESANCON: { lat: 47.2547, lon: 5.9928, name: "Besançon" },
  PAU: { lat: 43.3800, lon: -0.4186, name: "Pau-Uzein" },
  PERPIGNAN: { lat: 42.7400, lon: 2.8700, name: "Perpignan-Rivesaltes" },
  AJACCIO: { lat: 41.9236, lon: 8.8028, name: "Ajaccio" },
  BASTIA: { lat: 42.5528, lon: 9.4836, name: "Bastia-Poretta" },
};

// Mapping département (2 premiers chiffres du code postal) -> station météo la plus proche
const DEPT_TO_STATION: Record<string, string> = {
  // Île-de-France
  "75": "PARIS-MONTSOURIS", // Paris
  "77": "TRAPPES",          // Seine-et-Marne
  "78": "TRAPPES",          // Yvelines
  "91": "ORLY",             // Essonne
  "92": "PARIS-MONTSOURIS", // Hauts-de-Seine
  "93": "PARIS-MONTSOURIS", // Seine-Saint-Denis
  "94": "ORLY",             // Val-de-Marne
  "95": "TRAPPES",          // Val-d'Oise
  // Hauts-de-France
  "02": "REIMS",            // Aisne
  "59": "LILLE",            // Nord
  "60": "TRAPPES",          // Oise
  "62": "LILLE",            // Pas-de-Calais
  "80": "LILLE",            // Somme
  // Grand Est
  "08": "REIMS",            // Ardennes
  "10": "REIMS",            // Aube
  "51": "REIMS",            // Marne
  "52": "NANCY",            // Haute-Marne
  "54": "NANCY",            // Meurthe-et-Moselle
  "55": "NANCY",            // Meuse
  "57": "METZ",             // Moselle
  "67": "STRASBOURG",       // Bas-Rhin
  "68": "STRASBOURG",       // Haut-Rhin
  "88": "NANCY",            // Vosges
  // Normandie
  "14": "CAEN",             // Calvados
  "27": "ROUEN",            // Eure
  "50": "CAEN",             // Manche
  "61": "CAEN",             // Orne
  "76": "ROUEN",            // Seine-Maritime
  // Bretagne
  "22": "RENNES",           // Côtes-d'Armor
  "29": "BREST",            // Finistère
  "35": "RENNES",           // Ille-et-Vilaine
  "56": "RENNES",           // Morbihan
  // Pays de la Loire
  "44": "NANTES",           // Loire-Atlantique
  "49": "ANGERS",           // Maine-et-Loire
  "53": "LE-MANS",          // Mayenne
  "72": "LE-MANS",          // Sarthe
  "85": "NANTES",           // Vendée
  // Centre-Val de Loire
  "18": "ORLEANS",          // Cher
  "28": "ORLEANS",          // Eure-et-Loir
  "36": "TOURS",            // Indre
  "37": "TOURS",            // Indre-et-Loire
  "41": "TOURS",            // Loir-et-Cher
  "45": "ORLEANS",          // Loiret
  // Bourgogne-Franche-Comté
  "21": "DIJON",            // Côte-d'Or
  "25": "BESANCON",         // Doubs
  "39": "BESANCON",         // Jura
  "58": "DIJON",            // Nièvre
  "70": "BESANCON",         // Haute-Saône
  "71": "DIJON",            // Saône-et-Loire
  "89": "DIJON",            // Yonne
  "90": "BESANCON",         // Territoire de Belfort
  // Nouvelle-Aquitaine
  "16": "POITIERS",         // Charente
  "17": "BORDEAUX",         // Charente-Maritime
  "19": "LIMOGES",          // Corrèze
  "23": "LIMOGES",          // Creuse
  "24": "BORDEAUX",         // Dordogne
  "33": "BORDEAUX",         // Gironde
  "40": "BORDEAUX",         // Landes
  "47": "BORDEAUX",         // Lot-et-Garonne
  "64": "PAU",              // Pyrénées-Atlantiques
  "79": "POITIERS",         // Deux-Sèvres
  "86": "POITIERS",         // Vienne
  "87": "LIMOGES",          // Haute-Vienne
  // Occitanie
  "09": "TOULOUSE",         // Ariège
  "11": "MONTPELLIER",      // Aude
  "12": "TOULOUSE",         // Aveyron
  "30": "MONTPELLIER",      // Gard
  "31": "TOULOUSE",         // Haute-Garonne
  "32": "TOULOUSE",         // Gers
  "34": "MONTPELLIER",      // Hérault
  "46": "TOULOUSE",         // Lot
  "48": "MONTPELLIER",      // Lozère
  "65": "PAU",              // Hautes-Pyrénées
  "66": "PERPIGNAN",        // Pyrénées-Orientales
  "81": "TOULOUSE",         // Tarn
  "82": "TOULOUSE",         // Tarn-et-Garonne
  // Auvergne-Rhône-Alpes
  "01": "LYON-BRON",        // Ain
  "03": "CLERMONT",         // Allier
  "07": "LYON-BRON",        // Ardèche
  "15": "CLERMONT",         // Cantal
  "26": "GRENOBLE",         // Drôme
  "38": "GRENOBLE",         // Isère
  "42": "LYON-BRON",        // Loire
  "43": "CLERMONT",         // Haute-Loire
  "63": "CLERMONT",         // Puy-de-Dôme
  "69": "LYON-BRON",        // Rhône
  "73": "GRENOBLE",         // Savoie
  "74": "GRENOBLE",         // Haute-Savoie
  // PACA
  "04": "NICE",             // Alpes-de-Haute-Provence
  "05": "GRENOBLE",         // Hautes-Alpes
  "06": "NICE",             // Alpes-Maritimes
  "13": "MARSEILLE",        // Bouches-du-Rhône
  "83": "MARSEILLE",        // Var
  "84": "MARSEILLE",        // Vaucluse
  // Corse
  "2A": "AJACCIO",          // Corse-du-Sud
  "2B": "BASTIA",           // Haute-Corse
  "20": "AJACCIO",          // Corse (ancien code)
};

// DJU trentenaires par station (moyennes 1991-2020, base 18°C)
const DJU_TRENTENAIRES: Record<string, number> = {
  ORLY: 2450,
  "PARIS-MONTSOURIS": 2400,
  TRAPPES: 2500,
  "LYON-BRON": 2250,
  MARSEILLE: 1550,
  LILLE: 2700,
  BORDEAUX: 1850,
  TOULOUSE: 1850,
  NANTES: 2100,
  STRASBOURG: 2800,
  NICE: 1250,
  RENNES: 2200,
  CLERMONT: 2400,
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

    // Define heating season period (July N-1 to June N)
    const startDate = `${year - 1}-07-01`;
    const today = new Date();
    const endDate =
      today.getFullYear() === year && today.getMonth() < 6
        ? today.toISOString().split("T")[0]
        : `${year}-06-30`;

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
      const djuData = stationInfo?.djuData || [];

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
      };
    });

    // Calculate global summary
    const totalDjuReel = siteResults.reduce((sum, s) => sum + s.djuReel, 0) / siteResults.length;
    const totalDjuTrentenaire =
      siteResults.reduce((sum, s) => sum + s.djuTrentenaire, 0) / siteResults.length;
    const totalDjuTrentenaireToDate =
      siteResults.reduce((sum, s) => sum + s.djuTrentenaireToDate, 0) / siteResults.length;

    // Aggregate monthly data
    const monthlyAggregated = new Map<string, { dju: number; count: number }>();
    siteResults.forEach((site) => {
      site.monthlyData.forEach((m) => {
        const existing = monthlyAggregated.get(m.month) || { dju: 0, count: 0 };
        existing.dju += m.dju;
        existing.count += 1;
        monthlyAggregated.set(m.month, existing);
      });
    });

    const globalMonthlyData = Array.from(monthlyAggregated.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: formatMonthLabel(month),
        dju: Math.round(data.dju / data.count),
      }));

    return NextResponse.json({
      year,
      period: { start: startDate, end: endDate },
      summary: {
        djuReelMoyen: Math.round(totalDjuReel),
        djuTrentenaireMoyen: Math.round(totalDjuTrentenaire),
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
      sites: siteResults,
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
