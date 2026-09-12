"use client";

import { useEffect } from "react";
import {
  Receipt,
  Plus,
  Loader2,
  Upload,
  Check,
  X,
  Pencil,
  Trash2,
  FileText,
  Paperclip,
  AlertTriangle,
} from "lucide-react";
import { ReadOnlyGate } from "@/components/permissions";
import { SortableTh, type SortState } from "@/components/ui/SortableTh";
import { statusConfig, typeConfig, INVOICE_PAGE_SIZE } from "@/components/financier/constants";
import type {
  Invoice,
  InvoiceSite,
  InvoiceSortKey,
  StatusFilter,
  TypeFilter,
} from "@/components/financier/types";

/**
 * Période de prestation, forme courte « 01/06 → 31/08/2026 » : l'année n'est
 * rappelée sur la borne de début que si elle diffère de celle de fin.
 */
function formatPeriod(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (iso: string, withYear: boolean) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return withYear
      ? d.toLocaleDateString("fr-FR")
      : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };
  if (start && end) {
    const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear();
    const a = fmt(start, !sameYear);
    const b = fmt(end, true);
    return a && b ? `${a} → ${b}` : null;
  }
  const only = fmt((start ?? end) as string, true);
  if (!only) return null;
  return start ? `depuis ${only}` : `jusqu'au ${only}`;
}

interface FacturationTabProps {
  loading: boolean;
  /** Erreur SWR : une route en panne n'est pas une liste vide. */
  error?: (Error & { status?: number }) | null;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
  siteFilter: string;
  setSiteFilter: (s: string) => void;
  dateStart: string;
  setDateStart: (d: string) => void;
  dateEnd: string;
  setDateEnd: (d: string) => void;
  /** Sites portant au moins une facture, avec leur compteur. */
  invoiceSites: InvoiceSite[];
  sort: SortState<InvoiceSortKey>;
  onSort: (k: InvoiceSortKey) => void;
  /** Page courante déjà filtrée et paginée par le serveur. */
  invoices: Invoice[];
  /** Nombre total de factures correspondant aux filtres, toutes pages confondues. */
  totalInvoices: number;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  handleAcceptInvoice: (id: string) => void;
  handleRefuseInvoice: (id: string) => void;
  acceptingInvoiceId: string | null;
  refusingInvoiceId: string | null;
  handleEditInvoice: (invoice: Invoice) => void;
  handleDeleteInvoice: (invoice: Invoice) => void;
  /** Suppression réservée aux ADMIN, comme la route DELETE. */
  canDeleteInvoice: boolean;
  handleAttachPdf: (id: string) => void;
  attachingId: string | null;
  /** Erreur d'une action sur une ligne (PDF joint, détail chargé). */
  attachError: string | null;
  /** Facture dont le détail est en cours de chargement avant édition. */
  loadingInvoiceDetailId: string | null;
  setShowImportModal: (v: boolean) => void;
  setShowInvoiceModal: (v: boolean) => void;
}

