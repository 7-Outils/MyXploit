import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { computeHeatingSignal } from "@/lib/heating-season";
import { fetchDailyTemps } from "@/lib/heating-weather";
import { todayParisIso } from "@/lib/heating-status";
import { HEATING_PROFILE_THRESHOLDS } from "@/lib/heating-profiles";
import { adjustForSchoolHolidays, fetchSchoolHolidays, schoolZoneOf } from "@/lib/school-holidays";

export const dynamic = "force-dynamic";

/**
 * GET /api/heating/forecast?lat=45.76&lon=4.83&profile=STANDARD[&school=1&postcode=69001]
 * Signal allumage/arrêt + dates projetées sur 15 jours pour un point
 * quelconque (outil Chauffage, hors contrat). `school=1` cale les dates sur
 * le calendrier scolaire de la zone du code postal.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
    }

    const profileParam = searchParams.get("profile") ?? "STANDARD";
    const thresholds = HEATING_PROFILE_THRESHOLDS[profileParam as keyof typeof HEATING_PROFILE_THRESHOLDS];
    if (!thresholds) return NextResponse.json({ error: "Profil inconnu" }, { status: 400 });
    const school = searchParams.get("school") === "1";
    const zone = school ? schoolZoneOf(searchParams.get("postcode")) : null;

    const today = todayParisIso();
    try {
      const daily = await fetchDailyTemps(lat, lon);
      const weather = computeHeatingSignal(daily, today, thresholds);
      let startNote: string | null = null;
      let stopNote: string | null = null;
      if (zone) {
        try {
          const holidays = await fetchSchoolHolidays(zone, today);
          if (weather.startDate) ({ date: weather.startDate, note: startNote } = adjustForSchoolHolidays(weather.startDate, "start", holidays));
          if (weather.stopDate) ({ date: weather.stopDate, note: stopNote } = adjustForSchoolHolidays(weather.stopDate, "stop", holidays));
          weather.signal = weather.stopDate === today ? "STOP" : weather.startDate === today ? "START" : "NEUTRAL";
        } catch (e) {
          console.warn("[heating-forecast] calendrier scolaire indisponible:", e instanceof Error ? e.message : e);
        }
      }
      return NextResponse.json({ today, weather, startNote, stopNote, zone });
    } catch (e) {
      console.warn("[heating-forecast] météo indisponible:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Météo indisponible pour le moment" }, { status: 502 });
    }
  } catch (error) {
    console.error("Error fetching heating forecast:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
