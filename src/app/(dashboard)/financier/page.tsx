"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Receipt,
  Plus,
  Check,
  X,
  Clock,
  Euro,
  Loader2,
  Upload,
  FileUp,
  AlertCircle,
  MapPin,
  FileText,
  Building2,
  Users,
  Trash2,
  Filter,
  ChevronDown,
  ChevronRight,
  Calendar,
  TrendingUp,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

// Types
interface Site {
  id: string;
  name: string;
  city?: string;
}

interface Contract {
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

interface Invoice {
  id: string;
  reference: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  status: "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
  amount: number;
  taxAmount: number | null;
  issueDate: string;
  dueDate: string;
  description: string | null;
  site: Site | null;
  contract: Contract | null;
}

interface SeasonSite {
  siteId: string;
  siteName: string;
  amountP2: number;
  amountP3: number;
  total: number;
}

interface Season {
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

interface FinancialData {
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

interface P3YearData {
  year: string;
  label: string;
  invoices: { id: string; reference: string; issueDate: string; amount: number; siteName: string }[];
  quotes: { id: string; reference: string; title: string; issueDate: string; amountHT: number; status: string; siteName: string | null }[];
  totalInvoices: number;
  totalQuotes: number;
  balance: number;
  cumulativeBalance: number;
}

interface P3BalanceData {
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

interface SiteAnalyticsData {
  contractId: string;
  contractReference: string;
  sites: SiteP3Analytics[];
  totals: {
    p3Invoices: number;
    p3Quotes: number;
    p3Balance: number;
  };
}

// Configs
const typeConfig = {
  P1: { label: "P1 - Énergie", color: "bg-orange-100 text-orange-700" },
  P2: { label: "P2 - Petit entretien", color: "bg-blue-100 text-blue-700" },
  P3: { label: "P3 - Gros entretien", color: "bg-purple-100 text-purple-700" },
  TRAVAUX: { label: "Travaux", color: "bg-green-100 text-green-700" },
  AUTRE: { label: "Autre", color: "bg-gray-100 text-gray-700" },
};

const statusConfig = {
  BROUILLON: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  EN_ATTENTE: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  VALIDEE: { label: "Validée", color: "bg-green-100 text-green-700", icon: Check },
  REJETEE: { label: "Rejetée", color: "bg-red-100 text-red-700", icon: X },
  PAYEE: { label: "Payée", color: "bg-blue-100 text-blue-700", icon: Check },
};

type Tab = "facturation" | "budget" | "decompte-p3" | "analyse-sites";
type StatusFilter = "ALL" | "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
type TypeFilter = "ALL" | "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";

function FinancierPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "facturation";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // Facturation state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [contractSites, setContractSites] = useState<Site[]>([]);
  const [loadingContractSites, setLoadingContractSites] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Budget state
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  // Décompte P3 state
  const [p3Data, setP3Data] = useState<P3BalanceData | null>(null);
  const [loadingP3, setLoadingP3] = useState(false);
  const [expandedP3Years, setExpandedP3Years] = useState<Set<string>>(new Set());

  // Site analytics state
  const [siteAnalytics, setSiteAnalytics] = useState<SiteAnalyticsData | null>(null);
  const [loadingSiteAnalytics, setLoadingSiteAnalytics] = useState(false);

