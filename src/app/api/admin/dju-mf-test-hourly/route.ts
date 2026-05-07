import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { calculateDJU } from "@/lib/dju-sync";

/**
 * GET /api/admin/dju-mf-test-hourly?stationId=XXX&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Diagnostic Option A: récupère les températures HORAIRES de Météo France
 * pour la période [start-1j, end+1j] et calcule le DJR en respectant la
 * convention COSTIC officielle des fenêtres :
 *   - Tmin du jour J = min des températures de J-1 18h à J 18h
 *   - Tmax du jour J = max des températures de J 6h à J+1 6h
 *
 * Permet de vérifier si l'écart résiduel avec COSTIC officiel disparaît
 * (vs notre méthode actuelle qui utilise les Tmin/Tmax calendaires 0h-24h).
 */

export const maxDuration = 60;

const MF_BASE = "https://portail-api.meteofrance.fr/public/DPClim/v1";

async function mfFetch(url: string): Promise<Response> {
  const apiKey = process.env.METEO_FRANCE_API_KEY;
  if (!apiKey) throw new Error("METEO_FRANCE_API_KEY missing");
  return fetch(url, { headers: { apikey: apiKey, Accept: "*/*" } });
}

async function orderClimatoHoraire(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const url = `${MF_BASE}/commande-station/horaire?id-station=${encodeURIComponent(
    stationId
  )}&date-deb-periode=${encodeURIComponent(`${startDate}T00:00:00Z`)}&date-fin-periode=${encodeURIComponent(`${endDate}T23:59:59Z`)}`;
  const res = await mfFetch(url);
  if (res.status !== 202) {
    throw new Error(`MF order failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const orderId = data?.elaboreProduitAvecDemandeResponse?.return;
  if (!orderId) throw new Error("MF order: orderId missing");
  return String(orderId);
}

async function pollCommandeFichier(orderId: string): Promise<string> {
  const url = `${MF_BASE}/commande/fichier?id-cmde=${encodeURIComponent(orderId)}`;
  let delay = 2000;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delay));
    const res = await mfFetch(url);
    if (res.status === 201) return res.text();
    if (res.status === 204) {
      delay = Math.min(delay * 1.4, 5000);
      continue;
    }
    throw new Error(`MF download failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error("MF download timeout (still 204 after retries)");
}

/** Parse CSV horaire MF, retourne Map<isoDateTime, T_celsius> */
function parseHourlyCsv(csv: string): { temps: Map<string, number>; headers: string[]; tColumn: string | null } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { temps: new Map(), headers: [], tColumn: null };
  const SEP = ";";
  const headers = lines[0].split(SEP).map((h) => h.trim().toUpperCase());
  // Le format horaire MF utilise typiquement "AAAAMMJJHH" ou "AAAAMMJJ" + heure ailleurs
  // et "T" pour la température (parfois "T2M" ou "TM").
  const dateIdx = headers.indexOf("DATE");
  // Candidats pour la colonne température
  const tCandidates = ["T", "T2M", "TM", "TEMP"];
  let tIdx = -1;
  let tColumn: string | null = null;
  for (const c of tCandidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) {
      tIdx = idx;
      tColumn = c;
      break;
    }
  }
  if (dateIdx < 0 || tIdx < 0) return { temps: new Map(), headers, tColumn: null };

  const temps = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cols = line.split(SEP);
    const rawDate = cols[dateIdx]?.trim();
    const rawT = cols[tIdx]?.trim();
    if (!rawDate || !rawT) continue;
    // AAAAMMJJHH (10 chiffres) → ISO YYYY-MM-DDTHH:00:00
    let iso: string;
    if (/^\d{10}$/.test(rawDate)) {
      iso = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(8, 10)}:00:00Z`;
    } else if (/^\d{12}$/.test(rawDate)) {
      iso = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(8, 10)}:${rawDate.slice(10, 12)}:00Z`;
    } else {
      iso = rawDate;
    }
    const t = parseFloat(rawT.replace(",", "."));
    if (!isNaN(t)) temps.set(iso, t);
  }
  return { temps, headers, tColumn };
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Pour une date J donnée, calcule Tmin/Tmax sur fenêtres COSTIC */
function computeWindowedTminTmax(
  temps: Map<string, number>,
  dayIso: string // YYYY-MM-DD
): { tMin: number | null; tMax: number | null; tMinHours: number; tMaxHours: number } {
  const day = new Date(`${dayIso}T00:00:00Z`);
  const dayMinus1 = new Date(day);
  dayMinus1.setUTCDate(dayMinus1.getUTCDate() - 1);
  const dayPlus1 = new Date(day);
  dayPlus1.setUTCDate(dayPlus1.getUTCDate() + 1);

  // Fenêtre Tmin: [J-1 18:00, J 17:59] inclusif (24h, 18h→18h)
  let tMin = Infinity;
  let tMinHours = 0;
  for (let h = 18; h < 24; h++) {
    const k = `${dateOnly(dayMinus1.toISOString())}T${String(h).padStart(2, "0")}:00:00Z`;
    const v = temps.get(k);
    if (v !== undefined) {
      tMin = Math.min(tMin, v);
      tMinHours++;
    }
  }
  for (let h = 0; h < 18; h++) {
    const k = `${dayIso}T${String(h).padStart(2, "0")}:00:00Z`;
    const v = temps.get(k);
    if (v !== undefined) {
      tMin = Math.min(tMin, v);
      tMinHours++;
    }
  }

  // Fenêtre Tmax: [J 06:00, J+1 05:59] inclusif (24h, 6h→6h)
  let tMax = -Infinity;
  let tMaxHours = 0;
  for (let h = 6; h < 24; h++) {
    const k = `${dayIso}T${String(h).padStart(2, "0")}:00:00Z`;
    const v = temps.get(k);
    if (v !== undefined) {
      tMax = Math.max(tMax, v);
      tMaxHours++;
    }
  }
  for (let h = 0; h < 6; h++) {
    const k = `${dateOnly(dayPlus1.toISOString())}T${String(h).padStart(2, "0")}:00:00Z`;
    const v = temps.get(k);
    if (v !== undefined) {
      tMax = Math.max(tMax, v);
      tMaxHours++;
    }
  }

  return {
    tMin: tMin === Infinity ? null : tMin,
    tMax: tMax === -Infinity ? null : tMax,
    tMinHours,
    tMaxHours,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }
    if (!process.env.METEO_FRANCE_API_KEY) {
      return NextResponse.json({ error: "METEO_FRANCE_API_KEY missing" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("stationId") ?? "95088001";
    const start = searchParams.get("start") ?? "2025-09-29";
    const end = searchParams.get("end") ?? "2026-03-30";

    // Étendre la plage d'1 jour de chaque côté pour avoir les fenêtres complètes
    const fetchStart = new Date(`${start}T00:00:00Z`);
    fetchStart.setUTCDate(fetchStart.getUTCDate() - 1);
    const fetchEnd = new Date(`${end}T00:00:00Z`);
    fetchEnd.setUTCDate(fetchEnd.getUTCDate() + 1);

    const t0 = Date.now();
    const orderId = await orderClimatoHoraire(
      stationId,
      fetchStart.toISOString().slice(0, 10),
      fetchEnd.toISOString().slice(0, 10)
    );
    const orderMs = Date.now() - t0;

    const t1 = Date.now();
    const csv = await pollCommandeFichier(orderId);
    const pollMs = Date.now() - t1;

    const { temps, headers, tColumn } = parseHourlyCsv(csv);

    if (!tColumn) {
      // Pas trouvé la colonne température - renvoie les headers pour debug
      const sampleLines = csv.split(/\r?\n/).slice(0, 6);
      return NextResponse.json({
        error: "Colonne température non identifiée dans le CSV horaire",
        headers: headers.slice(0, 50),
        sampleLines,
        timing: { orderMs, pollMs },
      });
    }

    // Calcul DJR avec fenêtres COSTIC pour chaque jour de la période
    const days: Array<{ date: string; tMin: number | null; tMax: number | null; dju: number; djuRounded: number; tMinHours: number; tMaxHours: number }> = [];
    const cur = new Date(`${start}T00:00:00Z`);
    const stop = new Date(`${end}T00:00:00Z`);
    let djrSum = 0;
    let djrSumWithDailyRounding = 0; // somme des Math.round(dju_jour) - méthode COSTIC publiée
    let daysWithData = 0;
    let daysIncomplete = 0;
    while (cur <= stop) {
      const dayIso = cur.toISOString().slice(0, 10);
      const { tMin, tMax, tMinHours, tMaxHours } = computeWindowedTminTmax(temps, dayIso);
      let dju = 0;
      let djuRounded = 0;
      if (tMin !== null && tMax !== null) {
        dju = calculateDJU(tMin, tMax);
        djuRounded = Math.round(dju);
        djrSum += dju;
        djrSumWithDailyRounding += djuRounded;
        daysWithData++;
        if (tMinHours < 20 || tMaxHours < 20) daysIncomplete++;
      }
      days.push({
        date: dayIso,
        tMin,
        tMax,
        dju: Math.round(dju * 1000) / 1000,
        djuRounded,
        tMinHours,
        tMaxHours,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return NextResponse.json({
      stationId,
      period: { start, end },
      timing: { orderMs, pollMs, totalMs: orderMs + pollMs },
      orderId,
      tColumn,
      hourlyTempsCount: temps.size,
      coverage: {
        expectedDays: days.length,
        daysWithData,
        daysIncomplete,
      },
      djrSum: Math.round(djrSum * 100) / 100, // somme float (méthode actuelle)
      djrSumWithDailyRounding, // somme des Math.round(dju) jour par jour (méthode COSTIC publiée)
      sampleDays: days.slice(0, 5).concat(days.slice(-5)),
    });
  } catch (error) {
    console.error("[dju-mf-test-hourly] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
