"use client";

import { useEffect } from "react";
import { Receipt, Plus, Loader2, Upload, Check, X } from "lucide-react";
import { ReadOnlyGate } from "@/components/permissions";
import { statusConfig, typeConfig } from "@/components/financier/constants";
import type { Invoice, StatusFilter, TypeFilter } from "@/components/financier/types";

interface FacturationTabProps {
  loading: boolean;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
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
  setShowImportModal: (v: boolean) => void;
  setShowInvoiceModal: (v: boolean) => void;
}

const PAGE_SIZE = 30;

export function FacturationTab({
  loading,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  invoices,
  totalInvoices,
  currentPage,
  setCurrentPage,
  handleAcceptInvoice,
  handleRefuseInvoice,
  acceptingInvoiceId,
  refusingInvoiceId,
  setShowImportModal,
  setShowInvoiceModal,
}: FacturationTabProps) {
  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE));
  const pageClamped = Math.min(currentPage, totalPages);

  // Si le total se réduit sous nos pieds, on se recale sur la dernière page.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, setCurrentPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

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
          {(["P1", "P2", "P3"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
              className={`h-9 px-3 text-xs font-medium transition-colors ${typeFilter === t ? "bg-ink text-paper" : "bg-white text-ink/60 hover:bg-ink/[0.02]"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <ReadOnlyGate>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setShowImportModal(true)}
              title="Importer PDF"
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
      {totalInvoices === 0 ? (
        <div className="bg-white border border-ink/10 flex flex-col items-center justify-center py-12">
          <Receipt size={48} className="text-ink/25 mb-4" />
          <p className="text-text-secondary">
            {statusFilter !== "ALL" || typeFilter !== "ALL" ? "Aucune facture avec ces filtres" : "Aucune facture pour ce contrat"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-ink/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-ink/10">
                <tr>
                  <th className="label-tech px-4 py-2.5 text-left">Date</th>
                  <th className="label-tech px-4 py-2.5 text-left">Référence</th>
                  <th className="label-tech px-4 py-2.5 text-left">Type</th>
                  <th className="label-tech px-4 py-2.5 text-right">Montant HT</th>
                  <th className="label-tech px-4 py-2.5 text-left">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {invoices.map((invoice) => {
                  const status = statusConfig[invoice.status];
                  const type = typeConfig[invoice.type];
                  return (
                    <tr key={invoice.id} className="hover:bg-ink/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm text-ink/60">{new Date(invoice.issueDate).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-sm font-medium text-ink">{invoice.reference}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium ${type.color}`}>
                          {invoice.type}{invoice.p1SubType ? ` · ${invoice.p1SubType}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium tabular-nums text-ink">{invoice.amount.toLocaleString("fr-FR")} €</td>
                      <td className="px-4 py-3 text-sm">
                        {invoice.status === "EN_ATTENTE" ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
                            <ReadOnlyGate>
                              <button
                                onClick={() => handleAcceptInvoice(invoice.id)}
                                disabled={acceptingInvoiceId === invoice.id}
                                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                                title="Valider"
                              >
                                {acceptingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                              </button>
                              <button
                                onClick={() => handleRefuseInvoice(invoice.id)}
                                disabled={refusingInvoiceId === invoice.id}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                title="Refuser"
                              >
                                {refusingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                              </button>
                            </ReadOnlyGate>
                          </div>
                        ) : invoice.status === "VALIDEE" ? (
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-ink/10 text-sm">
                <span className="text-text-secondary">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, totalInvoices)} sur {totalInvoices}
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
