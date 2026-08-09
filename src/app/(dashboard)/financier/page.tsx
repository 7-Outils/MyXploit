"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import useSWR, { preload } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useSearchParams, useRouter } from "next/navigation";
import { useContract } from "@/contexts/ContractContext";
import {
  Receipt,
  Loader2,
  PiggyBank,
  FileText,
} from "lucide-react";

// Types
import type {
  Site,
  Invoice,
  P3BalanceData,
  SiteAnalyticsData,
  Tab,
  StatusFilter,
  TypeFilter,
} from "@/components/financier/types";

// Tabs
import { FacturationTab } from "@/components/financier/tabs/FacturationTab";
import { DecompteP3Tab } from "@/components/financier/tabs/DecompteP3Tab";
import DevisP3Content from "@/components/exploitation/DevisP3Content";

// Modals
import { ImportModal } from "@/components/financier/modals/ImportModal";
import { InvoiceModal } from "@/components/financier/modals/InvoiceModal";

import { sortTabsAlpha } from "@/lib/utils";

// Doit rester aligné sur le PAGE_SIZE de FacturationTab.
const INVOICE_PAGE_SIZE = 30;

const FINANCIER_TABS = sortTabsAlpha([
  { id: "facturation" as Tab, label: "Facturation", icon: Receipt },
  { id: "decompte-p3" as Tab, label: "Solde P3", icon: PiggyBank },
  { id: "devis" as Tab, label: "Devis", icon: FileText },
]);

function FinancierPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || FINANCIER_TABS[0].id;

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract from global context
  const { selectedContract, isLoading: loadingContracts } = useContract();

  // SWR-cached data (survives tab switches)
  const contractKey = selectedContract?.id;

  // Les filtres et la page pilotent la clé : le serveur filtre et pagine.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [invoicePage, setInvoicePage] = useState(1);

  const invoicesKey = useMemo(() => {
    if (!contractKey) return null;
    const p = new URLSearchParams({
      contractId: contractKey,
      page: String(invoicePage),
      pageSize: String(INVOICE_PAGE_SIZE),
    });
    if (statusFilter !== "ALL") p.set("status", statusFilter);
    if (typeFilter !== "ALL") p.set("type", typeFilter);
    return `/api/invoices?${p.toString()}`;
  }, [contractKey, invoicePage, statusFilter, typeFilter]);

  const { data: invoicesPage, isLoading: loadingInvoices, mutate: mutateInvoices } = useSWR<{
    data: Invoice[];
    total: number;
  }>(invoicesKey, fetcher, { keepPreviousData: true });
  const { data: p3DataRaw, isLoading: loadingP3 } = useSWR<P3BalanceData>(
    contractKey ? `/api/contracts/${contractKey}/p3-balance` : null, fetcher
  );
  const { data: siteAnalyticsData, isLoading: loadingSiteAnalytics } = useSWR<SiteAnalyticsData>(
    contractKey ? `/api/contracts/${contractKey}/site-analytics` : null, fetcher
  );
  const { data: contractSitesData } = useSWR<Site[]>(
    contractKey ? `/api/contracts/${contractKey}/sites` : null, fetcher
  );

  const invoices = useMemo(() => invoicesPage?.data ?? [], [invoicesPage]);
  const totalInvoices = invoicesPage?.total ?? 0;
  const p3Data = p3DataRaw ?? null;
  const siteAnalytics = siteAnalyticsData ?? null;
  const contractSites = useMemo(() => contractSitesData ?? [], [contractSitesData]);

  const [acceptingInvoiceId, setAcceptingInvoiceId] = useState<string | null>(null);
  const [refusingInvoiceId, setRefusingInvoiceId] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedP3Years, setExpandedP3Years] = useState<Set<string>>(new Set());

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
    type: "P1" as "P1" | "P2" | "P3",
    amount: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    description: "",
    siteId: "",
    contractId: "",
  });
  const [formData, setFormData] = useState({
    reference: "",
    type: "P1" as "P1" | "P2" | "P3",
    p1SubType: "",
    amount: "",
    issueDate: "",
    description: "",
  });

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (selectedContract) {
      params.set("contractId", selectedContract.id);
    }
    router.push(`/financier?${params.toString()}`, { scroll: false });
  };


  // Expand most recent P3 year by default when data arrives
  useEffect(() => {
    if (p3Data?.years && p3Data.years.length > 0 && expandedP3Years.size === 0) {
      const last = p3Data.years[p3Data.years.length - 1];
      setExpandedP3Years(new Set([last.year]));
    }
  }, [p3Data, expandedP3Years.size]);

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
          contractId: selectedContract.id,
        }),
      });
      if (response.ok) {
        mutateInvoices();
        setShowInvoiceModal(false);
        setFormData({
          reference: "",
          type: "P1",
          p1SubType: "",
          amount: "",
          issueDate: "",
          description: "",
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvoice = async (invoiceId: string) => {
    if (!confirm("Valider cette facture ?")) return;
    setAcceptingInvoiceId(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/accept`, { method: "POST" });
      if (response.ok) {
        const updated: Invoice = await response.json();
        mutateInvoices(
          (prev) =>
            prev && { ...prev, data: prev.data.map((i) => (i.id === invoiceId ? updated : i)) },
          false
        );
      }
    } catch (error) {
      console.error("Error accepting invoice:", error);
    } finally {
      setAcceptingInvoiceId(null);
    }
  };

  const handleRefuseInvoice = async (invoiceId: string) => {
    if (!confirm("Refuser cette facture ?")) return;
    setRefusingInvoiceId(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/refuse`, { method: "POST" });
      if (response.ok) {
        const updated: Invoice = await response.json();
        mutateInvoices(
          (prev) =>
            prev && { ...prev, data: prev.data.map((i) => (i.id === invoiceId ? updated : i)) },
          false
        );
      }
    } catch (error) {
      console.error("Error refusing invoice:", error);
    } finally {
      setRefusingInvoiceId(null);
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
      mutateInvoices();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };


  const toggleP3Year = (year: string) => {
    setExpandedP3Years((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  // Le filtrage est fait en SQL : `invoices` est déjà la page filtrée.
  // Retour à la première page dès qu'un filtre change.
  useEffect(() => { setInvoicePage(1); }, [statusFilter, typeFilter]);


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
          <p className="text-text-secondary">Sélectionnez un contrat dans la barre supérieure pour accéder au suivi financier</p>
        </div>
      </div>
    );
  }

  // Contract selected
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {FINANCIER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              onMouseEnter={() => {
                if (!selectedContract) return;
                if (tab.id === "facturation") {
                  // Doit refléter la clé construite plus haut (1re page, sans filtre).
                  preload(
                    `/api/invoices?contractId=${selectedContract.id}&page=1&pageSize=${INVOICE_PAGE_SIZE}`,
                    fetcher
                  );
                } else if (tab.id === "decompte-p3") {
                  preload(`/api/contracts/${selectedContract.id}/p3-balance`, fetcher);
                  preload(`/api/contracts/${selectedContract.id}/site-analytics`, fetcher);
                } else if (tab.id === "devis") {
                  // Doit refléter exactement la clé construite par DevisP3Content
                  // (première page, sans filtre), sinon on précharge dans le vide.
                  preload(
                    `/api/quotes?contractId=${selectedContract.id}&page=1&pageSize=30`,
                    fetcher
                  );
                  preload(`/api/contracts/${selectedContract.id}/sites`, fetcher);
                }
              }}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-text-secondary hover:text-primary-dark"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "facturation" && (
        <FacturationTab
          loading={loadingInvoices}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          invoices={invoices}
          totalInvoices={totalInvoices}
          currentPage={invoicePage}
          setCurrentPage={setInvoicePage}
          handleAcceptInvoice={handleAcceptInvoice}
          handleRefuseInvoice={handleRefuseInvoice}
          acceptingInvoiceId={acceptingInvoiceId}
          refusingInvoiceId={refusingInvoiceId}
          setShowImportModal={setShowImportModal}
          setShowInvoiceModal={setShowInvoiceModal}
        />
      )}


      {activeTab === "decompte-p3" && (
        <DecompteP3Tab
          loading={loadingP3}
          p3Data={p3Data}
          expandedP3Years={expandedP3Years}
          toggleP3Year={toggleP3Year}
          siteAnalytics={siteAnalytics}
          loadingSiteAnalytics={loadingSiteAnalytics}
        />
      )}

      {activeTab === "devis" && selectedContract && (
        <DevisP3Content contractId={selectedContract.id} />
      )}

      {/* Modals */}
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
          loadingContractSites={false}
          creating={creating}
          handleImportSubmit={handleImportSubmit}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          formData={formData}
          setFormData={setFormData}
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
