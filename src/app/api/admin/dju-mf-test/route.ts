import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { orderClimatoQuotidienne, pollCommandeFichier } from "@/lib/dju-meteo-france";

/**
 * GET /api/admin/dju-mf-test?stationId=XXX&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Outil de diagnostic : passe une commande Météo-France et renvoie les
 * en-têtes du CSV + un échantillon des 5 premières lignes. Utilisé pour
 * identifier le code de colonne du DJU chauffagiste à hard-coder dans
 * dju-meteo-france.ts (DJU_CHAUFFAGISTE_COLUMN_CANDIDATES).
 *
 * Exemple : /api/admin/dju-mf-test?stationId=93005001&start=2025-01-01&end=2025-01-31
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("stationId") ?? "93005001";
    const start = searchParams.get("start") ?? "2025-01-01";
    const end = searchParams.get("end") ?? "2025-01-31";

    if (!process.env.METEO_FRANCE_API_KEY) {
      return NextResponse.json(
        { error: "METEO_FRANCE_API_KEY non définie côté serveur" },
        { status: 500 }
      );
    }

    const t0 = Date.now();
    const orderId = await orderClimatoQuotidienne(stationId, start, end);
    const orderMs = Date.now() - t0;

    const t1 = Date.now();
    const csv = await pollCommandeFichier(orderId);
    const pollMs = Date.now() - t1;

    const lines = csv.split(/\r?\n/);
    const headers = (lines[0] ?? "").split(";").map((h) => h.trim());
    const sampleRows = lines.slice(1, 6).map((l) => l.split(";").map((c) => c.trim()));

    // Cherche les colonnes contenant "DJU" pour faciliter l'identification
    const djuColumns = headers
      .map((h, i) => ({ index: i, name: h }))
      .filter((c) => c.name.toUpperCase().includes("DJU"));

    return NextResponse.json({
      stationId,
      period: { start, end },
      timing: { orderMs, pollMs, totalMs: orderMs + pollMs },
      orderId,
      headerCount: headers.length,
      headers,
      djuColumns, // colonnes contenant "DJU" — c'est là qu'on cherche le bon code
      sampleRows: sampleRows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null]))),
    });
  } catch (error) {
    console.error("[dju-mf-test] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
