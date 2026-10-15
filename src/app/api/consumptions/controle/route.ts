import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { controlReadings, summarize, type ExploitantReading, type TelereleveRow } from "@/lib/releves-controle";

/**
 * GET /api/consumptions/controle?contractId=…            → les sites du contrat qui ont les deux sources, avec résumé
 * GET /api/consumptions/controle?contractId=…&siteId=…   → le détail relevé par relevé pour un site
 *
 * Télérelève = source TELERELEVE (journalière, ou mensuelle au prorata des jours).
 * Exploitant = source EXPLOITANT, un relevé = [period, periodEnd] (ou le mois de `period`).
 * Comparaison par énergie, toutes utilisations confondues (la télérelève GRDF est un total).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const contractId = req.nextUrl.searchParams.get("contractId");
    const siteId = req.nextUrl.searchParams.get("siteId");
    if (!contractId) return NextResponse.json({ error: "contractId requis" }, { status: 400 });

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true, contractSites: { select: { site: { select: { id: true, name: true, city: true } } } } },
    });
    if (!contract) return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    const sites = contract.contractSites.map((cs) => cs.site);
    const siteIds = sites.map((s) => s.id);
    if (siteId && !siteIds.includes(siteId)) return NextResponse.json({ error: "Site hors contrat" }, { status: 404 });

    const scope = siteId ? [siteId] : siteIds;
    const rows = await prisma.consumption.findMany({
      where: { siteId: { in: scope }, organizationId: effectiveOrgId, source: { in: ["EXPLOITANT", "TELERELEVE"] } },
      select: { siteId: true, energyType: true, source: true, period: true, periodEnd: true, quantity: true, unit: true },
      orderBy: { period: "asc" },
    });
    const resets = await prisma.meterReading.findMany({
      where: { isReset: true, meter: { siteId: { in: scope } } },
      select: { readingDate: true, meter: { select: { siteId: true } } },
    });

    // Regroupement par site × énergie
    type Bucket = { exploitant: ExploitantReading[]; telereleve: TelereleveRow[]; monthlyCount: Map<string, number> };
    const buckets = new Map<string, Bucket>();
    const keyOf = (s: string, e: string) => `${s}|${e}`;
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
    for (const r of rows) {
      const k = keyOf(r.siteId, r.energyType);
      let b = buckets.get(k);
      if (!b) {
        b = { exploitant: [], telereleve: [], monthlyCount: new Map() };
        buckets.set(k, b);
      }
      if (r.source === "TELERELEVE") b.monthlyCount.set(monthKey(r.period), (b.monthlyCount.get(monthKey(r.period)) ?? 0) + 1);
    }
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
    for (const r of rows) {
      const b = buckets.get(keyOf(r.siteId, r.energyType))!;
      if (r.source === "EXPLOITANT") {
        b.exploitant.push({ start: r.period, end: r.periodEnd ?? endOfMonth(r.period), quantity: r.quantity, unit: r.unit });
      } else {
        // Une seule ligne dans le mois sans fin de période = ligne mensuelle ; sinon journalière
        const monthly = !r.periodEnd && (b.monthlyCount.get(monthKey(r.period)) ?? 0) === 1 && r.period.getDate() === 1;
        b.telereleve.push({ start: r.period, end: r.periodEnd ?? (monthly ? endOfMonth(r.period) : r.period), quantity: r.quantity });
      }
    }

    const resetsBySite = new Map<string, Date[]>();
    for (const r of resets) {
      const arr = resetsBySite.get(r.meter.siteId) ?? [];
      arr.push(r.readingDate);
      resetsBySite.set(r.meter.siteId, arr);
    }

    const result = [];
    for (const [k, b] of buckets) {
      if (b.exploitant.length === 0 || b.telereleve.length === 0) continue; // il faut les deux sources
      const [sid, energyType] = k.split("|");
      const site = sites.find((s) => s.id === sid)!;
      const control = controlReadings(b.exploitant, b.telereleve, resetsBySite.get(sid) ?? []);
      result.push({
        site,
        energyType,
        summary: summarize(control),
        rows: siteId ? control : undefined,
      });
    }
    result.sort((a, b) => b.summary.anomalies - a.summary.anomalies || a.site.name.localeCompare(b.site.name, "fr"));
    return NextResponse.json({ sites: result, sitesInContract: sites.length });
  } catch (error) {
    console.error("Error in consumption control:", error);
    return NextResponse.json({ error: "Erreur lors du contrôle des relevés" }, { status: 500 });
  }
}
