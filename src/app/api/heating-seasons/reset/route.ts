import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/heating-seasons/reset - Reset all heating season dates
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour réinitialiser les dates" },
        { status: 403 }
      );
    }

    // Get all heating seasons for this organization
    const seasons = await prisma.heatingSeason.findMany({
      where: {
        site: {
          organizationId: user.organizationId,
        },
      },
      select: { id: true },
    });

    // Reset dates for each season (keep engagement data: nb, nbUnit, djuContractuel)
    // Use placeholder date for startDate since it's a required field
    const placeholderDate = new Date('1900-01-01');

    for (const season of seasons) {
      await prisma.heatingSeason.update({
        where: { id: season.id },
        data: {
          startDate: placeholderDate,
          endDate: null,
          lastReleveDate: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      resetCount: seasons.length,
      message: `${seasons.length} saison(s) de chauffage réinitialisée(s)`,
    });
  } catch (error) {
    console.error("Error resetting heating seasons:", error);
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation des dates de chauffage" },
      { status: 500 }
    );
  }
}
