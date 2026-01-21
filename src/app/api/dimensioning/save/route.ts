import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * Sauvegarde un dimensionnement en créant un contrat
 */

interface DimensioningSummary {
  equipmentCount: number;
  siteCount: number;
  totalP2Annual: number;
  totalP3GEAnnual: number;
  totalP3RAnnual: number;
  totalP3Annual: number;
  totalAnnual: number;
  totalHoursP2: number;
  totalP2Contract: number;
  totalP3GEContract: number;
  totalP3RContract: number;
  totalP3Contract: number;
  totalContract: number;
  renewalsCount: number;
  mandatoryWorksCount: number;
  totalRenewalCost: number;
  totalMandatoryWorksCost: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const body = await request.json();

    const { projectName, siteIds, duration, startYear, dimensioning } = body as {
      projectName: string;
      siteIds: string[];
      duration: number;
      startYear: number;
      dimensioning: DimensioningSummary;
    };

    if (!projectName || !siteIds || siteIds.length === 0) {
      return NextResponse.json(
        { error: "Nom du projet et sites requis" },
        { status: 400 }
      );
    }

    // Create a contract with the dimensioning data
    const contract = await prisma.contract.create({
      data: {
        reference: `DIM-${startYear}-${Date.now().toString(36).toUpperCase()}`,
        title: projectName,
        provider: "À définir",
        startDate: new Date(startYear, 0, 1),
        endDate: new Date(startYear + duration, 0, 1),
        status: "EN_ATTENTE",
        description: `Dimensionnement créé le ${new Date().toLocaleDateString("fr-FR")}\n\nBudget estimé:\n- P2 Annuel: ${dimensioning.totalP2Annual.toLocaleString("fr-FR")} €\n- P3 GE Annuel: ${dimensioning.totalP3GEAnnual.toLocaleString("fr-FR")} €\n- P3 R Annuel: ${dimensioning.totalP3RAnnual.toLocaleString("fr-FR")} €\n- Total Annuel: ${dimensioning.totalAnnual.toLocaleString("fr-FR")} €\n- Total Marché (${duration} ans): ${dimensioning.totalContract.toLocaleString("fr-FR")} €\n\nHeures P2: ${dimensioning.totalHoursP2}h/an\nRenouvellements prévus: ${dimensioning.renewalsCount}`,
        organizationId: effectiveOrgId,
        // Store dimensioning data as JSON in metadata if available
      },
    });

    // Link sites to contract
    for (const siteId of siteIds) {
      await prisma.contractSite.create({
        data: {
          contractId: contract.id,
          siteId: siteId,
          hasP2: true,
          hasP3: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      contractReference: contract.reference,
      sitesLinked: siteIds.length,
    });
  } catch (error) {
    console.error("Error saving dimensioning:", error);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde du dimensionnement" },
      { status: 500 }
    );
  }
}
