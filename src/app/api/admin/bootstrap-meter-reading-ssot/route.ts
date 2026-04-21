import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/bootstrap-meter-reading-ssot
 *
 * Script one-shot post-refactor SSOT:
 *   1. Vérifie l'absence de doublons (meterId, readingDate)
 *   2. Crée l'index UNIQUE sur meter_readings(meterId, readingDate)
 *   3. Purge les Consumption source=EXPLOITANT (ancienne data agrégée par mois)
 *
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 * Idempotent: les étapes 2 et 3 tolèrent une exécution multiple.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: Record<string, unknown> = {};

  // 1) Vérifier les doublons
  const dups = await prisma.$queryRaw<
    { meter_id: string; reading_date: Date; count: bigint }[]
  >`
    SELECT "meterId" as meter_id, "readingDate" as reading_date, COUNT(*)::bigint as count
    FROM meter_readings
    GROUP BY "meterId", "readingDate"
    HAVING COUNT(*) > 1
    LIMIT 50
  `;
  report.duplicates = dups.map((d) => ({
    meterId: d.meter_id,
    readingDate: d.reading_date,
    count: Number(d.count),
  }));

  if (dups.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        step: "duplicate_check",
        message:
          "Doublons (meterId, readingDate) détectés. Dédupliquer manuellement avant de re-lancer.",
        ...report,
      },
      { status: 409 }
    );
  }

  // 2) Créer l'index UNIQUE (idempotent via IF NOT EXISTS)
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "meter_readings_meterId_readingDate_key" ON "meter_readings" ("meterId", "readingDate")`
    );
    report.uniqueIndex = "created_or_exists";
  } catch (err) {
    report.uniqueIndex = `error: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(
      { ok: false, step: "create_index", ...report },
      { status: 500 }
    );
  }

  // 3) Purger Consumption source=EXPLOITANT
  const purge = await prisma.consumption.deleteMany({
    where: { source: "EXPLOITANT" },
  });
  report.purgedConsumptions = purge.count;

  return NextResponse.json({ ok: true, ...report });
}
