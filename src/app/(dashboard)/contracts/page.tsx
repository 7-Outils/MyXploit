"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Calendar,
  Euro,
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
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  contractType: string;
  provider: string;
  startDate: string;
  endDate: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  sites: Site[];
}

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

const contractTypes = [
  { value: "MTI", label: "MTI - Marché Tout Inclus" },
  { value: "MCI", label: "MCI - Marché Chauffage Installation" },
  { value: "PFI", label: "PFI - Performance et Financement" },
  { value: "CPI", label: "CPI - Conception Performance Installation" },
  { value: "MT", label: "MT - Maintenance seule" },
  { value: "CP", label: "CP - Contrat de Performance" },
  { value: "PF", label: "PF - Performance Forfaitaire" },
  { value: "MC", label: "MC - Marché de Chauffage" },
  { value: "MF", label: "MF - Marché Forfaitaire" },
  { value: "AUTRE", label: "Autre" },
];

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    contractType: "MC",
    provider: "",
    startDate: "",
    endDate: "",
    hasP1: false,
    hasP2: false,
    hasP3: false,
    hasP4: false,
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
          contractType: "MC",
          provider: "",
          startDate: "",
          endDate: "",
          hasP1: false,
          hasP2: false,
          hasP3: false,
          hasP4: false,
        });
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    } finally {
      setCreating(false);
    }
  };

  const contractsWithP1 = contracts.filter((c) => c.hasP1).length;
  const contractsWithP2 = contracts.filter((c) => c.hasP2).length;
  const contractsWithP3 = contracts.filter((c) => c.hasP3).length;

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
            Gérez vos marchés d&apos;exploitation P1/P2/P3
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
          value={contracts.filter((c) => c.status === "ACTIF").length.toString()}
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Avec P1 (énergie)"
          value={contractsWithP1.toString()}
          icon={Euro}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Avec P2 (maintenance)"
          value={contractsWithP2.toString()}
          icon={Euro}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Avec P3 (travaux)"
          value={contractsWithP3.toString()}
          icon={Euro}
          iconColor="text-green-600"
        />
      </div>

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <FileText size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucun contrat</p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Créer un contrat
          </Button>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
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
                          {contract.sites.length} site{contract.sites.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">
                        {contract.contractType}
                      </span>
                      {contract.hasP1 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">P1</span>
                      )}
                      {contract.hasP2 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">P2</span>
                      )}
                      {contract.hasP3 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">P3</span>
                      )}
                      {contract.hasP4 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">P4</span>
                      )}
                    </div>
                    <ChevronRight size={20} className="text-text-secondary" />
                  </div>
                </div>
              </ChartCard>
            </Link>
          ))}
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

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Type de contrat *
                </label>
                <select
                  required
                  value={formData.contractType}
                  onChange={(e) =>
                    setFormData({ ...formData, contractType: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {contractTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-2">
                  Prestations incluses
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasP1}
                      onChange={(e) =>
                        setFormData({ ...formData, hasP1: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-primary-dark">P1 - Énergie</p>
                      <p className="text-xs text-text-secondary">Combustible/Fourniture</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasP2}
                      onChange={(e) =>
                        setFormData({ ...formData, hasP2: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-primary-dark">P2 - Maintenance</p>
                      <p className="text-xs text-text-secondary">Petit entretien</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasP3}
                      onChange={(e) =>
                        setFormData({ ...formData, hasP3: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-primary-dark">P3 - Travaux</p>
                      <p className="text-xs text-text-secondary">Gros entretien/Renouvellement</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.hasP4}
                      onChange={(e) =>
                        setFormData({ ...formData, hasP4: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-primary-dark">P4 - Financement</p>
                      <p className="text-xs text-text-secondary">Investissement</p>
                    </div>
                  </label>
                </div>
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
