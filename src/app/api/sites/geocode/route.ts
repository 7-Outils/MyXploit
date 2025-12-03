import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";

// POST /api/sites/geocode - Re-geocode all sites without coordinates
export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour cette action" },
        { status: 403 }
      );
    }

    // Find all sites without coordinates that have address and city
    const sitesWithoutCoords = await prisma.site.findMany({
      where: {
        organizationId: user.organizationId,
        latitude: null,
        longitude: null,
        address: { not: "" },
        city: { not: "" },
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        postalCode: true,
      },
    });

    if (sitesWithoutCoords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tous les sites ont déjà des coordonnées GPS",
        updated: 0,
      });
    }

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const site of sitesWithoutCoords) {
      try {
        const geoResult = await geocodeAddress(
          site.address || "",
          site.city || "",
          site.postalCode || ""
        );

        if (geoResult) {
          await prisma.site.update({
            where: { id: site.id },
            data: {
              latitude: geoResult.latitude,
              longitude: geoResult.longitude,
            },
          });
          results.push({ id: site.id, name: site.name, success: true });
        } else {
          results.push({
            id: site.id,
            name: site.name,
            success: false,
            error: "Adresse non trouvée",
          });
        }
      } catch (error) {
        results.push({
          id: site.id,
          name: site.name,
          success: false,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount} site(s) géocodé(s), ${failedCount} échec(s)`,
      updated: successCount,
      failed: failedCount,
      details: results,
    });
  } catch (error) {
    console.error("Error geocoding sites:", error);
    return NextResponse.json(
      { error: "Erreur lors du géocodage des sites" },
      { status: 500 }
    );
  }
}
