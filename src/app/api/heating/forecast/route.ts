import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { computeHeatingSignal } from "@/lib/heating-season";
import { fetchDailyTemps } from "@/lib/heating-weather";
import { todayParisIso } from "@/lib/heating-status";

export const dynamic = "force-dynamic";

/**
 * GET /api/heating/forecast?lat=45.76&lon=4.83
 * Signal allumage/arrêt + dates projetées sur 15 jours pour un point
 * quelconque (outil Chauffage, hors contrat).
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

    const today = todayParisIso();
    try {
      const daily = await fetchDailyTemps(lat, lon);
      return NextResponse.json({ today, weather: computeHeatingSignal(daily, today) });
    } catch (e) {
      console.warn("[heating-forecast] météo indisponible:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Météo indisponible pour le moment" }, { status: 502 });
    }
  } catch (error) {
    console.error("Error fetching heating forecast:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
