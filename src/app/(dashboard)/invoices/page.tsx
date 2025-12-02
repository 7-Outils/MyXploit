"use client";

import { Receipt, Plus, Check, X, Clock, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

const invoices = [
  {
    id: 1,
    reference: "FAC-2024-0156",
    supplier: "ENGIE Solutions",
    type: "P1",
    amount: 45600,
    date: "15/12/2024",
    dueDate: "15/01/2025",
    status: "pending",
    contract: "Lot 1 - Nord",
  },
  {
    id: 2,
    reference: "FAC-2024-0155",
    supplier: "Dalkia",
    type: "P2",
    amount: 12300,
    date: "12/12/2024",
    dueDate: "12/01/2025",
    status: "validated",
    contract: "Lot 2 - Sud",
  },
  {
    id: 3,
    reference: "FAC-2024-0154",
    supplier: "Veolia",
    type: "P3",
    amount: 8900,
    date: "10/12/2024",
    dueDate: "10/01/2025",
    status: "validated",
    contract: "Lot 3 - Est",
  },
  {
    id: 4,
    reference: "FAC-2024-0153",
    supplier: "ENGIE Solutions",
    type: "P1",
    amount: 42100,
    date: "01/12/2024",
    dueDate: "01/01/2025",
    status: "rejected",
    contract: "Lot 1 - Nord",
  },
  {
    id: 5,
    reference: "FAC-2024-0152",
    supplier: "Dalkia",
    type: "P2",
    amount: 15800,
    date: "28/11/2024",
    dueDate: "28/12/2024",
    status: "pending",
    contract: "Lot 2 - Sud",
  },
];

const statusConfig = {
  pending: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  validated: {
    label: "Validée",
    color: "bg-green-100 text-green-700",
    icon: Check,
  },
  rejected: {
    label: "Rejetée",
    color: "bg-red-100 text-red-700",
    icon: X,
  },
};

export default function InvoicesPage() {
  const pendingCount = invoices.filter((i) => i.status === "pending").length;
  const pendingAmount = invoices
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.amount, 0);
  const validatedAmount = invoices
    .filter((i) => i.status === "validated")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Facturation</h1>
          <p className="text-text-secondary">
            Gérez le workflow de validation des factures
          </p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Saisir une facture
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="En attente"
          value={pendingCount.toString()}
          change={`${(pendingAmount / 1000).toFixed(0)}k€ à valider`}
          changeType="neutral"
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Validées (mois)"
          value={`${(validatedAmount / 1000).toFixed(0)}k€`}
          change="+12% vs M-1"
          changeType="neutral"
          icon={Check}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Budget YTD"
          value="1.2M€"
          change="82% consommé"
          changeType="neutral"
          icon={Euro}
          iconColor="text-accent"
        />
        <StatsCard
          title="Factures traitées"
          value="156"
          change="Ce mois"
          changeType="neutral"
          icon={Receipt}
          iconColor="text-blue-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button className="px-4 py-2 text-sm font-medium text-accent border-b-2 border-accent">
          Toutes ({invoices.length})
        </button>
        <button className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary-dark">
          En attente ({pendingCount})
        </button>
        <button className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary-dark">
          Validées
        </button>
        <button className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary-dark">
          Rejetées
        </button>
      </div>

      {/* Invoices Table */}
      <ChartCard title="" className="overflow-hidden">
        <div className="overflow-x-auto -mx-6 -my-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Référence
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Fournisseur
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Contrat
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Montant
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Échéance
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Statut
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const status = statusConfig[invoice.status as keyof typeof statusConfig];
                return (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-primary-dark">
                        {invoice.reference}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {invoice.date}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {invoice.supplier}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {invoice.contract}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {invoice.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-primary-dark">
                      {invoice.amount.toLocaleString()} €
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {invoice.dueDate}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                      >
                        <status.icon size={12} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {invoice.status === "pending" && (
                        <div className="flex gap-2">
                          <button className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Check size={16} />
                          </button>
                          <button className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
