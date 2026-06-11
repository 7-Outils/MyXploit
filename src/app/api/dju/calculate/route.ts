import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  WEATHER_STATIONS,
  resolveStationKey,
  getStationFromPostalCode,
} from "@/lib/dju-sync";
import {
  fetchDjuFromMeteoFrance,
  METEO_FRANCE_STATION_KEYS,
} from "@/lib/dju-meteo-france";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

function monthLabel(month: string): string {
  const m = parseInt(month.split("-")[1], 10);
  return `${MONTH_LABELS[m - 1] || month} ${month.split("-")[0]}`;
}

/**
 * GET /api/dju/calculate
 *
 * Outil de calcul DJU autonome (Boîte à outils). Deux modes :
 *   - ?list=1 → liste des stations couvertes par Météo France (pour la carte).
 *   - ?station=ORLY|?postalCode=91270 &start=YYYY-MM-DD &end=YYYY-MM-DD
 *       → DJU base 18°C, méthode COSTIC, données Météo France (DPClim).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);

    // Mode liste des stations (pour peupler le menu déroulant côté client)
    if (searchParams.get("list") === "1") {
      const stations = Object.entries(WEATHER_STATIONS)
        // Seulement les stations couvertes par Météo France (pas d'erreur au clic)
        .filter(([key]) => METEO_FRANCE_STATION_KEYS.has(key))
        .map(([key, { name, lat, lon }]) => ({
          key,
          name,
          lat,
          lon,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
      return NextResponse.json({ stations });
    }

    const station = searchParams.get("station");
    const postalCode = searchParams.get("postalCode");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Dates 'start' et 'end' requises (format YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: "La date de début doit être antérieure à la date de fin" },
        { status: 400 }
      );
    }
    if (!station && !postalCode) {
      return NextResponse.json(
        { error: "Station ou code postal requis" },
        { status: 400 }
      );
    }

    // Résolution de la station (clé explicite prioritaire, sinon code postal)
    const stationKey =
      resolveStationKey(station) ?? getStationFromPostalCode(postalCode);
    const coords = WEATHER_STATIONS[stationKey];
    if (!coords) {
      return NextResponse.json(
        { error: "Station météo introuvable" },
        { status: 404 }
      );
    }

    // DJU journaliers (Map<date, dju>) — Météo France UNIQUEMENT (DPClim, formule
    // COSTIC). Pas de fallback Open-Meteo : on veut la donnée officielle MF.
    const byDay = await fetchDjuFromMeteoFrance(stationKey, start, end);

    if (byDay.size === 0) {
      return NextResponse.json(
        {
          error:
            "Aucune donnée Météo France pour cette station/période (station non couverte par Météo France, ou données pas encore publiées).",
        },
        { status: 422 }
      );
    }

    // Agrégats
    let total = 0;
    const monthly = new Map<string, { dju: number; days: number }>();
    const dates = [...byDay.keys()].sort();
    for (const date of dates) {
      const dju = byDay.get(date)!;
      total += dju;
      const m = date.substring(0, 7); // YYYY-MM
      const cur = monthly.get(m) ?? { dju: 0, days: 0 };
      cur.dju += dju;
      cur.days += 1;
      monthly.set(m, cur);
    }

    const monthlyData = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: monthLabel(month),
        dju: Math.round(v.dju),
        days: v.days,
      }));

    return NextResponse.json(
      {
        station: coords.name,
        stationKey,
        period: { start: dates[0], end: dates[dates.length - 1] },
        days: byDay.size,
        djuTotal: Math.round(total),
        monthlyData,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error calculating DJU:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des DJU" },
      { status: 500 }
    );
  }
}
