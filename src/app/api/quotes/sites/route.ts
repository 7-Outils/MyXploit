import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/quotes/sites?contractId=… — sites ayant au moins un devis, avec le
// nombre de devis. Alimente le filtre de la liste : proposer un site sans
// devis ne mène qu'à une liste vide.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const contractId = request.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return NextResponse.json({ error: "contractId requis" }, { status: 400 });
    }

    const groups = await prisma.quote.groupBy({
      by: ["siteId"],
      where: { organizationId: effectiveOrgId, contractId, siteId: { not: null } },
      _count: { _all: true },
    });
    const ids = groups.map((g) => g.siteId).filter((id): id is string => !!id);
    if (ids.length === 0) return NextResponse.json([]);

    const sites = await prisma.site.findMany({
      where: { id: { in: ids }, organizationId: effectiveOrgId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });
    const countBySite = new Map(groups.map((g) => [g.siteId, g._count._all]));
    return NextResponse.json(
      sites.map((s) => ({ ...s, quotes: countBySite.get(s.id) ?? 0 }))
    );
  } catch (error) {
    console.error("Error listing quote sites:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des sites" }, { status: 500 });
  }
}
