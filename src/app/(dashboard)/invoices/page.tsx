"use client";

import { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  Check,
  X,
  Clock,
  Euro,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Site {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  reference: string;
  provider: string;
}

interface Invoice {
  id: string;
  reference: string;
  type: "P1" | "P2" | "P3";
  status: "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
  amount: number;
  taxAmount: number | null;
  issueDate: string;
  dueDate: string;
  description: string | null;
  site: Site | null;
  contract: Contract | null;
}

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    reference: "",
    type: "P1",
    amount: "",
    issueDate: "",
    dueDate: "",
    description: "",
    siteId: "",
    contractId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, sitesRes, contractsRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/sites"),
        fetch("/api/contracts"),
      ]);
      const [invoicesData, sitesData, contractsData] = await Promise.all([
        invoicesRes.json(),
        sitesRes.json(),
        contractsRes.json(),
      ]);
      setInvoices(invoicesData);
      setSites(sitesData);
      setContracts(contractsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          reference: "",
          type: "P1",
          amount: "",
          issueDate: "",
          dueDate: "",
          description: "",
          siteId: "",
          contractId: "",
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
    }
  };

  const pendingCount = invoices.filter((i) => i.status === "EN_ATTENTE").length;
  const pendingAmount = invoices
    .filter((i) => i.status === "EN_ATTENTE")
    .reduce((sum, i) => sum + i.amount, 0);
  const validatedAmount = invoices
    .filter((i) => i.status === "VALIDEE" || i.status === "PAYEE")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalAmount = invoices.reduce((sum, i) => sum + i.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

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
        <Button onClick={() => setShowModal(true)}>
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
          title="Validées"
          value={`${(validatedAmount / 1000).toFixed(0)}k€`}
          icon={Check}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Total factures"
          value={`${(totalAmount / 1000).toFixed(0)}k€`}
          icon={Euro}
          iconColor="text-accent"
        />
        <StatsCard
          title="Factures"
          value={invoices.length.toString()}
          icon={Receipt}
          iconColor="text-blue-600"
        />
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Receipt size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucune facture</p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Saisir une facture
          </Button>
        </ChartCard>
      ) : (
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
                    Site
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
                  const status = statusConfig[invoice.status];
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
                          {new Date(invoice.issueDate).toLocaleDateString("fr-FR")}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {invoice.contract?.provider || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {invoice.site?.name || "-"}
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
                        {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
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
                        {invoice.status === "EN_ATTENTE" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusChange(invoice.id, "VALIDEE")}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(invoice.id, "REJETEE")}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            >
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
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouvelle facture
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
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
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="FAC-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="P1">P1 - Énergie</option>
                    <option value="P2">P2 - Maintenance</option>
                    <option value="P3">P3 - Travaux</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Site
                  </label>
                  <select
                    value={formData.siteId}
                    onChange={(e) =>
                      setFormData({ ...formData, siteId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner un site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Contrat
                  </label>
                  <select
                    value={formData.contractId}
                    onChange={(e) =>
                      setFormData({ ...formData, contractId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner un contrat</option>
                    {contracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.reference} - {contract.provider}
                      </option>
                    ))}
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
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
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
                    onChange={(e) =>
                      setFormData({ ...formData, issueDate: e.target.value })
                    }
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
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
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
