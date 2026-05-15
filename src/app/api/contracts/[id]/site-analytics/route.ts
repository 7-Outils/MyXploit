import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

interface SiteP3Analytics {
  siteId: string;
  siteName: string;
  siteCity: string;
  p3Invoices: number;
  p3InvoiceCount: number;
  p3Quotes: number;
  p3QuoteCount: number;
  p3Balance: number;
}

interface SiteP3Internal extends SiteP3Analytics {
  amountP3Contract: number;
}

interface SiteP3AnalyticsResponse {
  contractId: string;
  contractReference: string;
  sites: SiteP3Analytics[];
  totals: {
    p3Invoices: number;
    p3Quotes: number;
    p3Balance: number;
  };
}

// GET /api/contracts/[id]/site-analytics - Get P3 balance per site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    // Get contract
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: effectiveOrgId,
      },
      select: {
        id: true,
        reference: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Get all sites for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      select: {
        amountP3: true,
        site: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    // Get P3 invoices only
    const invoices = await prisma.invoice.findMany({
      where: {
        contractId,
        type: "P3",
        organizationId: effectiveOrgId,
      },
      select: {
        siteId: true,
        amount: true,
      },
    });

    // Get P3 validated quotes - filtre aligné sur p3-balance:
    // RÈGLE MÉTIER: ne compter que les travaux clôturés (= dépenses effectives)
    // pour rester cohérent avec le décompte P3 par année.
    const quotes = await prisma.quote.findMany({
      where: {
        contractId,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
        organizationId: effectiveOrgId,
        OR: [
          { workOrder: { status: "CLOTURE" } },
          { workOrder: null }, // rétrocompat anciens devis sans WorkOrder
        ],
      },
      select: {
        siteId: true,
        amountHT: true,
      },
    });

    // Build analytics per site
    const sitesMap = new Map<string, SiteP3Internal>();

    // Initialize with contract sites
    for (const cs of contractSites) {
      sitesMap.set(cs.site.id, {
        siteId: cs.site.id,
        siteName: cs.site.name,
        siteCity: cs.site.city,
        amountP3Contract: cs.amountP3 ?? 0,
        p3Invoices: 0,
        p3InvoiceCount: 0,
        p3Quotes: 0,
        p3QuoteCount: 0,
        p3Balance: 0,
      });
    }

    const totalContractP3 = [...sitesMap.values()].reduce((sum, s) => sum + s.amountP3Contract, 0);

    // Add P3 invoices
    for (const invoice of invoices) {
      if (invoice.siteId) {
        const siteData = sitesMap.get(invoice.siteId);
        if (siteData) {
          siteData.p3InvoiceCount++;
          siteData.p3Invoices += invoice.amount;
        }
      } else if (totalContractP3 > 0) {
        for (const siteData of sitesMap.values()) {
          const ratio = siteData.amountP3Contract / totalContractP3;
          siteData.p3InvoiceCount++;
          siteData.p3Invoices += invoice.amount * ratio;
        }
      }
    }

    // Add P3 quotes
    for (const quote of quotes) {
      if (!quote.siteId) continue;
      const siteData = sitesMap.get(quote.siteId);
      if (siteData) {
        siteData.p3QuoteCount++;
        siteData.p3Quotes += quote.amountHT;
      }
    }

    // Calculate P3 balance per site
    const sites: SiteP3Analytics[] = [];
    for (const siteData of sitesMap.values()) {
      siteData.p3Balance = siteData.p3Invoices - siteData.p3Quotes;
      if (siteData.p3Invoices > 0 || siteData.p3Quotes > 0) {
        const { amountP3Contract: _, ...rest } = siteData;
        sites.push(rest);
      }
    }

    // Sort by P3 balance (ascending - most negative first to highlight overspenders)
    sites.sort((a, b) => a.p3Balance - b.p3Balance);

    // Calculate totals
    const totals = sites.reduce(
      (acc, site) => ({
        p3Invoices: acc.p3Invoices + site.p3Invoices,
        p3Quotes: acc.p3Quotes + site.p3Quotes,
        p3Balance: acc.p3Balance + site.p3Balance,
      }),
      {
        p3Invoices: 0,
        p3Quotes: 0,
        p3Balance: 0,
      }
    );

    const response: SiteP3AnalyticsResponse = {
      contractId: contract.id,
      contractReference: contract.reference,
      sites,
      totals,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching site analytics:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analyses" },
      { status: 500 }
    );
  }
}
