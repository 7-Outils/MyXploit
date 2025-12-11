import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// French weather stations with coordinates (for reference/fallback)
const WEATHER_STATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  ORLY: { lat: 48.7167, lon: 2.4, name: "Paris-Orly" },
  "PARIS-MONTSOURIS": { lat: 48.8222, lon: 2.3378, name: "Paris-Montsouris" },
  TRAPPES: { lat: 48.7744, lon: 2.0097, name: "Trappes" },
  "LYON-BRON": { lat: 45.7267, lon: 4.9433, name: "Lyon-Bron" },
  MARSEILLE: { lat: 43.4392, lon: 5.2214, name: "Marseille" },
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
};

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
          latitude: true,
          longitude: true,
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
              latitude: true,
              longitude: true,
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

    // Fetch DJU for each unique location
    const locationMap = new Map<
      string,
      { lat: number; lon: number; station: string | null; djuData: DJUData[] | null }
    >();

    for (const site of sites) {
      let lat = site.latitude;
      let lon = site.longitude;
      let station = site.stationMeteo;

      // If no coordinates, try to use station
      if (!lat || !lon) {
        if (station && WEATHER_STATIONS[station]) {
          lat = WEATHER_STATIONS[station].lat;
          lon = WEATHER_STATIONS[station].lon;
        } else {
          // Default to Paris if nothing available
          lat = 48.8566;
          lon = 2.3522;
          station = "PARIS-MONTSOURIS";
        }
      }

      const locationKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, { lat, lon, station, djuData: null });
      }
    }

    // Fetch weather data for each unique location
    for (const [key, location] of locationMap) {
      try {
        const djuData = await fetchWeatherData(
          location.lat,
          location.lon,
          startDate,
          endDate
        );
        locationMap.set(key, { ...location, djuData });
      } catch (error) {
        console.error(`Error fetching DJU for ${key}:`, error);
        locationMap.set(key, { ...location, djuData: [] });
      }
    }

    // Calculate results for each site
    const siteResults = sites.map((site) => {
      let lat = site.latitude;
      let lon = site.longitude;
      let station = site.stationMeteo;

      if (!lat || !lon) {
        if (station && WEATHER_STATIONS[station]) {
          lat = WEATHER_STATIONS[station].lat;
          lon = WEATHER_STATIONS[station].lon;
        } else {
          lat = 48.8566;
          lon = 2.3522;
          station = "PARIS-MONTSOURIS";
        }
      }

      const locationKey = `${lat!.toFixed(2)},${lon!.toFixed(2)}`;
      const locationData = locationMap.get(locationKey);
      const djuData = locationData?.djuData || [];

      // Calculate totals
      const djuTotal = djuData.reduce((sum, d) => sum + d.dju, 0);

      // Calculate monthly breakdown
      const monthlyDju: Record<string, { dju: number; days: number; avgTemp: number }> = {};
      djuData.forEach((d) => {
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

      // Get DJU trentenaire
      const djuTrentenaire = station
        ? DJU_TRENTENAIRES[station] || 2400
        : site.djuContractuel || 2400;

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
        station: station || "Paris (défaut)",
        latitude: lat,
        longitude: lon,
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
        dailyData: djuData.slice(-30).map((d) => ({
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
