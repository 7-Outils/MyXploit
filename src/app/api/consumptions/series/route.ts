import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { aggregateMonths, monthKey, monthsBetween, sumPoints, type MonthPoint, type RawRow } from "@/lib/consumption-series";
import { getDailyDjuFromCache, getStationFromPostalCode, resolveStationKey } from "@/lib/dju-sync";

/**
 * GET /api/consumptions/series?contractId=…&from=YYYY-MM-DD&to=YYYY-MM-DD[&siteId=…]
 *
 * Une seule série mensuelle (kWh, chauffage, ECS, coût, DJU) sur la fenêtre,
 * la même fenêtre un an plus tôt (N−1), le détail par site et par énergie,
 * et l'historique complet par année civile. Ne dépend pas du type d'année du
 * contrat : la fenêtre est celle demandée.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const sp = req.nextUrl.searchParams;
    const contractId = sp.get("contractId");
    const siteId = sp.get("siteId");
    const from = sp.get("from") ? new Date(`${sp.get("from")}T00:00:00`) : null;
    const to = sp.get("to") ? new Date(`${sp.get("to")}T00:00:00`) : null;
    if (!contractId || !from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "contractId, from et to requis" }, { status: 400 });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { contractSites: { select: { coefficientQ: true, site: { select: { id: true, name: true, stationMeteo: true, postalCode: true } } } } },
    });
    if (!contract) return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    const sites = contract.contractSites.map((cs) => cs.site).filter((s) => !siteId || s.id === siteId);
    if (sites.length === 0) return NextResponse.json({ error: "Aucun site" }, { status: 404 });
    const siteIds = sites.map((s) => s.id);
    const coefQ = new Map(contract.contractSites.map((cs) => [cs.site.id, cs.coefficientQ ?? 0.13]));

    // Toute l'histoire des sites (lignes mensuelles ou journalières) : sert à la fois à la fenêtre, à N−1 et à l'historique
    const rows = (await prisma.consumption.findMany({
      where: { siteId: { in: siteIds }, organizationId: effectiveOrgId, energyType: { not: "EAU" } },
      select: { siteId: true, energyType: true, usage: true, source: true, period: true, quantity: true, unit: true, cost: true, quantityEcs: true, quantityChauffage: true },
    })) as RawRow[];

    // DJU mensuels : même résolution de station que les analyses (station du site, sinon code postal),
    // lus dans le cache journalier partagé ; agrégés en moyenne par site.
    const stationOf = new Map(sites.map((s) => [s.id, resolveStationKey(s.stationMeteo) ?? getStationFromPostalCode(s.postalCode)]));
    const stationKeys = Array.from(new Set(stationOf.values()));
    const firstMonth = rows.reduce<Date | null>((min, r) => (!min || r.period < min ? r.period : min), null);
    const spanStart = new Date(Math.min(firstMonth?.getTime() ?? from.getTime(), new Date(from.getFullYear() - 1, from.getMonth(), 1).getTime()));
    const spanEnd = new Date();
    const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const djuByStationMonth = new Map<string, Map<string, number>>(); // station → mois → DJU
    await Promise.all(
      stationKeys.map(async (key) => {
        const daily = await getDailyDjuFromCache(key, null, isoDay(spanStart), isoDay(spanEnd));
        const byMonth = new Map<string, number>();
        for (const [day, v] of daily) byMonth.set(day.slice(0, 7), (byMonth.get(day.slice(0, 7)) ?? 0) + v);
        djuByStationMonth.set(key, byMonth);
      })
    );
    const stations = stationKeys;
    /** DJU du mois pour un ensemble de sites : moyenne de leurs stations. */
    const djuFor = (m: string, ids: string[]) => {
      const vals = ids.map((id) => djuByStationMonth.get(stationOf.get(id) ?? "")?.get(m)).filter((v): v is number => typeof v === "number");
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    const djuOf = (m: string) => djuFor(m, siteIds);

    const all = aggregateMonths(rows, coefQ);
    const byMonth = new Map(all.map((p) => [p.month, p]));
    const pick = (months: string[]) =>
      months.map((m) => ({ ...(byMonth.get(m) ?? { month: m, total: 0, chauffage: 0, ecs: 0, cost: 0 }), dju: djuOf(m) }));

    const months = monthsBetween(from, to);
    const prevFrom = new Date(from.getFullYear() - 1, from.getMonth(), from.getDate());
    const prevTo = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
    const prevMonths = monthsBetween(prevFrom, prevTo);
    const current = pick(months);
    const previous = pick(prevMonths);

    // Par site et par énergie sur la fenêtre
    const inWindow = rows.filter((r) => months.includes(monthKey(r.period)));
    const bySite = sites.map((s) => {
      const pts = aggregateMonths(inWindow.filter((r) => r.siteId === s.id), coefQ);
      const sum = sumPoints(pts);
      const vals = months.map((m) => djuFor(m, [s.id])).filter((v): v is number => v !== null);
      return { site: { id: s.id, name: s.name }, ...sum, dju: vals.length ? vals.reduce((a, b) => a + b, 0) : null };
    });
    const byEnergy = Array.from(new Set(inWindow.map((r) => r.energyType))).map((e) => ({
      energyType: e,
      ...sumPoints(aggregateMonths(inWindow.filter((r) => r.energyType === e), coefQ)),
    }));

    // Historique par année civile, sur tout ce qui existe
    const years = new Map<string, MonthPoint & { dju: number | null }>();
    for (const p of all) {
      const y = p.month.slice(0, 4);
      const acc = years.get(y) ?? { month: y, total: 0, chauffage: 0, ecs: 0, cost: 0, dju: 0 };
      acc.total += p.total; acc.chauffage += p.chauffage; acc.ecs += p.ecs; acc.cost += p.cost;
      const d = djuOf(p.month);
      acc.dju = d === null && acc.dju === null ? null : (acc.dju ?? 0) + (d ?? 0);
      years.set(y, acc);
    }
    const history = Array.from(years.values())
      .map((y) => ({ year: y.month, total: y.total, chauffage: y.chauffage, ecs: y.ecs, cost: y.cost, dju: y.dju }))
      .sort((a, b) => a.year.localeCompare(b.year));

    const round = <T extends Record<string, unknown>>(o: T): T =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? Math.round(v) : v])) as T;

    return NextResponse.json({
      window: { from: from.toISOString(), to: to.toISOString() },
      months: current.map(round),
      previousMonths: previous.map(round),
      totals: round({ ...sumPoints(current), dju: current.some((p) => p.dju !== null) ? current.reduce((s, p) => s + (p.dju ?? 0), 0) : null }),
      previousTotals: round({ ...sumPoints(previous), dju: previous.some((p) => p.dju !== null) ? previous.reduce((s, p) => s + (p.dju ?? 0), 0) : null }),
      bySite: bySite.map(round),
      byEnergy: byEnergy.map(round),
      history: history.map(round),
      sites: sites.map((s) => ({ id: s.id, name: s.name })),
      stations: stations.length,
    });
  } catch (error) {
    console.error("Error building consumption series:", error);
    return NextResponse.json({ error: "Erreur lors du calcul de la série" }, { status: 500 });
  }
}
