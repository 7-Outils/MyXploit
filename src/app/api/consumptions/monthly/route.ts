import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Endpoint d'agrégation mensuelle pour le chart télérelève.
 *
 * Pourquoi : pour les vues "month" / "year" du chart, on n'a pas besoin
 * des relevés daily individuels (1825 rows pour 5 ans). Un groupBy SQL
 * direct retourne ~60 rows mensualisées → bcp moins de CPU côté server
 * (Prisma deserialize), zéro agrégation côté client.
 *
 * Paramètres :
 *   siteId     (requis) — site à analyser
 *   start, end (requis) — fenêtre YYYY-MM-DD
 *
 * Réponse :
 *   { monthlyData: [{ month: "YYYY-MM", energyType, usage, source, quantity, djuReel }] }
 *   Une ligne par (mois, energyType, usage, source) → le chart somme par
 *   energyType pour rendre les buckets.
 */
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
        { error: "siteId, start, end requis (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Agrégation par (date_trunc('month', period), energyType, usage, source)
    // via raw query Postgres car prisma.groupBy ne sait pas tronquer une date.
    // SUM(quantity) + AVG(djuReel) — un seul aller-retour DB, traité côté SQL.
    const rows = await prisma.$queryRaw<
      Array<{
        month: Date;
        energyType: string;
        usage: string;
        source: string;
        quantity: number;
        djuReel: number | null;
        meterName: string | null;
      }>
    >`
      SELECT
        date_trunc('month', period) AS month,
        "energyType",
        usage,
        source,
        SUM(quantity)::float AS quantity,
        AVG("djuReel")::float AS "djuReel",
        MIN("meterName") AS "meterName"
      FROM consumptions
      WHERE "organizationId" = ${effectiveOrgId}
        AND "siteId" = ${siteId}
        AND period >= ${new Date(start)}
        AND period <= ${new Date(end)}
      GROUP BY date_trunc('month', period), "energyType", usage, source
      ORDER BY month ASC
    `;

    const monthlyData = rows.map((r) => {
      const d = new Date(r.month);
      return {
        month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        energyType: r.energyType,
        usage: r.usage,
        source: r.source,
        quantity: r.quantity,
        djuReel: r.djuReel,
        meterName: r.meterName,
      };
    });

    return NextResponse.json({ monthlyData });
  } catch (error) {
    console.error("Error fetching monthly consumption:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'agrégation mensuelle" },
      { status: 500 }
    );
  }
}
