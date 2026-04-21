import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/dedupe-heating-periods
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Dédoublonne les HeatingPeriod qui ont exactement même (siteId, startDate, endDate).
 * Garde la plus ancienne (createdAt), supprime les autres.
 *
 * Cruft issu de la migration HeatingSeason → HeatingPeriod (commit 432ce3d).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await prisma.heatingPeriod.findMany({
    orderBy: { createdAt: "asc" },
  });

  type Key = string;
  const keepers = new Map<Key, string>(); // key → kept id
  const toDelete: string[] = [];

  for (const p of all) {
    const key = `${p.siteId}|${p.startDate.toISOString()}|${p.endDate?.toISOString() ?? "null"}`;
    if (keepers.has(key)) {
      toDelete.push(p.id);
    } else {
      keepers.set(key, p.id);
    }
  }

  const deleted = await prisma.heatingPeriod.deleteMany({
    where: { id: { in: toDelete } },
  });

  return NextResponse.json({
    ok: true,
    totalBefore: all.length,
    kept: keepers.size,
    deleted: deleted.count,
  });
}
