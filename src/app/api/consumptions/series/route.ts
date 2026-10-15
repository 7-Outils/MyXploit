import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { aggregateMonths, monthKey, monthsBetween, sumPoints, type MonthPoint, type RawRow } from "@/lib/consumption-series";

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
      select: { contractSites: { select: { coefficientQ: true, site: { select: { id: true, name: true, stationMeteo: true } } } } },
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

    // DJU mensuels : moyenne des stations des sites (un site sans station est ignoré)
    const stations = Array.from(new Set(sites.map((s) => s.stationMeteo).filter((s): s is string => !!s)));
    const dju = stations.length
      ? await prisma.dailyDju.findMany({ where: { stationCode: { in: stations } }, select: { stationCode: true, date: true, dju: true } })
      : [];
    const djuByMonth = new Map<string, number>(); // somme sur les stations, divisée ensuite par leur nombre
    for (const d of dju) {
      const k = monthKey(new Date(d.date));
      djuByMonth.set(k, (djuByMonth.get(k) ?? 0) + d.dju);
    }
    const djuOf = (m: string) => (stations.length ? Math.round((djuByMonth.get(m) ?? 0) / stations.length) : null);

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
      const stationDju = s.stationMeteo ? months.reduce((acc, m) => acc + (djuByMonth.get(m) ?? 0), 0) : null;
      return { site: { id: s.id, name: s.name }, ...sum, dju: stationDju !== null && stations.length ? Math.round(stationDju / stations.length) : null };
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
      acc.dju = stations.length ? (acc.dju ?? 0) + (d ?? 0) : null;
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
      totals: round({ ...sumPoints(current), dju: stations.length ? current.reduce((s, p) => s + (p.dju ?? 0), 0) : null }),
      previousTotals: round({ ...sumPoints(previous), dju: stations.length ? previous.reduce((s, p) => s + (p.dju ?? 0), 0) : null }),
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