  // Form data
  const [importPreview, setImportPreview] = useState<{
    reference: string | null;
    siteName: string | null;
    siteCity: string | null;
    objet: string | null;
    amountHT: number | null;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchedSiteId, setMatchedSiteId] = useState<string | null>(null);
  const [importFormData, setImportFormData] = useState({
    reference: "",
    type: "P1" as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
    amount: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    description: "",
    siteId: "",
    contractId: "",
  });
  const [formData, setFormData] = useState({
    reference: "",
    type: "P1" as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
    amount: "",
    issueDate: "",
    dueDate: "",
    description: "",
    siteId: "",
  });

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    router.push(`/financier?tab=${tab}`, { scroll: false });
  };

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch data when contract selected
  useEffect(() => {
    if (selectedContract) {
      fetchContractSites(selectedContract.id);
      if (activeTab === "facturation") {
        fetchInvoices(selectedContract.id);
      } else if (activeTab === "budget") {
        fetchFinancials(selectedContract.id);
      } else if (activeTab === "decompte-p3") {
        fetchP3Balance(selectedContract.id);
      } else if (activeTab === "analyse-sites") {
        fetchSiteAnalytics(selectedContract.id);
      }
    }
  }, [selectedContract, activeTab]);

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchInvoices = async (contractId: string) => {
    try {
      setLoadingInvoices(true);
      const response = await fetch(`/api/invoices?contractId=${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(Array.isArray(data) ? data : []);
        const currentYear = new Date().getFullYear();
        setExpandedYears(new Set([currentYear]));
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchFinancials = async (contractId: string) => {
    try {
      setLoadingFinancials(true);
      const response = await fetch(`/api/contracts/${contractId}/financials`);
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
        const currentSeason = data.seasons?.find((s: Season) => s.isCurrent);
        if (currentSeason) {
          setExpandedSeasons(new Set([currentSeason.label]));
        }
      }
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setLoadingFinancials(false);
    }
  };

  const fetchP3Balance = async (contractId: string) => {
    try {
      setLoadingP3(true);
      const response = await fetch(`/api/contracts/${contractId}/p3-balance`);
      if (response.ok) {
        const data = await response.json();
        setP3Data(data);
        // Expand the most recent year by default
        if (data.years && data.years.length > 0) {
          const lastYear = data.years[data.years.length - 1];
          setExpandedP3Years(new Set([lastYear.year]));
        }
      }
    } catch (error) {
      console.error("Error fetching P3 balance:", error);
    } finally {
      setLoadingP3(false);
    }
  };

  const fetchSiteAnalytics = async (contractId: string) => {
    try {
      setLoadingSiteAnalytics(true);
      const response = await fetch(`/api/contracts/${contractId}/site-analytics`);
      if (response.ok) {
        const data = await response.json();
        setSiteAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching site analytics:", error);
    } finally {
      setLoadingSiteAnalytics(false);
    }
  };

  const fetchContractSites = async (contractId: string) => {
    if (!contractId) {
      setContractSites([]);
      return;
    }
    setLoadingContractSites(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sites`);
      if (res.ok) {
        const data = await res.json();
        setContractSites(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching contract sites:", error);
      setContractSites([]);
    } finally {
      setLoadingContractSites(false);
    }
  };

  // Invoice handlers
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    setCreating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) || 0,
          siteId: formData.siteId || null,
          contractId: selectedContract.id,
        }),
      });
      if (response.ok) {
        await fetchInvoices(selectedContract.id);
        setShowInvoiceModal(false);
        setFormData({
          reference: "",
          type: "P1",
          amount: "",
          issueDate: "",
          dueDate: "",
          description: "",
          siteId: "",
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    if (!selectedContract) return;
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchInvoices(selectedContract.id);
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!selectedContract) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchInvoices(selectedContract.id);
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportError(null);
    setImportPreview(null);
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const response = await fetch("/api/quotes/import", {
        method: "POST",
        body: fd,
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || "Erreur lors de l'import";
        setImportError(errorMsg);
        return;
      }

      setImportPreview({
        reference: result.parsed.reference,
        siteName: result.parsed.siteName,
        siteCity: result.parsed.siteCity,
        objet: result.parsed.objet,
        amountHT: result.parsed.amountHT,
      });

      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const matchedSite = result.matchedSite?.id || "";
      setImportFormData({
        reference: result.parsed.reference || "",
        type: "P1",
        amount: result.parsed.amountHT?.toString() || "",
        issueDate: issueDate.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        description: result.parsed.objet || "",
        siteId: matchedSite,
        contractId: selectedContract?.id || "",
      });

      if (result.matchedSite) {
        setMatchedSiteId(result.matchedSite.id);
      }
    } catch (error) {
      console.error("Error importing:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur réseau";
      setImportError(`Erreur lors de l'analyse du PDF: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFormData.reference || !selectedContract) {
      setImportError("Veuillez remplir la référence");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: importFormData.reference,
          type: importFormData.type,
          amount: parseFloat(importFormData.amount) || 0,
          issueDate: importFormData.issueDate,
          dueDate: importFormData.dueDate,
          description: importFormData.description || null,
          siteId: importFormData.siteId || null,
          contractId: selectedContract.id,
          status: "BROUILLON",
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la création");
      }

      setShowImportModal(false);
      setSelectedFile(null);
      setImportPreview(null);
      setImportError(null);
      setMatchedSiteId(null);
      setImportFormData({
        reference: "",
        type: "P1",
        amount: "",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        description: "",
        siteId: "",
        contractId: "",
      });
      fetchInvoices(selectedContract.id);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // Toggle helpers
  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleSeason = (label: string) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleP3Year = (year: string) => {
    setExpandedP3Years((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  // Computed values for facturation
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && inv.type !== typeFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, typeFilter]);

  const invoicesByYear = useMemo(() => {
    const groups: Record<number, Invoice[]> = {};
    filteredInvoices.forEach((inv) => {
      const year = new Date(inv.issueDate).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(inv);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, invs]) => ({
        year: Number(year),
        invoices: invs.sort(
          (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
        ),
        total: invs.reduce((sum, i) => sum + i.amount, 0),
      }));
  }, [filteredInvoices]);

  const invoiceStats = useMemo(() => {
    const pending = filteredInvoices.filter((i) => i.status === "EN_ATTENTE");
    const validated = filteredInvoices.filter((i) => i.status === "VALIDEE" || i.status === "PAYEE");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, i) => sum + i.amount, 0),
      validatedAmount: validated.reduce((sum, i) => sum + i.amount, 0),
      totalAmount: filteredInvoices.reduce((sum, i) => sum + i.amount, 0),
      totalCount: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  // Computed values for budget
  const budgetStats = useMemo(() => {
    if (!financialData) return null;
    const { summary, seasons } = financialData;
    const pastSeasons = seasons.filter((s) => s.isPast).length;
    const futureSeasons = seasons.filter((s) => s.isFuture).length;
    return {
      totalContract: summary.totalContract,
      seasonCount: summary.seasonCount,
      pastSeasons,
      futureSeasons,
      averagePerSeason: summary.seasonCount > 0 ? summary.totalContract / summary.seasonCount : 0,
    };
  }, [financialData]);


  // Loading
  if (loadingContracts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No contract selected
  if (!selectedContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Suivi financier</h1>
          <p className="text-text-secondary">Sélectionnez un contrat pour accéder au suivi financier</p>
        </div>

        {contracts.length === 0 ? (
          <ChartCard title="Aucun contrat actif">
            <div className="flex flex-col items-center justify-center py-8">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary">Créez d&apos;abord un contrat</p>
            </div>
          </ChartCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <Euro size={24} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Actif
                  </span>
                </div>
                <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {contract.provider}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {contract._count?.contractSites || 0} sites
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Contract selected
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                setSelectedContract(null);
                setInvoices([]);
                setFinancialData(null);
                setP3Data(null);
                setContractSites([]);
              }}
              className="text-text-secondary hover:text-primary-dark"
            >
              Suivi financier
            </button>
            <span className="text-text-secondary">/</span>
            <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.title}</h1>
          <p className="text-text-secondary">{selectedContract.provider}</p>
        </div>
        <select
          value={selectedContract.id}
          onChange={(e) => {
            const contract = contracts.find((c) => c.id === e.target.value);
            if (contract) setSelectedContract(contract);
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.reference} - {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: "facturation" as Tab, label: "Facturation", icon: Receipt },
            { id: "budget" as Tab, label: "Budget", icon: Wallet },
            { id: "decompte-p3" as Tab, label: "Décompte P3", icon: PiggyBank },
            { id: "analyse-sites" as Tab, label: "Analyse sites", icon: Building2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-text-secondary hover:text-primary-dark"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "facturation" && (
        <FacturationContent
          loading={loadingInvoices}
          invoiceStats={invoiceStats}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          filteredInvoices={filteredInvoices}
          invoicesByYear={invoicesByYear}
          expandedYears={expandedYears}
          toggleYear={toggleYear}
          handleStatusChange={handleStatusChange}
          setShowDeleteConfirm={setShowDeleteConfirm}
          setShowImportModal={setShowImportModal}
          setShowInvoiceModal={setShowInvoiceModal}
        />
      )}

      {activeTab === "budget" && (
        <BudgetContent
          loading={loadingFinancials}
          financialData={financialData}
          budgetStats={budgetStats}
          selectedContract={selectedContract}
          expandedSeasons={expandedSeasons}
          toggleSeason={toggleSeason}
        />
      )}

      {activeTab === "decompte-p3" && (
        <DecompteP3Content
          loading={loadingP3}
          p3Data={p3Data}
          expandedP3Years={expandedP3Years}
          toggleP3Year={toggleP3Year}
        />
      )}

      {activeTab === "analyse-sites" && (
        <SiteAnalyticsContent
          loading={loadingSiteAnalytics}
          data={siteAnalytics}
        />
      )}

      {/* Modals */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={() => handleDeleteInvoice(showDeleteConfirm)}
          deleting={deleting}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => {
            setShowImportModal(false);
            setSelectedFile(null);
            setImportPreview(null);
            setImportError(null);
            setMatchedSiteId(null);
          }}
          fileInputRef={fileInputRef}
          importing={importing}
          selectedFile={selectedFile}
          handleFileSelect={handleFileSelect}
          importError={importError}
          importPreview={importPreview}
          importFormData={importFormData}
          setImportFormData={setImportFormData}
          matchedSiteId={matchedSiteId}
          contractSites={contractSites}
          loadingContractSites={loadingContractSites}
          creating={creating}
          handleImportSubmit={handleImportSubmit}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          formData={formData}
          setFormData={setFormData}
          contractSites={contractSites}
          loadingContractSites={loadingContractSites}
          creating={creating}
          handleCreate={handleCreateInvoice}
        />
      )}
    </div>
  );
}

export default function FinancierPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <FinancierPageContent />
    </Suspense>
  );
}

// Sub-components
function FacturationContent({
  loading,
  invoiceStats,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  filteredInvoices,
  invoicesByYear,
  expandedYears,
  toggleYear,
  handleStatusChange,
  setShowDeleteConfirm,
  setShowImportModal,
  setShowInvoiceModal,
}: {
  loading: boolean;
  invoiceStats: { pendingCount: number; pendingAmount: number; validatedAmount: number; totalAmount: number; totalCount: number };
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
  filteredInvoices: Invoice[];
  invoicesByYear: { year: number; invoices: Invoice[]; total: number }[];
  expandedYears: Set<number>;
  toggleYear: (year: number) => void;
  handleStatusChange: (id: string, status: string) => void;
  setShowDeleteConfirm: (id: string | null) => void;
  setShowImportModal: (v: boolean) => void;
  setShowInvoiceModal: (v: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="En attente"
          value={invoiceStats.pendingCount.toString()}
          change={`${invoiceStats.pendingAmount.toLocaleString("fr-FR")} € à valider`}
          changeType="neutral"
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Validées / Payées"
          value={`${invoiceStats.validatedAmount.toLocaleString("fr-FR")} €`}
          icon={Check}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Total factures"
          value={`${invoiceStats.totalAmount.toLocaleString("fr-FR")} €`}
          icon={Euro}
          iconColor="text-accent"
        />
        <StatsCard
          title="Nombre"
          value={invoiceStats.totalCount.toString()}
          icon={Receipt}
          iconColor="text-blue-600"
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(["ALL", "EN_ATTENTE", "VALIDEE", "PAYEE", "BROUILLON"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === status
                    ? "bg-white shadow text-primary-dark font-medium"
                    : "text-text-secondary hover:text-primary-dark"
                }`}
              >
                {status === "ALL" ? "Toutes" : status === "EN_ATTENTE" ? "En attente" : status === "VALIDEE" ? "Validées" : status === "PAYEE" ? "Payées" : "Brouillon"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-text-secondary" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="ALL">Tous types</option>
              <option value="P1">P1 - Énergie</option>
              <option value="P2">P2 - Petit entretien</option>
              <option value="P3">P3 - Gros entretien</option>
              <option value="TRAVAUX">Travaux</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload size={18} className="mr-2" />
            Importer PDF
          </Button>
          <Button onClick={() => setShowInvoiceModal(true)}>
            <Plus size={18} className="mr-2" />
            Saisir facture
          </Button>
        </div>
      </div>

      {/* Invoices list */}
      {filteredInvoices.length === 0 ? (
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12">
            <Receipt size={48} className="text-gray-300 mb-4" />
            <p className="text-text-secondary mb-4">
              {statusFilter !== "ALL" || typeFilter !== "ALL" ? "Aucune facture avec ces filtres" : "Aucune facture pour ce contrat"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportModal(true)}>
                <Upload size={18} className="mr-2" />
                Importer PDF
              </Button>
              <Button onClick={() => setShowInvoiceModal(true)}>
                <Plus size={18} className="mr-2" />
                Saisir facture
              </Button>
            </div>
          </div>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          {invoicesByYear.map(({ year, invoices: yearInvoices, total }) => {
            const isExpanded = expandedYears.has(year);
            const currentYear = new Date().getFullYear();
            const isCurrent = year === currentYear;

            return (
              <div key={year} className={`border rounded-xl overflow-hidden ${isCurrent ? "border-accent" : "border-gray-200"}`}>
                <button
                  onClick={() => toggleYear(year)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${isCurrent ? "bg-accent/5 hover:bg-accent/10" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary-dark">{year}</span>
                        {isCurrent && <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">En cours</span>}
                      </div>
                      <span className="text-xs text-text-secondary">{yearInvoices.length} facture{yearInvoices.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <p className="font-bold text-primary-dark">{total.toLocaleString("fr-FR")} € HT</p>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {yearInvoices.map((invoice) => {
                      const status = statusConfig[invoice.status];
                      const type = typeConfig[invoice.type];
                      return (
                        <div key={invoice.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                              <Receipt size={18} className="text-accent" />
                            </div>
                            <div>
                              <p className="font-medium text-primary-dark">{invoice.reference}</p>
                              <p className="text-sm text-text-secondary">
                                {new Date(invoice.issueDate).toLocaleDateString("fr-FR")}
                                {invoice.description && ` • ${invoice.description.slice(0, 40)}${invoice.description.length > 40 ? "..." : ""}`}
                              </p>
                              {invoice.site && (
                                <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                                  <MapPin size={12} />
                                  {invoice.site.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-primary-dark">{invoice.amount.toLocaleString("fr-FR")} € HT</p>
                              <p className="text-xs text-text-secondary">Éch. {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}>{invoice.type}</span>
                              <select
                                value={invoice.status}
                                onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${status.color}`}
                              >
                                <option value="BROUILLON">Brouillon</option>
                                <option value="EN_ATTENTE">En attente</option>
                                <option value="VALIDEE">Validée</option>
                                <option value="REJETEE">Rejetée</option>
                                <option value="PAYEE">Payée</option>
                              </select>
                              <button
                                onClick={() => setShowDeleteConfirm(invoice.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function BudgetContent({
  loading,
  financialData,
  budgetStats,
  selectedContract,
  expandedSeasons,
  toggleSeason,
}: {
  loading: boolean;
  financialData: FinancialData | null;
  budgetStats: { totalContract: number; seasonCount: number; pastSeasons: number; futureSeasons: number; averagePerSeason: number } | null;
  selectedContract: Contract;
  expandedSeasons: Set<string>;
  toggleSeason: (label: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!financialData || !budgetStats) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <Euro size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée financière disponible</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Budget total contrat" value={`${budgetStats.totalContract.toLocaleString("fr-FR")} €`} icon={Euro} iconColor="text-accent" />
        <StatsCard title={financialData.periodLabel || "Périodes"} value={budgetStats.seasonCount.toString()} icon={Calendar} iconColor="text-blue-600" />
        <StatsCard title="Moyenne par période" value={`${budgetStats.averagePerSeason.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`} icon={TrendingUp} iconColor="text-green-600" />
        <StatsCard title="Sites" value={(selectedContract._count?.contractSites || 0).toString()} icon={Building2} iconColor="text-purple-600" />
      </div>

      {/* Timeline */}
      <ChartCard title="Répartition budgétaire">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-sm text-text-secondary">Passé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent"></div>
            <span className="text-sm text-text-secondary">En cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-400"></div>
            <span className="text-sm text-text-secondary">À venir</span>
          </div>
        </div>
        <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex mb-4">
          {financialData.seasons.map((season, idx) => {
            const width = (season.total / budgetStats.totalContract) * 100;
            return (
              <div
                key={season.label}
                className={`h-full transition-all ${season.isPast ? "bg-green-500" : season.isCurrent ? "bg-accent" : "bg-blue-400"} ${idx > 0 ? "border-l border-white/30" : ""}`}
                style={{ width: `${width}%` }}
                title={`${season.label}: ${season.total.toLocaleString("fr-FR")} €`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-text-secondary">
          <span>{new Date(selectedContract.startDate).toLocaleDateString("fr-FR")}</span>
          <span>{new Date(selectedContract.endDate).toLocaleDateString("fr-FR")}</span>
        </div>
      </ChartCard>

      {/* Seasons */}
      <ChartCard title={`Détail par ${financialData.periodLabel?.toLowerCase() || "période"}`}>
        <div className="space-y-3">
          {financialData.seasons.map((season) => {
            const isExpanded = expandedSeasons.has(season.label);
            return (
              <div key={season.label} className={`border rounded-xl overflow-hidden ${season.isCurrent ? "border-accent" : season.isPast ? "border-green-200" : "border-gray-200"}`}>
                <button
                  onClick={() => toggleSeason(season.label)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${season.isCurrent ? "bg-accent/5 hover:bg-accent/10" : season.isPast ? "bg-green-50/50 hover:bg-green-50" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary-dark">{season.label}</span>
                        {season.isCurrent && <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">En cours</span>}
                        {season.isPast && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Terminée</span>}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {new Date(season.startDate).toLocaleDateString("fr-FR")} → {new Date(season.endDate).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-dark">{season.total.toLocaleString("fr-FR")} € HT</p>
                    <p className="text-xs text-text-secondary">
                      {season.totalP2 > 0 && `P2: ${season.totalP2.toLocaleString("fr-FR")} €`}
                      {season.totalP2 > 0 && season.totalP3 > 0 && " | "}
                      {season.totalP3 > 0 && `P3: ${season.totalP3.toLocaleString("fr-FR")} €`}
                    </p>
                  </div>
                </button>
                {isExpanded && season.sites.length > 0 && (
                  <div className="border-t border-gray-100 p-4 bg-white">
                    <p className="text-xs font-medium text-text-secondary mb-3">Détail par site ({season.sites.length})</p>
                    <div className="space-y-2">
                      {season.sites.map((site) => (
                        <div key={site.siteId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                              <Building2 size={14} className="text-accent" />
                            </div>
                            <span className="font-medium text-primary-dark text-sm">{site.siteName}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-primary-dark text-sm">{site.total.toLocaleString("fr-FR")} €</p>
                            <p className="text-xs text-text-secondary">
                              {site.amountP2 > 0 && `P2: ${site.amountP2.toLocaleString("fr-FR")} €`}
                              {site.amountP2 > 0 && site.amountP3 > 0 && " | "}
                              {site.amountP3 > 0 && `P3: ${site.amountP3.toLocaleString("fr-FR")} €`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ChartCard>
    </>
  );
}

function DecompteP3Content({
  loading,
  p3Data,
  expandedP3Years,
  toggleP3Year,
}: {
  loading: boolean;
  p3Data: P3BalanceData | null;
  expandedP3Years: Set<string>;
  toggleP3Year: (year: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!p3Data) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée P3 disponible</p>
        </div>
      </ChartCard>
    );
  }

  const { totals, years } = p3Data;

  return (
    <>
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard title="Factures P3 (encaissements)" value={`${totals.totalInvoices.toLocaleString("fr-FR")} €`} icon={ArrowUpRight} iconColor="text-green-600" />
        <StatsCard title="Devis P3 (dépenses)" value={`${totals.totalQuotes.toLocaleString("fr-FR")} €`} icon={ArrowDownRight} iconColor="text-red-600" />
        <StatsCard
          title="Solde cagnotte P3"
          value={`${totals.finalBalance.toLocaleString("fr-FR")} €`}
          icon={PiggyBank}
          iconColor={totals.finalBalance >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* By year */}
      {years.length === 0 ? (
        <ChartCard title="">
          <div className="text-center py-12">
            <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucun mouvement P3</p>
          </div>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          {[...years].reverse().map((yearData) => {
            const { year, label, invoices, quotes, totalInvoices, totalQuotes, balance, cumulativeBalance } = yearData;
            const isExpanded = expandedP3Years.has(year);
            const currentYear = new Date().getFullYear().toString();
            const isCurrent = year === currentYear || year.startsWith(currentYear);

            return (
              <div key={year} className={`border rounded-xl overflow-hidden ${isCurrent ? "border-accent" : "border-gray-200"}`}>
                <button
                  onClick={() => toggleP3Year(year)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${isCurrent ? "bg-accent/5 hover:bg-accent/10" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary-dark">{label}</span>
                        {isCurrent && <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">En cours</span>}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {invoices.length} facture{invoices.length > 1 ? "s" : ""} • {quotes.length} devis
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {balance >= 0 ? "+" : ""}
                      {balance.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">Solde cumulé: {cumulativeBalance.toLocaleString("fr-FR")} €</p>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-white space-y-4">
                    {invoices.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                          <ArrowUpRight size={14} />
                          Factures P3 (+{totalInvoices.toLocaleString("fr-FR")} €)
                        </p>
                        <div className="space-y-2">
                          {invoices.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                              <div>
                                <p className="font-medium text-primary-dark text-sm">{inv.reference}</p>
                                <p className="text-xs text-text-secondary">
                                  {new Date(inv.issueDate).toLocaleDateString("fr-FR")}
                                  {inv.siteName && ` • ${inv.siteName}`}
                                </p>
                              </div>
                              <p className="font-medium text-green-600">+{inv.amount.toLocaleString("fr-FR")} €</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {quotes.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                          <ArrowDownRight size={14} />
                          Devis P3 (-{totalQuotes.toLocaleString("fr-FR")} €)
                        </p>
                        <div className="space-y-2">
                          {quotes.map((q) => (
                            <div key={q.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                              <div>
                                <p className="font-medium text-primary-dark text-sm">{q.reference}</p>
                                <p className="text-xs text-text-secondary">
                                  {new Date(q.issueDate).toLocaleDateString("fr-FR")}
                                  {q.siteName && ` • ${q.siteName}`}
                                </p>
                              </div>
                              <p className="font-medium text-red-600">-{q.amountHT.toLocaleString("fr-FR")} €</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SiteAnalyticsContent({
  loading,
  data,
}: {
  loading: boolean;
  data: SiteAnalyticsData | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée disponible</p>
        </div>
      </ChartCard>
    );
  }

  const { sites, totals } = data;

  // Sites with negative P3 balance (overspent P3)
  const p3OverspentSites = sites.filter(s => s.p3Balance < 0);
  const p3PositiveSites = sites.filter(s => s.p3Balance > 0);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard
          title="Factures P3 (encaissements)"
          value={`${totals.p3Invoices.toLocaleString("fr-FR")} €`}
          icon={ArrowUpRight}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Devis P3 (dépenses)"
          value={`${totals.p3Quotes.toLocaleString("fr-FR")} €`}
          icon={ArrowDownRight}
          iconColor="text-red-600"
        />
        <StatsCard
          title="Solde P3 global"
          value={`${totals.p3Balance.toLocaleString("fr-FR")} €`}
          icon={PiggyBank}
          iconColor={totals.p3Balance >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Alerts */}
      {p3OverspentSites.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Sites avec solde P3 négatif</p>
              <p className="text-sm text-red-700 mt-1">
                {p3OverspentSites.length} site{p3OverspentSites.length > 1 ? "s ont" : " a"} sur-consommé leur cagnotte P3.
                À prévoir pour le prochain contrat : augmenter le P3 ou réduire les interventions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sites table */}
      <ChartCard title="Décompte P3 par site">
        {sites.length === 0 ? (
          <div className="text-center py-8">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucun site avec activité P3</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Site</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-green-600">Factures P3</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-red-600">Devis P3</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-primary-dark">Solde P3</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const isP3Negative = site.p3Balance < 0;
                  return (
                    <tr
                      key={site.siteId}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isP3Negative ? "bg-red-50/50" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary-dark">{site.siteName}</span>
                          {isP3Negative && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Déficit</span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">{site.siteCity}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-green-600">
                        +{site.p3Invoices.toLocaleString("fr-FR")} €
                        <span className="text-xs text-text-secondary ml-1">({site.p3InvoiceCount})</span>
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">
                        -{site.p3Quotes.toLocaleString("fr-FR")} €
                        <span className="text-xs text-text-secondary ml-1">({site.p3QuoteCount})</span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isP3Negative ? "text-red-600" : "text-green-600"}`}>
                        {site.p3Balance >= 0 ? "+" : ""}{site.p3Balance.toLocaleString("fr-FR")} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4 text-primary-dark">Total ({sites.length} sites)</td>
                  <td className="py-3 px-4 text-right text-green-600">+{totals.p3Invoices.toLocaleString("fr-FR")} €</td>
                  <td className="py-3 px-4 text-right text-red-600">-{totals.p3Quotes.toLocaleString("fr-FR")} €</td>
                  <td className={`py-3 px-4 text-right ${totals.p3Balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totals.p3Balance >= 0 ? "+" : ""}{totals.p3Balance.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Recommendation */}
      <div className="p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-700">
          <strong>Pour le prochain contrat :</strong> Les sites en déficit P3 nécessitent soit une augmentation
          du montant P3 annuel, soit une réduction des interventions. Les sites avec excédent peuvent voir
          leur P3 réduit si le matériel est en bon état.
        </p>
        {p3OverspentSites.length > 0 && (
          <p className="text-sm text-red-700 mt-2">
            <strong>Déficit total à combler :</strong> {Math.abs(p3OverspentSites.reduce((sum, s) => sum + s.p3Balance, 0)).toLocaleString("fr-FR")} €
            sur {p3OverspentSites.length} site{p3OverspentSites.length > 1 ? "s" : ""}
          </p>
        )}
        {p3PositiveSites.length > 0 && (
          <p className="text-sm text-green-700 mt-2">
            <strong>Excédent disponible :</strong> {p3PositiveSites.reduce((sum, s) => sum + s.p3Balance, 0).toLocaleString("fr-FR")} €
            sur {p3PositiveSites.length} site{p3PositiveSites.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </>
  );
}

// Modal components
function DeleteConfirmModal({ onClose, onConfirm, deleting }: { onClose: () => void; onConfirm: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-primary-dark mb-2">Supprimer la facture ?</h3>
        <p className="text-text-secondary mb-6">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
            Annuler
          </Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 size={18} className="animate-spin" /> : "Supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  onClose,
  fileInputRef,
  importing,
  selectedFile,
  handleFileSelect,
  importError,
  importPreview,
  importFormData,
  setImportFormData,
  matchedSiteId,
  contractSites,
  loadingContractSites,
  creating,
  handleImportSubmit,
}: {
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importing: boolean;
  selectedFile: File | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  importPreview: { reference: string | null; siteName: string | null; siteCity: string | null; objet: string | null; amountHT: number | null } | null;
  importFormData: { reference: string; type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE"; amount: string; issueDate: string; dueDate: string; description: string; siteId: string; contractId: string };
  setImportFormData: (data: { reference: string; type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE"; amount: string; issueDate: string; dueDate: string; description: string; siteId: string; contractId: string }) => void;
  matchedSiteId: string | null;
  contractSites: Site[];
  loadingContractSites: boolean;
  creating: boolean;
  handleImportSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Importer une facture PDF</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"}`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" disabled={importing} />
            {importing ? (
              <>
                <Loader2 size={40} className="mx-auto text-accent animate-spin mb-3" />
                <p className="text-text-secondary">Analyse du PDF en cours...</p>
              </>
            ) : selectedFile ? (
              <>
                <FileUp size={40} className="mx-auto text-accent mb-3" />
                <p className="font-medium text-primary-dark">{selectedFile.name}</p>
              </>
            ) : (
              <>
                <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="font-medium text-primary-dark">Cliquez pour sélectionner un PDF</p>
              </>
            )}
          </div>
          {importError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}
          {importPreview && (
            <div className="space-y-4">
              <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
                <Check size={18} className="text-green-600" />
                <span className="text-sm text-green-800">PDF analysé</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">N° Facture *</label>
                <input
                  type="text"
                  value={importFormData.reference}
                  onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value } as typeof importFormData)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type</label>
                  <select
                    value={importFormData.type}
                    onChange={(e) => setImportFormData({ ...importFormData, type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE" })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="P1">P1 - Énergie</option>
                    <option value="P2">P2 - Petit entretien</option>
                    <option value="P3">P3 - Gros entretien</option>
                    <option value="TRAVAUX">Travaux</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Montant HT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importFormData.amount}
                    onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date émission</label>
                  <input
                    type="date"
                    value={importFormData.issueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, issueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date échéance</label>
                  <input
                    type="date"
                    value={importFormData.dueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, dueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
                  {matchedSiteId && <span className="text-green-600 text-xs ml-1">(détecté)</span>}
                </label>
                <select
                  value={importFormData.siteId}
                  onChange={(e) => setImportFormData({ ...importFormData, siteId: e.target.value } as typeof importFormData)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  disabled={loadingContractSites}
                >
                  <option value="">{loadingContractSites ? "Chargement..." : "Tous les sites"}</option>
                  {contractSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} {site.city && `(${site.city})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary mt-1">Laisser vide si la facture concerne tous les sites</p>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            {importPreview && (
              <Button className="flex-1" onClick={handleImportSubmit} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importer"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({
  onClose,
  formData,
  setFormData,
  contractSites,
  loadingContractSites,
  creating,
  handleCreate,
}: {
  onClose: () => void;
  formData: { reference: string; type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE"; amount: string; issueDate: string; dueDate: string; description: string; siteId: string };
  setFormData: (data: { reference: string; type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE"; amount: string; issueDate: string; dueDate: string; description: string; siteId: string }) => void;
  contractSites: Site[];
  loadingContractSites: boolean;
  creating: boolean;
  handleCreate: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Nouvelle facture</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
              <input
                type="text"
                required
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE" })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="P1">P1 - Énergie</option>
                <option value="P2">P2 - Petit entretien</option>
                <option value="P3">P3 - Gros entretien</option>
                <option value="TRAVAUX">Travaux</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Montant HT (€) *</label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date émission *</label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date échéance *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              disabled={loadingContractSites}
            >
              <option value="">{loadingContractSites ? "Chargement..." : "Tous les sites"}</option>
              {contractSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} {site.city && `(${site.city})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">Laisser vide si la facture concerne tous les sites</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} type="button">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={creating}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
