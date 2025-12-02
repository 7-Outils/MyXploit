"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  Plus,
  FileText,
  TrendingUp,
  Loader2,
  X,
  Check,
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

interface Quote {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  type: "P1" | "P2" | "P3";
  status: "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE" | "EXPIRE";
  amount: number;
  validUntil: string;
  site: Site | null;
  contract: Contract | null;
  createdAt: string;
}

const statusConfig = {
  BROUILLON: {
    label: "Brouillon",
    color: "bg-gray-100 text-gray-700",
  },
  ENVOYE: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
  },
  ACCEPTE: {
    label: "Accepté",
    color: "bg-green-100 text-green-700",
  },
  REFUSE: {
    label: "Refusé",
    color: "bg-red-100 text-red-700",
  },
  EXPIRE: {
    label: "Expiré",
    color: "bg-gray-100 text-gray-700",
  },
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    description: "",
    type: "P3",
    amount: "",
    validUntil: "",
    siteId: "",
    contractId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [quotesRes, sitesRes, contractsRes] = await Promise.all([
        fetch("/api/quotes"),
        fetch("/api/sites"),
        fetch("/api/contracts"),
      ]);
      const [quotesData, sitesData, contractsData] = await Promise.all([
        quotesRes.json(),
        sitesRes.json(),
        contractsRes.json(),
      ]);
      setQuotes(quotesData);
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
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          reference: "",
          title: "",
          description: "",
          type: "P3",
          amount: "",
          validUntil: "",
          siteId: "",
          contractId: "",
        });
      }
    } catch (error) {
      console.error("Error creating quote:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error updating quote:", error);
    }
  };

  const pendingQuotes = quotes.filter((q) => q.status === "ENVOYE");
  const totalAmount = quotes.reduce((sum, q) => sum + q.amount, 0);
  const acceptedAmount = quotes
    .filter((q) => q.status === "ACCEPTE")
    .reduce((sum, q) => sum + q.amount, 0);
  const acceptanceRate =
    quotes.length > 0
      ? Math.round(
          (quotes.filter((q) => q.status === "ACCEPTE").length / quotes.length) *
            100
        )
      : 0;

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
          <h1 className="text-2xl font-bold text-primary-dark">
            Devis & Chiffrage
          </h1>
          <p className="text-text-secondary">
            Analysez et comparez les devis de vos prestataires
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          Nouveau devis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Devis en cours"
          value={pendingQuotes.length.toString()}
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Montant total"
          value={`${(totalAmount / 1000).toFixed(0)}k€`}
          icon={Calculator}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Devis acceptés"
          value={`${(acceptedAmount / 1000).toFixed(0)}k€`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Taux d'acceptation"
          value={`${acceptanceRate}%`}
          icon={FileText}
          iconColor="text-yellow-600"
        />
      </div>

      {/* Quotes List */}
      {quotes.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Calculator size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucun devis</p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Créer un devis
          </Button>
        </ChartCard>
      ) : (
        <ChartCard title={`${quotes.length} devis`}>
          <div className="space-y-4">
            {quotes.map((quote) => {
              const status = statusConfig[quote.status];
              return (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <Calculator size={18} className="text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-primary-dark">
                        {quote.title}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {quote.site?.name || "Aucun site"} •{" "}
                        {quote.contract?.provider || "Aucun fournisseur"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-primary-dark">
                        {quote.amount.toLocaleString()} €
                      </p>
                      <p className="text-sm text-text-secondary">
                        Valide jusqu&apos;au{" "}
                        {new Date(quote.validUntil).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                      {quote.status === "ENVOYE" && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(quote.id, "ACCEPTE");
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(quote.id, "REFUSE");
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouveau devis
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
                    placeholder="DEV-2024-001"
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

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Remplacement chaudière"
                />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Montant (€) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Valide jusqu&apos;au *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) =>
                      setFormData({ ...formData, validUntil: e.target.value })
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
                  placeholder="Description du devis..."
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
                    "Créer le devis"
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
