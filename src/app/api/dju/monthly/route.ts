import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getMonthlyDjuForStation } from "@/lib/dju-sync";

// Endpoint léger : DJU mensuel pour un site sur une plage de dates arbitraire.
// Une seule fetch Open-Meteo au lieu d'une par année — utilisé par le chart
// télérelève qui a besoin du DJU par mois sur la fenêtre visible.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get("siteId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!siteId || !start || !end) {
      return NextResponse.json(
        { error: "siteId, start et end requis (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { stationMeteo: true, postalCode: true },
    });
    if (!site) {
      return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
    }

    // Cap à today : Open-Meteo archive ne renvoie que de l'historique.
    const today = new Date().toISOString().split("T")[0];
    const cappedEnd = end > today ? today : end;

    const byMonth = await getMonthlyDjuForStation(
      site.stationMeteo,
      site.postalCode,
      start,
      cappedEnd
    );

    const monthlyData = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, dju]) => ({ month, dju: Math.round(dju) }));

    return NextResponse.json({ monthlyData });
  } catch (error) {
    console.error("Error fetching monthly DJU:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul du DJU mensuel" },
      { status: 500 }
    );
  }
}
