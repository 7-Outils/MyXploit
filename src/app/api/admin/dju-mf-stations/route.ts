import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/admin/dju-mf-stations?dept=93
 *
 * Liste les stations climatologiques quotidiennes d'un département via MF.
 * Utile pour découvrir les ids de station (8 chiffres) à mapper dans
 * MF_STATION_IDS de dju-meteo-france.ts.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }
    const apiKey = process.env.METEO_FRANCE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "METEO_FRANCE_API_KEY missing" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const dept = searchParams.get("dept") ?? "93";

    const url = `https://portail-api.meteofrance.fr/public/DPClim/v1/liste-stations/quotidienne?id-departement=${encodeURIComponent(
      dept
    )}`;
    const res = await fetch(url, { headers: { apikey: apiKey } });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `MF ${res.status}`, body: txt.slice(0, 500) },
        { status: res.status }
      );
    }
    const stations = await res.json();
    return NextResponse.json({ dept, count: Array.isArray(stations) ? stations.length : 0, stations });
  } catch (error) {
    console.error("[dju-mf-stations] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