export function FacturationTab({
  loading,
  error,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  siteFilter,
  setSiteFilter,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  invoiceSites,
  sort,
  onSort,
  invoices,
  totalInvoices,
  currentPage,
  setCurrentPage,
  handleAcceptInvoice,
  handleRefuseInvoice,
  acceptingInvoiceId,
  refusingInvoiceId,
  handleEditInvoice,
  handleDeleteInvoice,
  canDeleteInvoice,
  handleAttachPdf,
  attachingId,
  attachError,
  loadingInvoiceDetailId,
  setShowImportModal,
  setShowInvoiceModal,
}: FacturationTabProps) {
  const totalPages = Math.max(1, Math.ceil(totalInvoices / INVOICE_PAGE_SIZE));
  const pageClamped = Math.min(currentPage, totalPages);
  const hasFilters =
    statusFilter !== "ALL" || typeFilter !== "ALL" || siteFilter !== "all" || !!dateStart || !!dateEnd;

  // Si le total se réduit sous nos pieds, on se recale sur la dernière page.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, setCurrentPage]);

  return (
    <>
      {/* Filters + Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-ink/10">
          {(["ALL", "EN_ATTENTE", "VALIDEE", "REFUSEE"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`h-9 px-3 text-sm transition-colors ${
                statusFilter === status ? "bg-ink text-paper font-medium" : "bg-white text-ink/60 hover:text-ink"
              }`}
            >
              {status === "ALL" ? "Toutes" : status === "EN_ATTENTE" ? "En attente" : status === "VALIDEE" ? "Validées" : "Refusées"}
            </button>
          ))}
        </div>
        <div className="flex items-center border border-ink/10 overflow-hidden">
          {(["P1", "P2", "P3", "AUTRE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
              className={`h-9 px-3 text-xs font-medium transition-colors ${typeFilter === t ? "bg-ink text-paper" : "bg-white text-ink/60 hover:bg-ink/[0.02]"}`}
            >
              {t === "AUTRE" ? "Autre" : t}
            </button>
          ))}
        </div>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="h-9 px-3 border border-ink/10 text-sm bg-white"
        >
          <option value="all">Tous sites</option>
          {invoiceSites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name} ({site.invoices})
            </option>
          ))}
          {/* Valeur courante pas encore dans la liste (chargement) : on la
              garde affichée plutôt que de retomber sur « Tous sites ». */}
          {siteFilter !== "all" && !invoiceSites.some((s) => s.id === siteFilter) && (
            <option value={siteFilter}>…</option>
          )}
        </select>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="h-9 px-2 border border-ink/10 text-sm bg-white"
        />
        <span className="text-xs text-text-secondary">→</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="h-9 px-2 border border-ink/10 text-sm bg-white"
        />
        {hasFilters && (
          <button
            onClick={() => {
              setStatusFilter("ALL");
              setTypeFilter("ALL");
              setSiteFilter("all");
              setDateStart("");
              setDateEnd("");
            }}
            className="text-xs text-accent hover:underline"
          >
            Réinitialiser
          </button>
        )}
        <ReadOnlyGate>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setShowImportModal(true)}
              title="Importer PDF (IA)"
              className="h-9 w-9 flex items-center justify-center border border-ink/10 text-ink/60 hover:bg-ink/[0.02] transition-colors"
            >
              <Upload size={16} />
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              title="Saisir facture"
              className="h-9 w-9 flex items-center justify-center bg-ink text-paper hover:bg-accent transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </ReadOnlyGate>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : error ? (
        // Une route en erreur n'est pas une liste vide : le dire, sinon
        // « Aucune facture » masque une panne pendant des jours.
        <div className="flex items-start gap-2 border border-red-600/20 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-px flex-shrink-0" />
          <span>
            Impossible de charger les factures
            {error.status ? ` (erreur ${error.status})` : ""}. Réessayez ;
            si ça persiste, signalez-le.
          </span>
        </div>
      ) : invoices.length === 0 && totalInvoices === 0 ? (
        <div className="bg-white border border-ink/10 flex flex-col items-center justify-center py-12">
          <Receipt size={48} className="text-ink/25 mb-4" />
          <p className="text-text-secondary">
            {hasFilters ? "Aucune facture avec ces filtres" : "Aucune facture pour ce contrat"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-ink/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white">
                <tr>
                  <SortableTh label="Date" col="issueDate" sort={sort} onSort={onSort} />
                  <SortableTh label="Référence" col="reference" sort={sort} onSort={onSort} />
                  <SortableTh label="Type" col="type" sort={sort} onSort={onSort} />
                  <SortableTh label="Montant HT" col="amount" sort={sort} onSort={onSort} className="text-right" />
                  <SortableTh label="État" col="status" sort={sort} onSort={onSort} />
                  <th className="label-tech px-4 py-2.5 text-center">PDF</th>
                  <th className="label-tech px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status = statusConfig[invoice.status];
                  const type = typeConfig[invoice.type];
                  const period = formatPeriod(invoice.periodStart, invoice.periodEnd);
                  return (
                    <tr key={invoice.id} className="border-t border-ink/[0.06] hover:bg-ink/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm text-ink/60">
                        {new Date(invoice.issueDate).toLocaleDateString("fr-FR")}
                        {period && (
                          <div className="font-mono text-[10px] text-ink/45" title="Période facturée">
                            {period}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-ink">{invoice.reference}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium ${type.color}`}>
                          {invoice.type}{invoice.p1SubType ? ` · ${invoice.p1SubType}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium tabular-nums text-ink">{invoice.amount.toLocaleString("fr-FR")} €</td>
                      <td className="px-4 py-3 text-sm">
                        {invoice.status === "VALIDEE" ? (
                          <div>
                            <span className={`px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
                            {invoice.acceptedByUser && (
                              <div className="text-xs text-ink/60 mt-1">
                                par {invoice.acceptedByUser.firstName || ""} {invoice.acceptedByUser.lastName || invoice.acceptedByUser.email}
                              </div>
                            )}
                            {invoice.acceptedAt && (
                              <div className="text-xs text-ink/50">{new Date(invoice.acceptedAt).toLocaleDateString("fr-FR")}</div>
                            )}
                          </div>
                        ) : invoice.status === "REFUSEE" ? (
                          <div>
                            <span className={`px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
                            {invoice.refusedByUser && (
                              <div className="text-xs text-ink/60 mt-1">
                                par {invoice.refusedByUser.firstName || ""} {invoice.refusedByUser.lastName || invoice.refusedByUser.email}
                              </div>
                            )}
                            {invoice.refusedAt && (
                              <div className="text-xs text-ink/50">{new Date(invoice.refusedAt).toLocaleDateString("fr-FR")}</div>
                            )}
                          </div>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {invoice.documentUrl ? (
                          <a
                            href={invoice.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir le PDF original"
                            className="inline-flex h-9 w-9 items-center justify-center text-ink/60 hover:text-accent hover:bg-ink/[0.02] transition-colors"
                          >
                            <FileText size={16} />
                          </a>
                        ) : (
                          <ReadOnlyGate fallback={<span className="text-sm text-ink/25">—</span>}>
                            <button
                              onClick={() => handleAttachPdf(invoice.id)}
                              disabled={attachingId !== null}
                              title="Joindre le PDF"
                              className="inline-flex h-9 w-9 items-center justify-center text-ink/40 hover:text-accent hover:bg-ink/[0.02] transition-colors disabled:opacity-50"
                            >
                              {attachingId === invoice.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Paperclip size={16} />
                              )}
                            </button>
                          </ReadOnlyGate>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ReadOnlyGate>
                          <div className="flex items-center justify-center gap-1">
                            {invoice.status === "EN_ATTENTE" && (
                              <>
                                <button
                                  onClick={() => handleAcceptInvoice(invoice.id)}
                                  disabled={acceptingInvoiceId === invoice.id}
                                  className="inline-flex h-9 w-9 items-center justify-center text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                                  title="Valider"
                                >
                                  {acceptingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                </button>
                                <button
                                  onClick={() => handleRefuseInvoice(invoice.id)}
                                  disabled={refusingInvoiceId === invoice.id}
                                  className="inline-flex h-9 w-9 items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                  title="Refuser"
                                >
                                  {refusingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              disabled={loadingInvoiceDetailId === invoice.id}
                              title="Modifier"
                              className="inline-flex h-9 w-9 items-center justify-center text-ink/60 hover:text-accent hover:bg-ink/[0.02] transition-colors disabled:opacity-50"
                            >
                              {loadingInvoiceDetailId === invoice.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Pencil size={16} />
                              )}
                            </button>
                            {canDeleteInvoice && (
                              <button
                                onClick={() => handleDeleteInvoice(invoice)}
                                title="Supprimer"
                                className="inline-flex h-9 w-9 items-center justify-center text-ink/60 hover:text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </ReadOnlyGate>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {attachError && (
              <div className="flex items-center gap-2 border-t border-red-600/20 bg-red-50 px-4 py-2 text-sm text-red-700">
                <AlertTriangle size={14} />
                {attachError}
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-ink/10 text-sm">
                <span className="text-text-secondary">
                  {(pageClamped - 1) * INVOICE_PAGE_SIZE + 1}–{Math.min(pageClamped * INVOICE_PAGE_SIZE, totalInvoices)} sur {totalInvoices}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(Math.max(1, pageClamped - 1))} disabled={pageClamped === 1} className="h-8 px-3 border border-ink/10 text-xs text-ink/60 hover:bg-ink/[0.02] disabled:opacity-40">Précédent</button>
                  <span className="text-xs text-text-secondary px-2">Page {pageClamped} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(Math.min(totalPages, pageClamped + 1))} disabled={pageClamped === totalPages} className="h-8 px-3 border border-ink/10 text-xs text-ink/60 hover:bg-ink/[0.02] disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
