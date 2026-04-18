"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
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
import { DeleteConfirmModal } from "@/components/financier/modals/DeleteConfirmModal";
import { ImportModal } from "@/components/financier/modals/ImportModal";
import { InvoiceModal } from "@/components/financier/modals/InvoiceModal";

function FinancierPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "facturation";

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract from global context
  const { selectedContract, isLoading: loadingContracts } = useContract();

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
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (selectedContract) {
      params.set("contractId", selectedContract.id);
    }
    router.push(`/financier?${params.toString()}`, { scroll: false });
  };


  // Fetch data when contract selected
  useEffect(() => {
    if (selectedContract) {
      fetchContractSites(selectedContract.id);
      if (activeTab === "facturation") {
        fetchInvoices(selectedContract.id);
      } else if (activeTab === "decompte-p3") {
        fetchP3Balance(selectedContract.id);
        fetchSiteAnalytics(selectedContract.id);
      }
    }
  }, [selectedContract, activeTab]);

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
          {[
            { id: "facturation" as Tab, label: "Facturation", icon: Receipt },
            { id: "decompte-p3" as Tab, label: "Solde P3", icon: PiggyBank },
            { id: "devis" as Tab, label: "Devis", icon: FileText },
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
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "facturation" && (
        <FacturationTab
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
