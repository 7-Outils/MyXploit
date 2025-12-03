import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  getContractYears,
  calculateYearlyPrices,
  PriceChange,
} from "@/lib/price-calculator";

// GET /api/contracts/[id]/sites/[siteId]/prices - Get yearly prices for a site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; siteId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId, siteId } = await params;

    // Get contract with year type configuration
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: user.organizationId,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Get contract site with price changes
    const contractSite = await prisma.contractSite.findUnique({
      where: {
        contractId_siteId: {
          contractId,
          siteId,
        },
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
        priceChanges: {
          orderBy: { effectiveDate: "asc" },
        },
      },
    });

    if (!contractSite) {
      return NextResponse.json(
        { error: "Site non trouvé dans ce contrat" },
        { status: 404 }
      );
    }

    // Calculate contract years
    const contractYears = getContractYears(
      contract.startDate,
      contract.endDate,
      contract.yearType as "CIVIL" | "HEATING_SEASON",
      contract.yearStartMonth,
      contract.yearStartDay
    );

    // Convert price changes to the expected format
    const priceChanges: PriceChange[] = contractSite.priceChanges.map((pc) => ({
      effectiveDate: pc.effectiveDate,
      amountP1: pc.amountP1,
      amountP2: pc.amountP2,
      amountP3: pc.amountP3,
      deltaP1: pc.deltaP1,
      deltaP2: pc.deltaP2,
      deltaP3: pc.deltaP3,
    }));

    // Calculate yearly prices
    const yearlyPrices = calculateYearlyPrices(
      contractYears,
      contractSite.amountP1 || 0,
      contractSite.amountP2 || 0,
      contractSite.amountP3 || 0,
      priceChanges,
      contractSite.integrationDate,
      contractSite.exitDate
    );

    return NextResponse.json({
      site: contractSite.site,
      contractType: contractSite.contractType,
      hasP1: contractSite.hasP1,
      hasP2: contractSite.hasP2,
      hasP3: contractSite.hasP3,
      hasP4: contractSite.hasP4,
      baseAmounts: {
        P1: contractSite.amountP1,
        P2: contractSite.amountP2,
        P3: contractSite.amountP3,
      },
      currentAmounts: {
        P1: contractSite.amountP1,
        P2: contractSite.amountP2,
        P3: contractSite.amountP3,
      },
      yearType: contract.yearType,
      yearlyPrices,
      priceChanges: contractSite.priceChanges,
    });
  } catch (error) {
    console.error("Error calculating prices:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des prix" },
      { status: 500 }
    );
  }
}
