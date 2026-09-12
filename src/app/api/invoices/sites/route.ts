import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/invoices/sites?contractId=… — sites ayant au moins une facture,
// avec le nombre de factures. Alimente le filtre de la liste : proposer un
// site sans facture ne mène qu'à une liste vide.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json({ error: "contractId requis" }, { status: 400 });
    }

    // Deux façons d'être rattaché à un site : le champ siteId (facture
    // mono-site) ou une ligne de répartition (facture d'exploitant détaillée).
    // Ne compter que le premier laisserait le filtre quasi vide.
    const [groups, lineGroups] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["siteId"],
        where: { organizationId: effectiveOrgId, contractId, siteId: { not: null } },
        _count: { _all: true },
      }),
      prisma.invoiceSiteLine.findMany({
        where: {
          siteId: { not: null },
          invoice: { organizationId: effectiveOrgId, contractId },
        },
        select: { siteId: true, invoiceId: true },
      }),
    ]);

    // Une facture peut porter plusieurs lignes sur le même site : on compte des
    // factures distinctes, pas des lignes.
    const invoicesBySite = new Map<string, Set<string>>();
    for (const line of lineGroups) {
      if (!line.siteId) continue;
      const set = invoicesBySite.get(line.siteId) ?? new Set<string>();
      set.add(line.invoiceId);
      invoicesBySite.set(line.siteId, set);
    }

    const countBySite = new Map<string, number>();
    for (const g of groups) {
      if (g.siteId) countBySite.set(g.siteId, g._count._all);
    }
    for (const [id, set] of invoicesBySite) {
      countBySite.set(id, (countBySite.get(id) ?? 0) + set.size);
    }

    const ids = [...countBySite.keys()];
    if (ids.length === 0) return NextResponse.json([]);

    const sites = await prisma.site.findMany({
      where: { id: { in: ids }, organizationId: effectiveOrgId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      sites.map((s) => ({ ...s, invoices: countBySite.get(s.id) ?? 0 }))
    );
  } catch (error) {
    console.error("Error listing invoice sites:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des sites" }, { status: 500 });
  }
}
