"use client";

import {
  Receipt,
  Plus,
  Loader2,
  Upload,
  MapPin,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
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
  invoicesByYear: { year: number; invoices: Invoice[]; total: number }[];
  expandedYears: Set<number>;
  toggleYear: (year: number) => void;
  handleStatusChange: (id: string, status: string) => void;
  setShowDeleteConfirm: (id: string | null) => void;
  setShowImportModal: (v: boolean) => void;
  setShowInvoiceModal: (v: boolean) => void;
}

export function FacturationTab({
  loading,
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
}: FacturationTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      {/* Filters & Actions */}
      <div className="flex items-center gap-2 flex-wrap">
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

      {/* Invoices list */}
      {filteredInvoices.length === 0 ? (
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12">
            <Receipt size={48} className="text-gray-300 mb-4" />
            <p className="text-text-secondary mb-4">
              {statusFilter !== "ALL" || typeFilter !== "ALL" ? "Aucune facture avec ces filtres" : "Aucune facture pour ce contrat"}
            </p>
            <ReadOnlyGate>
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
            </ReadOnlyGate>
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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}>
                                {invoice.type}{invoice.p1SubType ? ` · ${invoice.p1SubType}` : ""}
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
  );
}
