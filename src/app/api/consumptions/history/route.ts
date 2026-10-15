import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { kwhBySiteYear, type RawRow } from "@/lib/consumption-history";
import { getDailyDjuFromCache, getStationFromPostalCode, resolveStationKey } from "@/lib/dju-sync";

/**
 * GET /api/consumptions/history?contractId=…
 * Historique par année civile : total par année (kWh, DJU, kWh/DJU) et
 * matrice sites × années. Indépendant du type d'année du contrat.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) return NextResponse.json({ error: "contractId requis" }, { status: 400 });

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { contractSites: { select: { coefficientQ: true, site: { select: { id: true, name: true, stationMeteo: true, postalCode: true } } } } },
    });
    if (!contract) return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    const sites = contract.contractSites.map((cs) => cs.site);
    const coefQ = new Map(contract.contractSites.map((cs) => [cs.site.id, cs.coefficientQ ?? 0.13]));

    const rows = (await prisma.consumption.findMany({
      where: { siteId: { in: sites.map((s) => s.id) }, organizationId: effectiveOrgId, energyType: { not: "EAU" } },
      select: { siteId: true, energyType: true, usage: true, source: true, period: true, quantity: true, unit: true },
    })) as RawRow[];
    if (rows.length === 0) return NextResponse.json({ years: [], sites: [] });

    const bySite = kwhBySiteYear(rows, coefQ);
    const years = Array.from(new Set(rows.map((r) => String(r.period.getFullYear())))).sort();

    // DJU par année civile : moyenne des stations des sites, depuis le cache journalier partagé
    const stationOf = new Map(sites.map((s) => [s.id, resolveStationKey(s.stationMeteo) ?? getStationFromPostalCode(s.postalCode)]));
    const stationKeys = Array.from(new Set(stationOf.values()));
    const djuByStationYear = new Map<string, Map<string, number>>();
    await Promise.all(
      stationKeys.map(async (key) => {
        const daily = await getDailyDjuFromCache(key, null, `${years[0]}-01-01`, `${years[years.length - 1]}-12-31`);
        const byYear = new Map<string, number>();
        for (const [day, v] of daily) byYear.set(day.slice(0, 4), (byYear.get(day.slice(0, 4)) ?? 0) + v);
        djuByStationYear.set(key, byYear);
      })
    );
    const djuOf = (year: string, ids: string[]) => {
      const vals = ids.map((id) => djuByStationYear.get(stationOf.get(id) ?? "")?.get(year)).filter((v): v is number => typeof v === "number" && v > 0);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    const siteRows = sites
      .map((s) => ({ id: s.id, name: s.name, byYear: Object.fromEntries(years.map((y) => [y, Math.round(bySite.get(s.id)?.get(y) ?? 0)])) }))
      .filter((s) => Object.values(s.byYear).some((v) => v > 0))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const allIds = sites.map((s) => s.id);
    const yearRows = years.map((y) => {
      const total = siteRows.reduce((s, r) => s + r.byYear[y], 0);
      const dju = djuOf(y, allIds);
      return { year: y, total, dju, kwhPerDju: dju ? Math.round((total / dju) * 10) / 10 : null, sitesWithData: siteRows.filter((r) => r.byYear[y] > 0).length };
    });
    return NextResponse.json({ years: yearRows, sites: siteRows, currentYear: String(new Date().getFullYear()) });
  } catch (error) {
    console.error("Error building consumption history:", error);
    return NextResponse.json({ error: "Erreur lors du calcul de l'historique" }, { status: 500 });
  }
}
