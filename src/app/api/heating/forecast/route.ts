import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { computeHeatingSignal } from "@/lib/heating-season";
import { fetchDailyTemps } from "@/lib/heating-weather";
import { todayParisIso } from "@/lib/heating-status";
import { computeHeatingGroups, GENERIC_SITES } from "@/lib/heating-groups";
import { schoolZoneOf } from "@/lib/school-holidays";

export const dynamic = "force-dynamic";

/**
 * GET /api/heating/forecast?lat=45.76&lon=4.83[&postcode=69001]
 * Météo 7 j observés + 15 j prévus pour un point sans contrat (outil
 * Chauffage, « autre ville ») et dates d'allumage/arrêt pour chaque famille
 * de bâtiments ; le code postal sert au calendrier scolaire.
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
    const postalCode = searchParams.get("postcode") || null;

    const today = todayParisIso();
    try {
      const daily = await fetchDailyTemps(lat, lon);
      const weather = computeHeatingSignal(daily, today);
      const sites = GENERIC_SITES.map((s) => ({ ...s, postalCode }));
      const { groups, holidays } = await computeHeatingGroups(sites, daily, today);
      return NextResponse.json({ today, weather, groups, holidays, zone: schoolZoneOf(postalCode) });
    } catch (e) {
      console.warn("[heating-forecast] météo indisponible:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Météo indisponible pour le moment" }, { status: 502 });
    }
  } catch (error) {
    console.error("Error fetching heating forecast:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
