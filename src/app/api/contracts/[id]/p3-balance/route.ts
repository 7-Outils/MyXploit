import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

interface P3YearData {
  year: string;
  label: string;
  invoices: {
    id: string;
    reference: string;
    issueDate: string;
    amount: number;
    siteName: string;
  }[];
  quotes: {
    id: string;
    reference: string;
    title: string;
    issueDate: string;
    amountHT: number;
    status: string;
    siteName: string | null;
  }[];
  totalInvoices: number;  // Recettes P3 (alimentation du pot)
  totalQuotes: number;    // Dépenses P3 (consommation du pot)
  balance: number;        // Solde de l'année
  cumulativeBalance: number; // Solde cumulé depuis début contrat
}

interface P3BalanceResponse {
  contractId: string;
  contractReference: string;
  startDate: string;
  endDate: string;
  years: P3YearData[];
  totals: {
    totalInvoices: number;
    totalQuotes: number;
    finalBalance: number;
  };
}

// GET /api/contracts/[id]/p3-balance - Get P3 balance for a contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

    // Get contract with dates
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        reference: true,
        startDate: true,
        endDate: true,
        yearType: true,
        yearStartMonth: true,
        yearStartDay: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    // Get all P3 invoices for this contract
    const invoices = await prisma.invoice.findMany({
      where: {
        contractId,
        type: "P3",
        organizationId: user.organizationId,
      },
      include: {
        site: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    });

    // Get all P3 quotes (validated) for this contract
    const quotes = await prisma.quote.findMany({
      where: {
        contractId,
        quoteType: "P3",
        status: { in: ["ACCEPTE", "COMMANDE", "FACTURE"] },
        organizationId: user.organizationId,
      },
      include: {
        site: { select: { name: true } },
      },
      orderBy: { issueDate: "asc" },
    });

    // Group by year (based on contract year type)
    const getYearKey = (date: Date): string => {
      if (contract.yearType === "HEATING_SEASON") {
        // Heating season: October to September
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        if (month >= contract.yearStartMonth) {
          return `${year}-${year + 1}`;
        } else {
          return `${year - 1}-${year}`;
        }
      } else {
        // Civil year
        return date.getFullYear().toString();
      }
    };

    const getYearLabel = (key: string): string => {
      if (contract.yearType === "HEATING_SEASON") {
        const [start, end] = key.split("-");
        return `Saison ${start}/${end}`;
      } else {
        return `Année ${key}`;
      }
    };

    // Build year data
    const yearsMap = new Map<string, P3YearData>();

    // Add invoices to years
    for (const invoice of invoices) {
      const yearKey = getYearKey(new Date(invoice.issueDate));
      if (!yearsMap.has(yearKey)) {
        yearsMap.set(yearKey, {
          year: yearKey,
          label: getYearLabel(yearKey),
          invoices: [],
          quotes: [],
          totalInvoices: 0,
          totalQuotes: 0,
          balance: 0,
          cumulativeBalance: 0,
        });
      }
      const yearData = yearsMap.get(yearKey)!;
      yearData.invoices.push({
        id: invoice.id,
        reference: invoice.reference,
        issueDate: invoice.issueDate.toISOString(),
        amount: invoice.amount,
        siteName: invoice.site.name,
      });
      yearData.totalInvoices += invoice.amount;
    }

    // Add quotes to years
    for (const quote of quotes) {
      const yearKey = getYearKey(new Date(quote.issueDate));
      if (!yearsMap.has(yearKey)) {
        yearsMap.set(yearKey, {
          year: yearKey,
          label: getYearLabel(yearKey),
          invoices: [],
          quotes: [],
          totalInvoices: 0,
          totalQuotes: 0,
          balance: 0,
          cumulativeBalance: 0,
        });
      }
      const yearData = yearsMap.get(yearKey)!;
      yearData.quotes.push({
        id: quote.id,
        reference: quote.reference,
        title: quote.title,
        issueDate: quote.issueDate.toISOString(),
        amountHT: quote.amountHT,
        status: quote.status,
        siteName: quote.site?.name || null,
      });
      yearData.totalQuotes += quote.amountHT;
    }

    // Sort years and calculate balances
    const sortedYears = Array.from(yearsMap.values()).sort((a, b) =>
      a.year.localeCompare(b.year)
    );

    let cumulativeBalance = 0;
    for (const yearData of sortedYears) {
      yearData.balance = yearData.totalInvoices - yearData.totalQuotes;
      cumulativeBalance += yearData.balance;
      yearData.cumulativeBalance = cumulativeBalance;
    }

    // Calculate totals
    const totalInvoices = sortedYears.reduce((sum, y) => sum + y.totalInvoices, 0);
    const totalQuotes = sortedYears.reduce((sum, y) => sum + y.totalQuotes, 0);

    const response: P3BalanceResponse = {
      contractId: contract.id,
      contractReference: contract.reference,
      startDate: contract.startDate.toISOString(),
      endDate: contract.endDate.toISOString(),
      years: sortedYears,
      totals: {
        totalInvoices,
        totalQuotes,
        finalBalance: totalInvoices - totalQuotes,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching P3 balance:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du décompte P3" },
      { status: 500 }
    );
  }
}
