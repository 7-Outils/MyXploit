"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import useSWR, { preload, useSWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { useSearchParams, useRouter } from "next/navigation";
import { useContract } from "@/contexts/ContractContext";
import { usePermissions } from "@/contexts/PermissionContext";
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
  InvoiceFormData,
  InvoiceSortKey,
  P3BalanceData,
  SiteAnalyticsData,
  Tab,
  StatusFilter,
  TypeFilter,
  NatureFilter,
  InvoiceNature,
} from "@/components/financier/types";

// Tabs
import { FacturationTab } from "@/components/financier/tabs/FacturationTab";
import { DecompteP3Tab } from "@/components/financier/tabs/DecompteP3Tab";
import DevisP3Content from "@/components/exploitation/DevisP3Content";

// Modals
import { ImportModal } from "@/components/financier/modals/ImportModal";
import { InvoiceModal } from "@/components/financier/modals/InvoiceModal";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

import { INVOICE_PAGE_SIZE } from "@/components/financier/constants";
import { sortTabsAlpha } from "@/lib/utils";

const FINANCIER_TABS = sortTabsAlpha([
  { id: "facturation" as Tab, label: "Facturation", icon: Receipt },
  { id: "decompte-p3" as Tab, label: "Solde P3", icon: PiggyBank },
  { id: "devis" as Tab, label: "Devis", icon: FileText },
]);

const emptyInvoiceForm: InvoiceFormData = {
  reference: "",
  type: "",
  nature: "",
  p1SubType: "",
  amount: "",
  issueDate: "",
  periodStart: "",
  periodEnd: "",
  description: "",
  siteId: "",
  lines: [],
};

function FinancierPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || FINANCIER_TABS[0].id;

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Contract from global context
  const { selectedContract, isLoading: loadingContracts } = useContract();
  const { userRole } = usePermissions();
  // Aligné sur la route DELETE /api/invoices/[id] (ADMIN et SUPER_ADMIN) :
  // afficher la corbeille à d'autres rôles ne produirait qu'un 403.
  const canDeleteInvoice = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  // SWR-cached data (survives tab switches)
  const contractKey = selectedContract?.id;

  // L'app a un provider de cache custom : le `mutate` global importé de "swr"
  // ne fait rien. Seul celui de useSWRConfig touche le bon cache.
  const { mutate } = useSWRConfig();

  // Les filtres, le tri et la page pilotent la clé : le serveur filtre, trie
  // et pagine.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [natureFilter, setNatureFilter] = useState<NatureFilter>("ALL");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [sort, setSort] = useState<{ key: InvoiceSortKey; dir: "asc" | "desc" }>({
    key: "issueDate",
    dir: "desc",
  });
  const toggleSort = (key: InvoiceSortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const invoicesKey = useMemo(() => {
    if (!contractKey) return null;
    const p = new URLSearchParams({
      contractId: contractKey,
      page: String(invoicePage),
      pageSize: String(INVOICE_PAGE_SIZE),
      sort: sort.key,
      dir: sort.dir,
    });
    if (statusFilter !== "ALL") p.set("status", statusFilter);
    if (typeFilter !== "ALL") p.set("type", typeFilter);
    if (natureFilter !== "ALL") p.set("nature", natureFilter);
    if (dateStart) p.set("dateStart", dateStart);
    if (dateEnd) p.set("dateEnd", dateEnd);
    return `/api/invoices?${p.toString()}`;
  }, [
    contractKey,
    invoicePage,
    sort,
    statusFilter,
    typeFilter,
    natureFilter,
    dateStart,
    dateEnd,
  ]);

  const {
    data: invoicesPage,
    error: invoicesError,
    isLoading: loadingInvoices,
    isValidating: validatingInvoices,
  } = useSWR<{ data: Invoice[]; total: number }>(invoicesKey, fetcher, { keepPreviousData: true });
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

  /**
   * Toute écriture sur une facture change potentiellement le solde P3 : seules
   * les factures VALIDÉES alimentent le pot, donc valider/refuser/modifier/
   * supprimer déplace le chiffre. On invalide les trois familles de clés
   * plutôt que de rafraîchir la ligne en place — une facture qui sort du
   * filtre courant doit disparaître de la liste.
   */
  const refreshInvoiceData = () => {
    mutate((key) => typeof key === "string" && key.startsWith("/api/invoices"));
    if (!contractKey) return;
    mutate((key) => typeof key === "string" && key.startsWith(`/api/contracts/${contractKey}/p3-balance`));
    mutate((key) => typeof key === "string" && key.startsWith(`/api/contracts/${contractKey}/site-analytics`));
  };

  const [acceptingInvoiceId, setAcceptingInvoiceId] = useState<string | null>(null);
  const [refusingInvoiceId, setRefusingInvoiceId] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  // Chargement du détail (lignes de répartition) avant d'ouvrir l'édition.
  const [loadingInvoiceDetailId, setLoadingInvoiceDetailId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rattachement après coup du PDF d'une facture saisie à la main : un seul
  // input caché pour toute la liste, la ligne visée est mémorisée au clic.
  const attachInputRef = useRef<HTMLInputElement>(null);
  const attachTargetRef = useRef<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  // Import
  const [importReady, setImportReady] = useState(false);
  const [importSource, setImportSource] = useState<"ia" | "degrade" | null>(null);
  const [importAiError, setImportAiError] = useState<string | null>(null);
  const [importedPdfUrl, setImportedPdfUrl] = useState<string | null>(null);
  // PDF trop long pour être lu en entier : la fin de la répartition peut manquer.
  const [importTruncated, setImportTruncated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchedSiteId, setMatchedSiteId] = useState<string | null>(null);
  const [importFormData, setImportFormData] = useState<InvoiceFormData>(emptyInvoiceForm);
  const [formData, setFormData] = useState<InvoiceFormData>(emptyInvoiceForm);

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

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setEditingInvoice(null);
    setFormData(emptyInvoiceForm);
    setFormError(null);
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    setFormError(null);
    setDetailError(null);
    const baseForm: InvoiceFormData = {
      reference: invoice.reference,
      type: invoice.type,
      nature: invoice.nature ?? "",
      p1SubType: invoice.p1SubType ?? "",
      amount: String(invoice.amount),
      issueDate: invoice.issueDate.slice(0, 10),
      periodStart: invoice.periodStart ? invoice.periodStart.slice(0, 10) : "",
      periodEnd: invoice.periodEnd ? invoice.periodEnd.slice(0, 10) : "",
      description: invoice.description ?? "",
      siteId: invoice.site?.id ?? "",
      lines: [],
    };

    // La liste ne transporte que le siteId des lignes : pour éditer la
    // répartition il faut le détail. Tant qu'il n'est pas là on n'ouvre pas le
    // formulaire — un tableau vide passerait pour « aucune ligne ».
    if (!invoice.siteLines || invoice.siteLines.length === 0) {
      setEditingInvoice(invoice);
      setFormData(baseForm);
      setShowInvoiceModal(true);
      return;
    }

    setLoadingInvoiceDetailId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      if (!res.ok) {
        setDetailError("Impossible de charger la répartition par site");
        return;
      }
      const detail = (await res.json()) as Invoice;
      setEditingInvoice(invoice);
      setFormData({
        ...baseForm,
        lines: (detail.siteLines ?? []).map((line) => ({
          label: line.label ?? "",
          amountHT: line.amountHT ?? 0,
          siteId: line.siteId ?? "",
        })),
      });
      setShowInvoiceModal(true);
    } catch (error) {
      console.error("Error loading invoice detail:", error);
      setDetailError("Erreur réseau lors du chargement de la facture");
    } finally {
      setLoadingInvoiceDetailId(null);
    }
  };

  // Création et édition partagent le formulaire ; seul le verbe HTTP change.
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !formData.type) return;
    setCreating(true);
    setFormError(null);
    try {
      const payload = {
        reference: formData.reference,
        type: formData.type,
        nature: formData.nature || null,
        p1SubType: formData.type === "P1" ? formData.p1SubType || null : null,
        amount: parseFloat(formData.amount) || 0,
        issueDate: formData.issueDate,
        periodStart: formData.periodStart || null,
        periodEnd: formData.periodEnd || null,
        description: formData.description || null,
        siteId: formData.siteId || null,
        contractId: selectedContract.id,
        // Répartition renvoyée telle quelle : le serveur remplace les lignes
        // et mémorise les rattachements corrigés comme alias.
        lines: formData.lines.map((line, index) => ({
          label: line.label,
          amountHT: line.amountHT,
          siteId: line.siteId || null,
          sortOrder: index,
        })),
        // Édition : le PDF déjà rattaché ne doit pas être perdu.
        ...(editingInvoice ? { documentUrl: editingInvoice.documentUrl } : {}),
      };
      const response = await fetch(
        editingInvoice ? `/api/invoices/${editingInvoice.id}` : "/api/invoices",
        {
          method: editingInvoice ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setFormError(result.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      refreshInvoiceData();
      closeInvoiceModal();
    } catch (error) {
      console.error("Error saving invoice:", error);
      setFormError("Erreur réseau");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingInvoice) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/invoices/${deletingInvoice.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setDeleteError(result.error ?? "Erreur lors de la suppression");
        return;
      }
      refreshInvoiceData();
      setDeletingInvoice(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      setDeleteError("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  };

  const handleAcceptInvoice = async (invoiceId: string) => {
    if (!confirm("Valider cette facture ?")) return;
    setAcceptingInvoiceId(invoiceId);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/accept`, { method: "POST" });
      if (response.ok) refreshInvoiceData();
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
      if (response.ok) refreshInvoiceData();
    } catch (error) {
      console.error("Error refusing invoice:", error);
    } finally {
      setRefusingInvoiceId(null);
    }
  };

  const handleAttachPdf = (invoiceId: string) => {
    attachTargetRef.current = invoiceId;
    setAttachError(null);
    attachInputRef.current?.click();
  };

  const handleAttachSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const invoiceId = attachTargetRef.current;
    if (!file || !invoiceId) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setAttachError("Seuls les fichiers PDF sont acceptés");
      return;
    }
    setAttachingId(invoiceId);
    setAttachError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/document`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttachError(data.error ?? "Erreur lors du rattachement du PDF");
        return;
      }
      refreshInvoiceData();
    } catch {
      setAttachError("Erreur réseau");
    } finally {
      setAttachingId(null);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setImportReady(false);
    setImportSource(null);
    setImportAiError(null);
    setImportedPdfUrl(null);
    setImportTruncated(false);
    setImportError(null);
    setMatchedSiteId(null);
    setImportFormData(emptyInvoiceForm);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContract) return;

    setSelectedFile(file);
    setImportError(null);
    setImportReady(false);
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      // contractId : sans lui le PDF n'est pas archivé (on ne saurait pas où
      // le ranger). kind=invoice : consigne IA factures + dossier invoices/.
      fd.append("contractId", selectedContract.id);
      fd.append("kind", "invoice");

      const response = await fetch("/api/quotes/import", { method: "POST", body: fd });
      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || "Erreur lors de l'import";
        setImportError(errorMsg);
        return;
      }

      const parsed = result.parsed as {
        reference: string | null;
        objet: string | null;
        amountHT: number | null;
        invoiceType: "P1" | "P2" | "P3" | "AUTRE" | null;
        nature: InvoiceNature | null;
        p1SubType: string | null;
        issueDate: string | null;
      };
      // Répartition site par site lue sur le PDF, avec le rapprochement
      // proposé (alias mémorisé, ou déduction sur le libellé).
      const importedLines = (
        Array.isArray(result.lines)
          ? (result.lines as Array<{
              label: string;
              amountHT: number;
              siteId: string | null;
              matchedBy: "alias" | "auto" | null;
            }>)
          : []
      ).map((line) => ({
        label: line.label,
        amountHT: line.amountHT,
        siteId: line.siteId ?? "",
        matchedBy: line.matchedBy,
      }));

      setImportFormData({
        reference: parsed.reference ?? "",
        // Type lu par la consigne factures : c'est déjà une valeur de l'enum
        // InvoiceType, aucun mappage à faire. Vide si non détecté.
        type: parsed.invoiceType ?? "",
        // Nature lue par l'IA, déjà filtrée sur l'enum côté serveur.
        nature: parsed.nature ?? "",
        p1SubType: parsed.invoiceType === "P1" ? (parsed.p1SubType ?? "") : "",
        amount: parsed.amountHT ? String(parsed.amountHT) : "",
        // Date d'émission non trouvée : on laisse vide plutôt que d'inscrire
        // la date du jour, qui passerait pour une valeur lue sur la facture.
        issueDate: parsed.issueDate ?? "",
        periodStart: typeof result.periodStart === "string" ? result.periodStart : "",
        periodEnd: typeof result.periodEnd === "string" ? result.periodEnd : "",
        description: parsed.objet ?? "",
        // Facture répartie : pas de site global, la répartition porte tout.
        siteId: importedLines.length > 0 ? "" : (result.matchedSite?.id ?? ""),
        lines: importedLines,
      });
      setImportTruncated(result.truncated === true);
      setMatchedSiteId(importedLines.length > 0 ? null : (result.matchedSite?.id ?? null));
      setImportSource(result.source === "gemini" ? "ia" : "degrade");
      setImportAiError(typeof result.aiError === "string" ? result.aiError : null);
      setImportedPdfUrl(result.documentUrl ?? null);
      setImportReady(true);
    } catch (error) {
      console.error("Error importing:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur réseau";
      setImportError(`Erreur lors de l'analyse du PDF: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!selectedContract) return;
    if (!importFormData.reference || !importFormData.type || !importFormData.issueDate) {
      setImportError("Renseignez la référence, le type et la date d'émission");
      return;
    }

    setCreating(true);
    setImportError(null);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: importFormData.reference,
          type: importFormData.type,
          nature: importFormData.nature || null,
          p1SubType: importFormData.type === "P1" ? importFormData.p1SubType || null : null,
          amount: parseFloat(importFormData.amount) || 0,
          issueDate: importFormData.issueDate,
          periodStart: importFormData.periodStart || null,
          periodEnd: importFormData.periodEnd || null,
          description: importFormData.description || null,
          siteId: importFormData.siteId || null,
          contractId: selectedContract.id,
          // Les rattachements corrigés à l'écran sont enregistrés et mémorisés
          // comme alias pour les prochains imports du même exploitant.
          lines: importFormData.lines.map((line, index) => ({
            label: line.label,
            amountHT: line.amountHT,
            siteId: line.siteId || null,
            sortOrder: index,
          })),
          // PDF archivé pendant l'import : on le rattache à la facture créée.
          documentUrl: importedPdfUrl,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Erreur lors de la création");
      }

      refreshInvoiceData();
      closeImportModal();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // Le filtrage est fait en SQL : `invoices` est déjà la page filtrée.
  // Retour à la première page dès qu'un filtre ou le tri change.
  useEffect(() => {
    setInvoicePage(1);
  }, [statusFilter, typeFilter, natureFilter, dateStart, dateEnd, sort]);

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
          <h1 className="text-xl font-semibold text-ink">Suivi financier</h1>
          <p className="text-text-secondary">Sélectionnez un contrat dans la barre supérieure pour accéder au suivi financier</p>
        </div>
      </div>
    );
  }

  // Contract selected
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-ink/10">
        <nav className="flex gap-8">
          {FINANCIER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              onMouseEnter={() => {
                if (!selectedContract) return;
                if (tab.id === "facturation") {
                  // Doit refléter la clé construite plus haut (1re page, sans
                  // filtre, tri par défaut).
                  preload(
                    `/api/invoices?contractId=${selectedContract.id}&page=1&pageSize=${INVOICE_PAGE_SIZE}&sort=issueDate&dir=desc`,
                    fetcher
                  );
                  preload(`/api/invoices/sites?contractId=${selectedContract.id}`, fetcher);
                } else if (tab.id === "decompte-p3") {
                  preload(`/api/contracts/${selectedContract.id}/p3-balance`, fetcher);
                  preload(`/api/contracts/${selectedContract.id}/site-analytics`, fetcher);
                } else if (tab.id === "devis") {
                  // Doit refléter exactement la clé construite par DevisP3Content
                  // (première page, sans filtre), sinon on précharge dans le vide.
                  preload(
                    `/api/quotes?contractId=${selectedContract.id}&page=1&pageSize=30&sort=issueDate&dir=desc`,
                    fetcher
                  );
                  preload(`/api/contracts/${selectedContract.id}/sites`, fetcher);
                }
              }}
              className={`flex items-center gap-2 py-3 -mb-px border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent font-medium"
                  : "border-transparent text-ink/50 hover:text-ink"
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
          // Spinner seulement quand on n'a encore rien ; un changement de filtre
          // garde le tableau visible, estompé, le temps de l'aller-retour.
          loading={loadingInvoices && !invoicesPage}
          stale={validatingInvoices && !!invoicesPage}
          error={invoicesError}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          natureFilter={natureFilter}
          setNatureFilter={setNatureFilter}
          dateStart={dateStart}
          setDateStart={setDateStart}
          dateEnd={dateEnd}
          setDateEnd={setDateEnd}
          sort={sort}
          onSort={toggleSort}
          invoices={invoices}
          totalInvoices={totalInvoices}
          currentPage={invoicePage}
          setCurrentPage={setInvoicePage}
          handleAcceptInvoice={handleAcceptInvoice}
          handleRefuseInvoice={handleRefuseInvoice}
          acceptingInvoiceId={acceptingInvoiceId}
          refusingInvoiceId={refusingInvoiceId}
          handleEditInvoice={handleEditInvoice}
          handleDeleteInvoice={(invoice) => {
            setDeleteError(null);
            setDeletingInvoice(invoice);
          }}
          canDeleteInvoice={canDeleteInvoice}
          handleAttachPdf={handleAttachPdf}
          attachingId={attachingId}
          attachError={attachError ?? detailError}
          loadingInvoiceDetailId={loadingInvoiceDetailId}
          setShowImportModal={setShowImportModal}
          setShowInvoiceModal={setShowInvoiceModal}
        />
      )}

      {/* Input caché partagé par toute la liste pour joindre un PDF. */}
      <input
        ref={attachInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleAttachSelected}
        className="hidden"
      />

      {activeTab === "decompte-p3" && (
        <DecompteP3Tab
          loading={loadingP3}
          p3Data={p3Data}
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
          onClose={closeImportModal}
          fileInputRef={fileInputRef}
          importing={importing}
          selectedFile={selectedFile}
          handleFileSelect={handleFileSelect}
          importError={importError}
          importReady={importReady}
          importSource={importSource}
          importAiError={importAiError}
          importedPdfUrl={importedPdfUrl}
          importFormData={importFormData}
          setImportFormData={setImportFormData}
          matchedSiteId={matchedSiteId}
          contractSites={contractSites}
          loadingContractSites={!contractSitesData}
          creating={creating}
          handleImportSubmit={handleImportSubmit}
          importTruncated={importTruncated}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          editing={!!editingInvoice}
          onClose={closeInvoiceModal}
          formData={formData}
          setFormData={setFormData}
          contractSites={contractSites}
          saving={creating}
          error={formError}
          handleSubmit={handleSubmitInvoice}
        />
      )}

      {deletingInvoice && (
        <Modal
          title="Supprimer la facture ?"
          onClose={() => setDeletingInvoice(null)}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setDeletingInvoice(null)} disabled={deleting}>
                Annuler
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? <Loader2 size={18} className="animate-spin" /> : "Supprimer"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink/70">
            La facture {deletingInvoice.reference} ({deletingInvoice.amount.toLocaleString("fr-FR")} €)
            sera définitivement supprimée. Cette action est irréversible.
          </p>
          {deleteError && (
            <div className="mt-3 border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </div>
          )}
        </Modal>
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
