"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Download,
  Loader2,
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

type SiteType =
  | "LYCEE"
  | "COLLEGE"
  | "ECOLE"
  | "MAIRIE"
  | "HOPITAL"
  | "GYMNASE"
  | "PISCINE"
  | "MEDIATHEQUE"
  | "AUTRE";

type EnergyType =
  | "GAZ"
  | "ELECTRICITE"
  | "FIOUL"
  | "BOIS"
  | "RESEAU_CHALEUR"
  | "AUTRE";

interface Site {
  id: string;
  name: string;
  type: SiteType;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  energyType: EnergyType;
  annualBudget: number | null;
  _count?: {
    equipments: number;
    consumptions: number;
    alerts: number;
  };
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  linkedToContract: number;
  sites: Array<{ id: string; name: string }>;
  errors?: string[];
}

const siteTypeLabels: Record<SiteType, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

const energyTypeLabels: Record<EnergyType, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  AUTRE: "Autre",
};

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "LYCEE" as SiteType,
    address: "",
    city: "",
    postalCode: "",
    surface: "",
    energyType: "GAZ" as EnergyType,
    annualBudget: "",
  });

  // Fetch sites
  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/sites");
      if (!response.ok) throw new Error("Erreur lors du chargement");
      const data = await response.json();
      setSites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Fetch contracts for import modal
  const fetchContracts = async () => {
    try {
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        // Filter only active contracts
        setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
      }
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // Open import modal
  const openImportModal = () => {
    setImportFile(null);
    setSelectedContractId("");
    setImportResult(null);
    fetchContracts();
    setShowImportModal(true);
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (selectedContractId) {
        formData.append("contractId", selectedContractId);
      }

      const response = await fetch("/api/sites/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false,
          imported: 0,
          linkedToContract: 0,
          sites: [],
          errors: [result.error || "Erreur lors de l'import"],
        });
      } else {
        setImportResult(result);
        if (result.success) {
          await fetchSites();
        }
      }
    } catch (err) {
      setImportResult({
        success: false,
        imported: 0,
        linkedToContract: 0,
        sites: [],
        errors: [err instanceof Error ? err.message : "Erreur inconnue"],
      });
    } finally {
      setImporting(false);
    }
  };

  // Create site
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      await fetchSites();
      setShowModal(false);
      setFormData({
        name: "",
        type: "LYCEE",
        address: "",
        city: "",
        postalCode: "",
        surface: "",
        energyType: "GAZ",
        annualBudget: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  // Filter sites by search query
  const filteredSites = sites.filter(
    (site) =>
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Sites & Patrimoine
          </h1>
          <p className="text-text-secondary">
            Gérez l&apos;ensemble de vos sites et équipements CVC
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openImportModal}>
            <Upload size={18} className="mr-2" />
            Importer
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Ajouter un site
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
          />
        </div>
        <Button variant="outline">
          <Filter size={18} className="mr-2" />
          Filtres
        </Button>
        <Button variant="outline">
          <Download size={18} className="mr-2" />
          Exporter
        </Button>
      </div>

      {/* Loading / Error / Empty states */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : filteredSites.length === 0 ? (
        <ChartCard
          title="Aucun site"
          className="flex flex-col items-center justify-center py-12"
        >
          <Building2 size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">
            {searchQuery
              ? "Aucun site ne correspond à votre recherche"
              : "Commencez par ajouter votre premier site"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={18} className="mr-2" />
              Ajouter un site
            </Button>
          )}
        </ChartCard>
      ) : (
        /* Sites Table */
        <ChartCard
          title={`${filteredSites.length} site${filteredSites.length > 1 ? "s" : ""}`}
          className="overflow-hidden"
        >
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-y border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Site
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Type
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Surface
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Énergie
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Équipements
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Alertes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSites.map((site) => (
                  <tr
                    key={site.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                          <Building2 size={18} className="text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-primary-dark">
                            {site.name}
                          </p>
                          <p className="text-sm text-text-secondary truncate max-w-[200px]">
                            {site.address}, {site.postalCode} {site.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {siteTypeLabels[site.type]}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {site.surface ? `${site.surface.toLocaleString()} m²` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {energyTypeLabels[site.energyType]}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {site._count?.equipments || 0}
                    </td>
                    <td className="px-6 py-4">
                      {(site._count?.alerts || 0) > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {site._count?.alerts} alerte
                          {(site._count?.alerts || 0) > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
                Nouveau site
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Nom du site *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: Lycée Jean Moulin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type de bâtiment *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as SiteType,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(siteTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type d&apos;énergie *
                  </label>
                  <select
                    required
                    value={formData.energyType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        energyType: e.target.value as EnergyType,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(energyTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Adresse *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: 12 rue de la République"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Code postal *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="75001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Surface (m²)
                  </label>
                  <input
                    type="number"
                    value={formData.surface}
                    onChange={(e) =>
                      setFormData({ ...formData, surface: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Budget annuel (€)
                  </label>
                  <input
                    type="number"
                    value={formData.annualBudget}
                    onChange={(e) =>
                      setFormData({ ...formData, annualBudget: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="50000"
                  />
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
                    "Créer le site"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Importer des sites
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!importResult ? (
                <>
                  {/* File upload */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-2">
                      Fichier Excel (.xlsx, .xls)
                    </label>
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                        importFile
                          ? "border-accent bg-accent/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {importFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileSpreadsheet size={24} className="text-accent" />
                          <div className="text-left">
                            <p className="font-medium text-primary-dark">
                              {importFile.name}
                            </p>
                            <p className="text-sm text-text-secondary">
                              {(importFile.size / 1024).toFixed(1)} Ko
                            </p>
                          </div>
                          <button
                            onClick={() => setImportFile(null)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-text-secondary">
                            Cliquez ou glissez un fichier Excel
                          </p>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setImportFile(file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Contract linking (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-2">
                      Rattacher à un contrat (optionnel)
                    </label>
                    <select
                      value={selectedContractId}
                      onChange={(e) => setSelectedContractId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="">Aucun contrat</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.reference} - {contract.title} ({contract.provider})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">
                      Si un contrat est sélectionné, les sites seront automatiquement ajoutés à ce contrat.
                    </p>
                  </div>

                  {/* Expected columns info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-primary-dark mb-2">
                      Colonnes attendues :
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                      <div>
                        <span className="font-medium">Obligatoire :</span> Nom
                      </div>
                      <div>
                        <span className="font-medium">Optionnel :</span> Type, Adresse, Ville, CP
                      </div>
                      <div>Surface, Énergie, PCE, PDL, RAE</div>
                      <div>P1, P2, P3, P4, Montant P2, Montant P3</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowImportModal(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!importFile || importing}
                      onClick={handleImport}
                    >
                      {importing ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          Import...
                        </>
                      ) : (
                        <>
                          <Upload size={18} className="mr-2" />
                          Importer
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                /* Import result */
                <div className="text-center">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">
                        Import réussi !
                      </h3>
                      <p className="text-text-secondary mb-4">
                        {importResult.imported} site{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}
                        {importResult.linkedToContract > 0 && (
                          <span className="block text-sm mt-1">
                            dont {importResult.linkedToContract} rattaché{importResult.linkedToContract > 1 ? "s" : ""} au contrat
                          </span>
                        )}
                      </p>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm text-left mb-4">
                          <p className="font-medium mb-1">Avertissements :</p>
                          <ul className="list-disc list-inside">
                            {importResult.errors.slice(0, 5).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                            {importResult.errors.length > 5 && (
                              <li>... et {importResult.errors.length - 5} autres</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">
                        Erreur lors de l&apos;import
                      </h3>
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-left mb-4">
                        <ul className="list-disc list-inside">
                          {importResult.errors?.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  <Button onClick={() => setShowImportModal(false)} className="w-full">
                    Fermer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
