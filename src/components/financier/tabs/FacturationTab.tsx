"use client";

import { useState, useEffect } from "react";
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
  filteredInvoices: Invoice[];
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
  filteredInvoices,
  handleAcceptInvoice,
  handleRefuseInvoice,
  acceptingInvoiceId,
  refusingInvoiceId,
  setShowImportModal,
  setShowInvoiceModal,
}: FacturationTabProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const pageClamped = Math.min(currentPage, totalPages);
  const pagedInvoices = filteredInvoices.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

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
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(["ALL", "EN_ATTENTE", "VALIDEE", "REFUSEE"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                statusFilter === status ? "bg-white shadow text-primary-dark font-medium" : "text-text-secondary hover:text-primary-dark"
              }`}
            >
              {status === "ALL" ? "Toutes" : status === "EN_ATTENTE" ? "En attente" : status === "VALIDEE" ? "Validées" : "Refusées"}
            </button>
          ))}
        </div>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {(["P1", "P2", "P3"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
              className={`h-9 px-3 text-xs font-medium transition-colors ${typeFilter === t ? "bg-accent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
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
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              title="Saisir facture"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </ReadOnlyGate>
      </div>

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-12">
          <Receipt size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary">
            {statusFilter !== "ALL" || typeFilter !== "ALL" ? "Aucune facture avec ces filtres" : "Aucune facture pour ce contrat"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Référence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Montant HT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status];
                  const type = typeConfig[invoice.type];
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(invoice.issueDate).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.reference}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}>
                          {invoice.type}{invoice.p1SubType ? ` · ${invoice.p1SubType}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{invoice.amount.toLocaleString("fr-FR")} €</td>
                      <td className="px-4 py-3 text-sm">
                        {invoice.status === "EN_ATTENTE" ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                            <ReadOnlyGate>
                              <button
                                onClick={() => handleAcceptInvoice(invoice.id)}
                                disabled={acceptingInvoiceId === invoice.id}
                                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                title="Valider"
                              >
                                {acceptingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                              </button>
                              <button
                                onClick={() => handleRefuseInvoice(invoice.id)}
                                disabled={refusingInvoiceId === invoice.id}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Refuser"
                              >
                                {refusingInvoiceId === invoice.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                              </button>
                            </ReadOnlyGate>
                          </div>
                        ) : invoice.status === "VALIDEE" ? (
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                            {invoice.acceptedByUser && (
                              <div className="text-xs text-gray-600 mt-1">
                                par {invoice.acceptedByUser.firstName || ""} {invoice.acceptedByUser.lastName || invoice.acceptedByUser.email}
                              </div>
                            )}
                            {invoice.acceptedAt && (
                              <div className="text-xs text-gray-500">{new Date(invoice.acceptedAt).toLocaleDateString("fr-FR")}</div>
                            )}
                          </div>
                        ) : invoice.status === "REFUSEE" ? (
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                            {invoice.refusedByUser && (
                              <div className="text-xs text-gray-600 mt-1">
                                par {invoice.refusedByUser.firstName || ""} {invoice.refusedByUser.lastName || invoice.refusedByUser.email}
                              </div>
                            )}
                            {invoice.refusedAt && (
                              <div className="text-xs text-gray-500">{new Date(invoice.refusedAt).toLocaleDateString("fr-FR")}</div>
                            )}
                          </div>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
                <span className="text-text-secondary">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filteredInvoices.length)} sur {filteredInvoices.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={pageClamped === 1} className="h-8 px-3 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">Précédent</button>
                  <span className="text-xs text-text-secondary px-2">Page {pageClamped} / {totalPages}</span>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={pageClamped === totalPages} className="h-8 px-3 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
