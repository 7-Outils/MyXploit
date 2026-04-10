import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/consumptions/compare?siteId=...&dateFrom=...&dateTo=...
 *
 * Compares EXPLOITANT (manual operator readings) vs TELERELEVE (GRDF/Enedis)
 * data for a given site and date range. For each EXPLOITANT reading period,
 * sums the TELERELEVE daily records over the same date range.
 *
 * Returns an array of comparison rows sorted by period.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get("siteId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!siteId) {
      return NextResponse.json({ error: "siteId required" }, { status: 400 });
    }

    // Build date filter
    const periodFilter: Record<string, unknown> = {};
    if (dateFrom) periodFilter.gte = new Date(dateFrom);
    if (dateTo) periodFilter.lte = new Date(dateTo);

    const periodWhere = Object.keys(periodFilter).length > 0 ? { period: periodFilter } : {};

    // Fetch EXPLOITANT records
    const exploitantRecords = await prisma.consumption.findMany({
      where: {
        siteId,
        organizationId: effectiveOrgId,
        source: "EXPLOITANT",
        energyType: "GAZ",
        usage: { in: ["CHAUFFAGE", "MIXTE"] },
        ...periodWhere,
      },
      orderBy: { period: "asc" },
    });

    // Fetch TELERELEVE records (daily granularity from GRDF)
    const telereleveRecords = await prisma.consumption.findMany({
      where: {
        siteId,
        organizationId: effectiveOrgId,
        source: "TELERELEVE",
        energyType: "GAZ",
        usage: { in: ["CHAUFFAGE", "MIXTE"] },
        ...periodWhere,
      },
      orderBy: { period: "asc" },
    });

    // Group telereleve by month key for quick lookup
    const telereleveByMonth = new Map<string, number>();
    for (const r of telereleveRecords) {
      const d = new Date(r.period);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      telereleveByMonth.set(key, (telereleveByMonth.get(key) || 0) + r.quantity);
    }

    // Group exploitant by month key
    const exploitantByMonth = new Map<string, number>();
    for (const r of exploitantRecords) {
      const d = new Date(r.period);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      exploitantByMonth.set(key, (exploitantByMonth.get(key) || 0) + r.quantity);
    }

    // Build comparison: union of all months that have at least one source
    const allMonths = new Set([...telereleveByMonth.keys(), ...exploitantByMonth.keys()]);
    const comparison = Array.from(allMonths)
      .sort()
      .map((month) => {
        const telereleve = telereleveByMonth.get(month) || 0;
        const exploitant = exploitantByMonth.get(month) || 0;
        const ecart = telereleve > 0 ? exploitant - telereleve : 0;
        const ecartPct = telereleve > 0 ? Math.round(((exploitant - telereleve) / telereleve) * 1000) / 10 : null;

        return {
          month,
          label: new Date(`${month}-01`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
          exploitant: Math.round(exploitant),
          telereleve: Math.round(telereleve),
          ecart: Math.round(ecart),
          ecartPct,
        };
      });

    // Summary
    const totalExploitant = comparison.reduce((s, r) => s + r.exploitant, 0);
    const totalTelereleve = comparison.reduce((s, r) => s + r.telereleve, 0);
    const totalEcart = totalExploitant - totalTelereleve;
    const totalEcartPct = totalTelereleve > 0
      ? Math.round(((totalExploitant - totalTelereleve) / totalTelereleve) * 1000) / 10
      : null;

    return NextResponse.json({
      siteId,
      comparison,
      summary: {
        totalExploitant,
        totalTelereleve,
        totalEcart,
        totalEcartPct,
        monthsWithBothSources: comparison.filter((r) => r.exploitant > 0 && r.telereleve > 0).length,
        monthsTotal: comparison.length,
      },
    });
  } catch (error) {
    console.error("Error comparing consumptions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
