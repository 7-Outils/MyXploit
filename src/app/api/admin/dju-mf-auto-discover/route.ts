import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { WEATHER_STATIONS, DEPT_TO_STATION } from "@/lib/dju-sync";

/**
 * GET /api/admin/dju-mf-auto-discover
 *
 * Pour chaque station de WEATHER_STATIONS, trouve la station Météo France
 * la plus proche encore active (posteOuvert + typePoste 0/1/2). Renvoie un
 * mapping prêt à coller dans MF_STATION_IDS de dju-meteo-france.ts.
 *
 * Stratégie :
 *   1. Inverse DEPT_TO_STATION pour savoir quels dept(s) pointent vers chaque station
 *   2. Pour chaque dept utilisé, fetch /liste-stations/quotidienne (cache local)
 *   3. Pour chaque station COSTIC, trouve la MF la plus proche par distance
 *      haversine, filtrée sur posteOuvert + typePoste 0|1|2 (synoptique/clim)
 *   4. Renvoie { mapping, unmapped, snippet }
 */

interface MfStation {
  id: string;
  nom: string;
  posteOuvert: boolean;
  typePoste: number;
  lat: number;
  lon: number;
}

const MF_BASE = "https://portail-api.meteofrance.fr/public/DPClim/v1";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }
    const apiKey = process.env.METEO_FRANCE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "METEO_FRANCE_API_KEY missing" }, { status: 500 });
    }

    // 1. Inverse mapping station -> [dept]
    const stationToDepts: Record<string, string[]> = {};
    for (const [dept, station] of Object.entries(DEPT_TO_STATION)) {
      if (!stationToDepts[station]) stationToDepts[station] = [];
      stationToDepts[station].push(dept);
    }

    // 2. Fetch MF stations par département (cache + throttle 50 req/min)
    const cacheByDept = new Map<string, MfStation[]>();
    async function getDeptStations(dept: string): Promise<MfStation[]> {
      if (cacheByDept.has(dept)) return cacheByDept.get(dept)!;
      const url = `${MF_BASE}/liste-stations/quotidienne?id-departement=${encodeURIComponent(dept)}`;
      try {
        const res = await fetch(url, { headers: { apikey: apiKey! } });
        if (!res.ok) {
          cacheByDept.set(dept, []);
          return [];
        }
        const data = (await res.json()) as MfStation[];
        cacheByDept.set(dept, Array.isArray(data) ? data : []);
        return cacheByDept.get(dept)!;
      } catch {
        cacheByDept.set(dept, []);
        return [];
      }
    }

    // Récup tous les depts uniques pour throttle global
    const allDepts = Array.from(new Set(Object.values(stationToDepts).flat()));
    // Throttle: max 30 req/sec = bien sous quota 50/min
    for (let i = 0; i < allDepts.length; i++) {
      await getDeptStations(allDepts[i]);
      if (i % 10 === 9) await new Promise((r) => setTimeout(r, 100));
    }

    // 3. Pour chaque station COSTIC, trouve la MF la plus proche active
    const mapping: Record<string, { mfId: string; mfName: string; distanceKm: number; typePoste: number }> = {};
    const unmapped: Array<{ stationKey: string; reason: string; depts: string[] }> = [];

    for (const [stationKey, coords] of Object.entries(WEATHER_STATIONS)) {
      const depts = stationToDepts[stationKey] ?? [];
      if (depts.length === 0) {
        unmapped.push({ stationKey, reason: "Aucun département ne pointe vers cette station dans DEPT_TO_STATION", depts: [] });
        continue;
      }

      let best: MfStation | null = null;
      let bestDist = Infinity;
      for (const dept of depts) {
        for (const mf of cacheByDept.get(dept) ?? []) {
          if (!mf.posteOuvert) continue;
          if (mf.typePoste !== 0 && mf.typePoste !== 1 && mf.typePoste !== 2) continue;
          const d = haversineKm(coords.lat, coords.lon, mf.lat, mf.lon);
          if (d < bestDist) {
            bestDist = d;
            best = mf;
          }
        }
      }

      if (best) {
        mapping[stationKey] = {
          mfId: best.id,
          mfName: best.nom,
          distanceKm: Math.round(bestDist * 10) / 10,
          typePoste: best.typePoste,
        };
      } else {
        unmapped.push({
          stationKey,
          reason: "Aucune station MF active (posteOuvert + typePoste 0/1/2) trouvée dans les départements concernés",
          depts,
        });
      }
    }

    // 4. Génère le snippet TS prêt à coller dans MF_STATION_IDS
    const lines: string[] = [];
    for (const [key, m] of Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b))) {
      const safeKey = /^[A-Z][A-Z0-9_-]*$/i.test(key) && !key.includes("-") ? key : JSON.stringify(key);
      lines.push(`  ${safeKey}: "${m.mfId}", // ${m.mfName} (${m.distanceKm} km, type ${m.typePoste})`);
    }
    const snippet = `const MF_STATION_IDS: Record<string, string> = {\n${lines.join("\n")}\n};`;

    return NextResponse.json({
      mappingCount: Object.keys(mapping).length,
      unmappedCount: unmapped.length,
      mapping,
      unmapped,
      snippet,
    });
  } catch (error) {
    console.error("[dju-mf-auto-discover] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
