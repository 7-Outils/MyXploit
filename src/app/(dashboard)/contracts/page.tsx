"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Calendar,
  Loader2,
  X,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Site {
  id: string;
  name: string;
  type: string;
  energyType: string;
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  site: Site;
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  startDate: string;
  endDate: string;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  contractSites: ContractSite[];
}

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ACTIF" | "ALL" | "EXPIRE" | "RESILIE" | "EN_ATTENTE">("ACTIF");

  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    startDate: "",
    endDate: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/contracts");
      const data = await response.json();
      setContracts(Array.isArray(data) ? data : []);
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
      const response = await fetch("/api/contracts", {
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
          provider: "",
          startDate: "",
          endDate: "",
        });
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    } finally {
      setCreating(false);
    }
  };

  // Filter contracts based on status
  const filteredContracts = statusFilter === "ALL"
    ? contracts
    : contracts.filter(c => c.status === statusFilter);

  // Count sites with prestations from ACTIVE contracts only
  const activeContracts = contracts.filter(c => c.status === "ACTIF");
  const totalSites = activeContracts.reduce((sum, c) => sum + c.contractSites.length, 0);
  const sitesWithP1 = activeContracts.reduce(
    (sum, c) => sum + c.contractSites.filter((cs) => cs.hasP1).length,
    0
  );
  const sitesWithP2 = activeContracts.reduce(
    (sum, c) => sum + c.contractSites.filter((cs) => cs.hasP2).length,
    0
  );

  // Count by status
  const countByStatus = {
    ACTIF: contracts.filter(c => c.status === "ACTIF").length,
    EN_ATTENTE: contracts.filter(c => c.status === "EN_ATTENTE").length,
    EXPIRE: contracts.filter(c => c.status === "EXPIRE").length,
    RESILIE: contracts.filter(c => c.status === "RESILIE").length,
  };

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
          <h1 className="text-2xl font-bold text-primary-dark">Contrats</h1>
          <p className="text-text-secondary">
            Gérez vos marchés d&apos;exploitation CVC
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          Nouveau contrat
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Contrats actifs"
          value={countByStatus.ACTIF.toString()}
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Sites totaux"
          value={totalSites.toString()}
          icon={Building2}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Sites avec P1"
          value={sitesWithP1.toString()}
          icon={Building2}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Sites avec P2"
          value={sitesWithP2.toString()}
          icon={Building2}
          iconColor="text-green-600"
        />
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-secondary mr-2">Filtrer :</span>
        <button
          onClick={() => setStatusFilter("ACTIF")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === "ACTIF"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Actifs ({countByStatus.ACTIF})
        </button>
        <button
          onClick={() => setStatusFilter("EN_ATTENTE")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === "EN_ATTENTE"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          En attente ({countByStatus.EN_ATTENTE})
        </button>
        <button
          onClick={() => setStatusFilter("EXPIRE")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === "EXPIRE"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Expirés ({countByStatus.EXPIRE})
        </button>
        <button
          onClick={() => setStatusFilter("RESILIE")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === "RESILIE"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Résiliés ({countByStatus.RESILIE})
        </button>
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === "ALL"
              ? "bg-accent text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Tous ({contracts.length})
        </button>
      </div>

      {/* Contracts List */}
      {filteredContracts.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <FileText size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">
            {contracts.length === 0 ? "Aucun contrat" : "Aucun contrat avec ce statut"}
          </p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Créer un contrat
          </Button>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            // Aggregate prestations from all sites
            const hasAnyP1 = contract.contractSites.some((cs) => cs.hasP1);
            const hasAnyP2 = contract.contractSites.some((cs) => cs.hasP2);
            const hasAnyP3 = contract.contractSites.some((cs) => cs.hasP3);
            const hasAnyP4 = contract.contractSites.some((cs) => cs.hasP4);
            // Get unique contract types
            const contractTypes = [...new Set(contract.contractSites.map((cs) => cs.contractType))];

            return (
              <Link key={contract.id} href={`/contracts/${contract.id}`}>
                <ChartCard
                  title=""
                  className="hover:shadow-soft transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 -mt-2">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={24} className="text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-primary-dark">
                            {contract.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              contract.status === "ACTIF"
                                ? "bg-green-100 text-green-700"
                                : contract.status === "EN_ATTENTE"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {statusLabels[contract.status]}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {contract.reference} - Titulaire : {contract.provider}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(contract.startDate).toLocaleDateString("fr-FR")} →{" "}
                            {new Date(contract.endDate).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 size={14} />
                            {contract.contractSites.length} site{contract.contractSites.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {contractTypes.map((type) => (
                          <span key={type} className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">
                            {type}
                          </span>
                        ))}
                        {hasAnyP1 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">P1</span>
                        )}
                        {hasAnyP2 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">P2</span>
                        )}
                        {hasAnyP3 && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">P3</span>
                        )}
                        {hasAnyP4 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">P4</span>
                        )}
                      </div>
                      <ChevronRight size={20} className="text-text-secondary" />
                    </div>
                  </div>
                </ChartCard>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouveau contrat
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
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
                  placeholder="MC-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titre du contrat *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Marché exploitation CVC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titulaire (exploitant) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="ENGIE, Dalkia, Veolia..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <p className="text-sm text-text-secondary bg-gray-50 p-3 rounded-lg">
                Vous pourrez ajouter des sites et définir le type de contrat et les prestations (P1, P2, P3, P4) pour chaque site après la création.
              </p>

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
                    "Créer le contrat"
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
