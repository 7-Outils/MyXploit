"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

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

const typeConfig = {
  P1: { label: "P1 - Énergie", color: "bg-orange-100 text-orange-700" },
  P2: { label: "P2 - Petit entretien", color: "bg-blue-100 text-blue-700" },
  P3: { label: "P3 - Gros entretien", color: "bg-purple-100 text-purple-700" },
  TRAVAUX: { label: "Travaux", color: "bg-green-100 text-green-700" },
  AUTRE: { label: "Autre", color: "bg-gray-100 text-gray-700" },
};

const statusConfig = {
  BROUILLON: {
    label: "Brouillon",
    color: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  EN_ATTENTE: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  VALIDEE: {
    label: "Validée",
    color: "bg-green-100 text-green-700",
    icon: Check,
  },
  REJETEE: {
    label: "Rejetée",
    color: "bg-red-100 text-red-700",
    icon: X,
  },
  PAYEE: {
    label: "Payée",
    color: "bg-blue-100 text-blue-700",
    icon: Check,
  },
};

type StatusFilter = "ALL" | "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
type TypeFilter = "ALL" | "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";

export default function InvoicesPage() {
  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [contractSites, setContractSites] = useState<Site[]>([]);
  const [loadingContractSites, setLoadingContractSites] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import form data
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

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch invoices when contract selected
  useEffect(() => {
    if (selectedContract) {
      fetchInvoices(selectedContract.id);
      fetchContractSites(selectedContract.id);
    }
  }, [selectedContract]);

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
        // Expand current year by default
        const currentYear = new Date().getFullYear();
        setExpandedYears(new Set([currentYear]));
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoadingInvoices(false);
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

  const handleCreate = async (e: React.FormEvent) => {
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
        setShowModal(false);
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

  const handleDelete = async (invoiceId: string) => {
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
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/quotes/import", {
        method: "POST",
        body: formData,
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

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Filter and group invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && inv.type !== typeFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, typeFilter]);

  // Group by year
  const invoicesByYear = useMemo(() => {
    const groups: Record<number, Invoice[]> = {};
    filteredInvoices.forEach((inv) => {
      const year = new Date(inv.issueDate).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(inv);
    });
    // Sort years descending
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

  // Stats
  const stats = useMemo(() => {
    const pending = filteredInvoices.filter((i) => i.status === "EN_ATTENTE");
    const validated = filteredInvoices.filter(
      (i) => i.status === "VALIDEE" || i.status === "PAYEE"
    );
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, i) => sum + i.amount, 0),
      validatedAmount: validated.reduce((sum, i) => sum + i.amount, 0),
      totalAmount: filteredInvoices.reduce((sum, i) => sum + i.amount, 0),
      totalCount: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  // Loading contracts
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
          <h1 className="text-2xl font-bold text-primary-dark">Facturation</h1>
          <p className="text-text-secondary">Sélectionnez un contrat pour gérer ses factures</p>
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
                    <Receipt size={24} className="text-accent" />
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

  // Contract selected - show invoices
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
                setContractSites([]);
              }}
              className="text-text-secondary hover:text-primary-dark"
            >
              Facturation
            </button>
            <span className="text-text-secondary">/</span>
            <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.title}</h1>
          <p className="text-text-secondary">{selectedContract.provider}</p>
        </div>
        <div className="flex gap-2">
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
      </div>

      {loadingInvoices ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="En attente"
              value={stats.pendingCount.toString()}
              change={`${stats.pendingAmount.toLocaleString("fr-FR")} € à valider`}
              changeType="neutral"
              icon={Clock}
              iconColor="text-yellow-600"
            />
            <StatsCard
              title="Validées / Payées"
              value={`${stats.validatedAmount.toLocaleString("fr-FR")} €`}
              icon={Check}
              iconColor="text-green-600"
            />
            <StatsCard
              title="Total factures"
              value={`${stats.totalAmount.toLocaleString("fr-FR")} €`}
              icon={Euro}
              iconColor="text-accent"
            />
            <StatsCard
              title="Nombre"
              value={stats.totalCount.toString()}
              icon={Receipt}
              iconColor="text-blue-600"
            />
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {/* Status filter tabs */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(["ALL", "EN_ATTENTE", "VALIDEE", "PAYEE", "BROUILLON"] as StatusFilter[]).map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        statusFilter === status
                          ? "bg-white shadow text-primary-dark font-medium"
                          : "text-text-secondary hover:text-primary-dark"
                      }`}
                    >
                      {status === "ALL"
                        ? "Toutes"
                        : status === "EN_ATTENTE"
                        ? "En attente"
                        : status === "VALIDEE"
                        ? "Validées"
                        : status === "PAYEE"
                        ? "Payées"
                        : "Brouillon"}
                    </button>
                  )
                )}
              </div>

              {/* Type filter */}
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
              <Button onClick={() => setShowModal(true)}>
                <Plus size={18} className="mr-2" />
                Saisir facture
              </Button>
            </div>
          </div>

          {/* Invoices by year */}
          {filteredInvoices.length === 0 ? (
            <ChartCard title="">
              <div className="flex flex-col items-center justify-center py-12">
                <Receipt size={48} className="text-gray-300 mb-4" />
                <p className="text-text-secondary mb-4">
                  {statusFilter !== "ALL" || typeFilter !== "ALL"
                    ? "Aucune facture avec ces filtres"
                    : "Aucune facture pour ce contrat"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowImportModal(true)}>
                    <Upload size={18} className="mr-2" />
                    Importer PDF
                  </Button>
                  <Button onClick={() => setShowModal(true)}>
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
                  <div
                    key={year}
                    className={`border rounded-xl overflow-hidden ${
                      isCurrent ? "border-accent" : "border-gray-200"
                    }`}
                  >
                    {/* Year header */}
                    <button
                      onClick={() => toggleYear(year)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${
                        isCurrent
                          ? "bg-accent/5 hover:bg-accent/10"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown size={18} className="text-text-secondary" />
                        ) : (
                          <ChevronRight size={18} className="text-text-secondary" />
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary-dark">{year}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">
                                En cours
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-text-secondary">
                            {yearInvoices.length} facture{yearInvoices.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <p className="font-bold text-primary-dark">
                        {total.toLocaleString("fr-FR")} € HT
                      </p>
                    </button>

                    {/* Invoices list */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {yearInvoices.map((invoice) => {
                          const status = statusConfig[invoice.status];
                          const type = typeConfig[invoice.type];
                          return (
                            <div
                              key={invoice.id}
                              className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                            >
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
                                  <p className="font-semibold text-primary-dark">
                                    {invoice.amount.toLocaleString("fr-FR")} € HT
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    Éch. {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}
                                  >
                                    {invoice.type}
                                  </span>
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
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-primary-dark mb-2">Supprimer la facture ?</h3>
            <p className="text-text-secondary mb-6">
              Cette action est irréversible. La facture sera définitivement supprimée.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  "Supprimer"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Importer une facture PDF</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setImportPreview(null);
                  setImportError(null);
                  setMatchedSiteId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  importing
                    ? "border-gray-200 bg-gray-50"
                    : "border-gray-300 hover:border-accent hover:bg-accent/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={importing}
                />
                {importing ? (
                  <>
                    <Loader2 size={40} className="mx-auto text-accent animate-spin mb-3" />
                    <p className="text-text-secondary">Analyse du PDF en cours...</p>
                  </>
                ) : selectedFile ? (
                  <>
                    <FileUp size={40} className="mx-auto text-accent mb-3" />
                    <p className="font-medium text-primary-dark">{selectedFile.name}</p>
                    <p className="text-sm text-text-secondary mt-1">Cliquez pour changer de fichier</p>
                  </>
                ) : (
                  <>
                    <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                    <p className="font-medium text-primary-dark">Cliquez pour sélectionner un PDF</p>
                    <p className="text-sm text-text-secondary mt-1">ou glissez-déposez le fichier ici</p>
                  </>
                )}
              </div>

              {/* Error */}
              {importError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <p>{importError}</p>
                </div>
              )}

              {/* Formulaire éditable après parsing */}
              {importPreview && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
                    <Check size={18} className="text-green-600" />
                    <span className="text-sm text-green-800">
                      PDF analysé - Vérifiez et complétez les informations
                    </span>
                  </div>

                  {/* Référence */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      N° Facture *
                    </label>
                    <input
                      type="text"
                      required
                      value={importFormData.reference}
                      onChange={(e) =>
                        setImportFormData({ ...importFormData, reference: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="FAC-2024-001"
                    />
                  </div>

                  {/* Type et Montant */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Type *
                      </label>
                      <select
                        value={importFormData.type}
                        onChange={(e) =>
                          setImportFormData({
                            ...importFormData,
                            type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
                          })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      >
                        <option value="P1">P1 - Énergie</option>
                        <option value="P2">P2 - Petit entretien</option>
                        <option value="P3">P3 - Gros entretien & Renouvellement</option>
                        <option value="TRAVAUX">Travaux hors contrat</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Montant HT (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={importFormData.amount}
                        onChange={(e) =>
                          setImportFormData({ ...importFormData, amount: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="15000.00"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Date d&apos;émission
                      </label>
                      <input
                        type="date"
                        value={importFormData.issueDate}
                        onChange={(e) =>
                          setImportFormData({ ...importFormData, issueDate: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Date d&apos;échéance
                      </label>
                      <input
                        type="date"
                        value={importFormData.dueDate}
                        onChange={(e) =>
                          setImportFormData({ ...importFormData, dueDate: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  {/* Site (filtré par contrat) */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Site{" "}
                      {matchedSiteId && (
                        <span className="text-green-600 text-xs">(détecté automatiquement)</span>
                      )}
                    </label>
                    <select
                      value={importFormData.siteId}
                      onChange={(e) =>
                        setImportFormData({ ...importFormData, siteId: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      disabled={loadingContractSites}
                    >
                      <option value="">
                        {loadingContractSites
                          ? "Chargement..."
                          : contractSites.length === 0
                          ? "Aucun site pour ce contrat"
                          : "Sélectionner un site"}
                      </option>
                      {contractSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} {site.city && `(${site.city})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Description
                    </label>
                    <textarea
                      value={importFormData.description}
                      onChange={(e) =>
                        setImportFormData({ ...importFormData, description: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      rows={2}
                      placeholder="Description..."
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                    setImportPreview(null);
                    setImportError(null);
                    setMatchedSiteId(null);
                  }}
                >
                  Annuler
                </Button>
                {importPreview && (
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleImportSubmit}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Création...
                      </>
                    ) : (
                      "Importer la facture"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouvelle facture</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Référence *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="FAC-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="P1">P1 - Énergie</option>
                    <option value="P2">P2 - Petit entretien</option>
                    <option value="P3">P3 - Gros entretien & Renouvellement</option>
                    <option value="TRAVAUX">Travaux hors contrat</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Montant HT (€) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="15000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date d&apos;émission *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date d&apos;échéance *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Site (filtered by contract) */}
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Site</label>
                <select
                  value={formData.siteId}
                  onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  disabled={loadingContractSites}
                >
                  <option value="">
                    {loadingContractSites
                      ? "Chargement..."
                      : contractSites.length === 0
                      ? "Aucun site pour ce contrat"
                      : "Sélectionner un site"}
                  </option>
                  {contractSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} {site.city && `(${site.city})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  rows={3}
                  placeholder="Description de la facture..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer la facture"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
