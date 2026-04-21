import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/diag-heating-periods
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Retourne tous les HeatingPeriod groupés par site, avec createdAt pour tracer
 * l'origine des duplications.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periods = await prisma.heatingPeriod.findMany({
    include: { site: { select: { name: true } } },
    orderBy: [{ siteId: "asc" }, { createdAt: "asc" }],
  });

  type Info = {
    siteName: string;
    count: number;
    periods: { id: string; startDate: Date; endDate: Date | null; createdAt: Date }[];
  };
  const bySite = new Map<string, Info>();
  for (const p of periods) {
    const key = p.siteId;
    const existing = bySite.get(key);
    if (existing) {
      existing.count++;
      existing.periods.push({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
      });
    } else {
      bySite.set(key, {
        siteName: p.site.name,
        count: 1,
        periods: [
          { id: p.id, startDate: p.startDate, endDate: p.endDate, createdAt: p.createdAt },
        ],
      });
    }
  }

  return NextResponse.json({
    total: periods.length,
    sites: Array.from(bySite.entries()).map(([siteId, info]) => ({
      siteId,
      ...info,
    })),
  });
}
