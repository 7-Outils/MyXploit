export interface Site {
  id: string;
  name: string;
  city?: string;
}

export interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: {
    contractSites: number;
  };
}

export interface Invoice {
  id: string;
  reference: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  p1SubType: string | null;
  status: "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
  amount: number;
  taxAmount: number | null;
  issueDate: string;
  dueDate: string;
  description: string | null;
  site: Site | null;
  contract: Contract | null;
}

export interface SeasonSite {
  siteId: string;
  siteName: string;
  amountP2: number;
  amountP3: number;
  total: number;
}

export interface Season {
  label: string;
  startDate: string;
  endDate: string;
  totalP2: number;
  totalP3: number;
  total: number;
  sites: SeasonSite[];
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

export interface FinancialData {
  contract?: {
    id: string;
    reference: string;
    title: string;
    startDate: string;
    endDate: string;
    yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  };
  summary: {
    currentSeasonLabel: string;
    currentSeasonTotal: number;
    currentSeasonPaid: number;
    currentSeasonRemaining: number;
    totalPastSeasons: number;
    totalFutureSeasons: number;
    totalContract: number;
    seasonCount: number;
  };
  seasons: Season[];
  periodLabel?: string;
}

export interface P3YearData {
  year: string;
  label: string;
  invoices: { id: string; reference: string; issueDate: string; amount: number; siteName: string }[];
  quotes: { id: string; reference: string; title: string; issueDate: string; amountHT: number; status: string; siteName: string | null }[];
  totalInvoices: number;
  totalQuotes: number;
  balance: number;
  cumulativeBalance: number;
}

export interface P3BalanceData {
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

export interface SiteP3Analytics {
  siteId: string;
  siteName: string;
  siteCity: string;
  p3Invoices: number;
  p3InvoiceCount: number;
  p3Quotes: number;
  p3QuoteCount: number;
  p3Balance: number;
}

export interface SiteAnalyticsData {
  contractId: string;
  contractReference: string;
  sites: SiteP3Analytics[];
  totals: {
    p3Invoices: number;
    p3Quotes: number;
    p3Balance: number;
  };
}

export type Tab = "facturation" | "budget" | "decompte-p3" | "devis";
export type StatusFilter = "ALL" | "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
export type TypeFilter = "ALL" | "P1" | "P2" | "P3";
