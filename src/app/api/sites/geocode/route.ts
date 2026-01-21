import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";

// POST /api/sites/geocode - Re-geocode sites without coordinates for a specific contract
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour cette action" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const contractId = body.contractId;

    if (!contractId) {
      return NextResponse.json(
        { error: "contractId requis" },
        { status: 400 }
      );
    }

    // Verify contract belongs to organization
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: effectiveOrgId,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Find all sites linked to this contract without coordinates that have address and city
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            postalCode: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    // Filter to sites without coordinates
    const sitesWithoutCoords = contractSites
      .map((cs) => cs.site)
      .filter((site) => !site.latitude && !site.longitude && site.address && site.city);

    if (sitesWithoutCoords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tous les sites de ce contrat ont déjà des coordonnées GPS",
        updated: 0,
        failed: 0,
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
