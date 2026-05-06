import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/admin/dju-purge
 * Vide la table DailyDju (cache mutualisé multi-org). À utiliser après un
 * changement de formule de calcul DJU pour forcer la resync au prochain
 * cron (ou à la demande). Réservé aux admins.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé. Réservé aux administrateurs." },
        { status: 403 }
      );
    }

    const result = await prisma.dailyDju.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Cache DJU purgée (${result.count} entrées). La resync se fera au prochain cron ou à la demande.`,
    });
  } catch (error) {
    console.error("Error purging DJU cache:", error);
    return NextResponse.json(
      { error: "Erreur lors de la purge de la cache DJU" },
      { status: 500 }
    );
  }
}
