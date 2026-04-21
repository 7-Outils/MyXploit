import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDailyDjuForStation } from "@/lib/dju-sync";

/**
 * GET /api/admin/diag-djr?siteName=X
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Diagnostic pour un site: résout station météo, fetch DJU sur la période,
 * intersecte avec HeatingPeriod, renvoie djrTotal calculé.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteName = searchParams.get("siteName") ?? "Bâtiment Administratif Furmaneck";
  const yearStr = searchParams.get("year") ?? String(new Date().getFullYear());
  const yearType = searchParams.get("yearType") ?? "HEATING_SEASON";
  const year = parseInt(yearStr);

  const site = await prisma.site.findFirst({
    where: { name: { contains: siteName, mode: "insensitive" } },
    select: { id: true, name: true, postalCode: true, stationMeteo: true },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const periods = await prisma.heatingPeriod.findMany({
    where: { siteId: site.id },
    select: { startDate: true, endDate: true },
  });

  const startDate = yearType === "CIVIL" ? new Date(year, 0, 1) : new Date(year - 1, 6, 1);
  const endDate = yearType === "CIVIL" ? new Date(year, 11, 31) : new Date(year, 5, 30);
  const today = new Date();
  const qEnd = endDate > today ? today : endDate;

  const intervals: { start: string; end: string }[] = [];
  for (const p of periods) {
    const hpStart = p.startDate;
    const hpEnd = p.endDate ?? today;
    const iStart = hpStart > startDate ? hpStart : startDate;
    const iEnd = hpEnd < qEnd ? hpEnd : qEnd;
    if (iStart >= iEnd) continue;
    intervals.push({ start: iStart.toISOString(), end: iEnd.toISOString() });
  }

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let dailySize = 0;
  let djrTotal = 0;
  let sample: { date: string; dju: number }[] = [];
  if (intervals.length > 0) {
    const spanStart = new Date(intervals[0].start);
    const spanEnd = new Date(intervals[intervals.length - 1].end);
    const daily = await getDailyDjuForStation(
      site.stationMeteo,
      site.postalCode,
      toIso(spanStart),
      toIso(spanEnd)
    );
    dailySize = daily.size;
    sample = Array.from(daily.entries()).slice(0, 5).map(([date, dju]) => ({ date, dju }));

    const inAnyInterval = (d: Date) =>
      intervals.some((i) => d >= new Date(i.start) && d <= new Date(i.end));
    for (const [dateIso, dju] of daily.entries()) {
      const d = new Date(dateIso);
      if (inAnyInterval(d)) djrTotal += dju;
    }
  }

  return NextResponse.json({
    site,
    year,
    yearType,
    queryRange: { start: startDate.toISOString(), end: qEnd.toISOString() },
    heatingPeriodsRaw: periods.map((p) => ({
      startDate: p.startDate.toISOString(),
      endDate: p.endDate?.toISOString() ?? null,
    })),
    intervals,
    weather: { dailyPointsFetched: dailySize, sample },
    djrTotal: Math.round(djrTotal),
  });
}
