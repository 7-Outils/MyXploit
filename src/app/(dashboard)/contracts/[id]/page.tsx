"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Building2,
  Plus,
  Calendar,
  Euro,
  Loader2,
  X,
  ArrowLeft,
  Settings,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface Equipment {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  status: string;
  power: number | null;
}

interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  energyType: string;
  equipments: Equipment[];
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  description: string | null;
  startDate: string;
  endDate: string;
  amountP1: number;
  amountP2: number;
  amountP3: number;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  sites: Site[];
}

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

const siteTypes = [
  { value: "LYCEE", label: "Lycée" },
  { value: "COLLEGE", label: "Collège" },
  { value: "ECOLE", label: "École" },
  { value: "MAIRIE", label: "Mairie" },
  { value: "HOPITAL", label: "Hôpital" },
  { value: "GYMNASE", label: "Gymnase" },
  { value: "PISCINE", label: "Piscine" },
  { value: "MEDIATHEQUE", label: "Médiathèque" },
  { value: "AUTRE", label: "Autre" },
];

const energyTypes = [
  { value: "GAZ", label: "Gaz" },
  { value: "ELECTRICITE", label: "Électricité" },
  { value: "FIOUL", label: "Fioul" },
  { value: "BOIS", label: "Bois" },
  { value: "RESEAU_CHALEUR", label: "Réseau de chaleur" },
  { value: "AUTRE", label: "Autre" },
];

const equipmentTypes = [
  { value: "CHAUDIERE", label: "Chaudière" },
  { value: "CLIMATISATION", label: "Climatisation" },
  { value: "VMC", label: "VMC" },
  { value: "PAC", label: "Pompe à chaleur" },
  { value: "RADIATEUR", label: "Radiateur" },
  { value: "PLANCHER_CHAUFFANT", label: "Plancher chauffant" },
  { value: "CTA", label: "CTA" },
  { value: "AUTRE", label: "Autre" },
];

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  // Site creation modal
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [siteFormData, setSiteFormData] = useState({
    name: "",
    type: "LYCEE",
    address: "",
    city: "",
    postalCode: "",
    surface: "",
    energyType: "GAZ",
  });

  // Equipment creation modal
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [creatingEquipment, setCreatingEquipment] = useState(false);
  const [equipmentFormData, setEquipmentFormData] = useState({
    name: "",
    type: "CHAUDIERE",
    brand: "",
    model: "",
    power: "",
  });

  const fetchContract = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setContract(data);
      } else {
        router.push("/contracts");
      }
    } catch (error) {
      console.error("Error fetching contract:", error);
      router.push("/contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const toggleSiteExpanded = (siteId: string) => {
    const newExpanded = new Set(expandedSites);
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId);
    } else {
      newExpanded.add(siteId);
    }
    setExpandedSites(newExpanded);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSite(true);
    try {
      // Create the site
      const siteResponse = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...siteFormData,
          surface: siteFormData.surface ? parseFloat(siteFormData.surface) : null,
        }),
      });

      if (siteResponse.ok) {
        const newSite = await siteResponse.json();

        // Attach the site to this contract
        const currentSiteIds = contract?.sites.map((s) => s.id) || [];
        await fetch(`/api/contracts/${contractId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteIds: [...currentSiteIds, newSite.id] }),
        });

        await fetchContract();
        setShowSiteModal(false);
        setSiteFormData({
          name: "",
          type: "LYCEE",
          address: "",
          city: "",
          postalCode: "",
          surface: "",
          energyType: "GAZ",
        });
      }
    } catch (error) {
      console.error("Error creating site:", error);
    } finally {
      setCreatingSite(false);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId) return;

    setCreatingEquipment(true);
    try {
      const response = await fetch("/api/equipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...equipmentFormData,
          power: equipmentFormData.power ? parseFloat(equipmentFormData.power) : null,
          siteId: selectedSiteId,
        }),
      });

      if (response.ok) {
        await fetchContract();
        setShowEquipmentModal(false);
        setSelectedSiteId(null);
        setEquipmentFormData({
          name: "",
          type: "CHAUDIERE",
          brand: "",
          model: "",
          power: "",
        });
      }
    } catch (error) {
      console.error("Error creating equipment:", error);
    } finally {
      setCreatingEquipment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  const totalEquipments = contract.sites.reduce(
    (sum, site) => sum + site.equipments.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-primary-dark mb-2"
          >
            <ArrowLeft size={16} />
            Retour aux contrats
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-dark">
              {contract.title}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
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
          <p className="text-text-secondary mt-1">
            {contract.reference} • Titulaire : {contract.provider}
          </p>
        </div>
        <Button onClick={() => setShowSiteModal(true)}>
          <Plus size={18} className="mr-2" />
          Ajouter un site
        </Button>
      </div>

      {/* Contract Info */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Calendar size={24} className="text-accent mb-2" />
            <p className="text-xs text-text-secondary">Période</p>
            <p className="text-sm font-medium text-primary-dark">
              {new Date(contract.startDate).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-xs text-text-secondary">→</p>
            <p className="text-sm font-medium text-primary-dark">
              {new Date(contract.endDate).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Euro size={24} className="text-yellow-600 mb-2" />
            <p className="text-xs text-text-secondary">P1 - Énergie</p>
            <p className="text-xl font-bold text-primary-dark">
              {(contract.amountP1 / 1000).toFixed(0)}k€
            </p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Euro size={24} className="text-blue-600 mb-2" />
            <p className="text-xs text-text-secondary">P2 - Maintenance</p>
            <p className="text-xl font-bold text-primary-dark">
              {(contract.amountP2 / 1000).toFixed(0)}k€
            </p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Euro size={24} className="text-green-600 mb-2" />
            <p className="text-xs text-text-secondary">P3 - Travaux</p>
            <p className="text-xl font-bold text-primary-dark">
              {(contract.amountP3 / 1000).toFixed(0)}k€
            </p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Building2 size={24} className="text-accent mb-2" />
            <p className="text-xs text-text-secondary">Sites / Équipements</p>
            <p className="text-xl font-bold text-primary-dark">
              {contract.sites.length} / {totalEquipments}
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Sites List */}
      <ChartCard
        title={`Sites du contrat (${contract.sites.length})`}
        action={
          <Button variant="outline" size="sm" onClick={() => setShowSiteModal(true)}>
            <Plus size={16} className="mr-1" />
            Ajouter
          </Button>
        }
      >
        {contract.sites.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary mb-4">
              Aucun site rattaché à ce contrat
            </p>
            <Button onClick={() => setShowSiteModal(true)}>
              <Plus size={18} className="mr-2" />
              Créer un site
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contract.sites.map((site) => {
              const isExpanded = expandedSites.has(site.id);
              return (
                <div
                  key={site.id}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Site Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-background-secondary cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSiteExpanded(site.id)}
                  >
                    <div className="flex items-center gap-4">
                      <button className="text-text-secondary">
                        {isExpanded ? (
                          <ChevronDown size={20} />
                        ) : (
                          <ChevronRight size={20} />
                        )}
                      </button>
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Building2 size={20} className="text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-primary-dark">
                          {site.name}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {site.type} • {site.city} • {site.equipments.length} équipement
                          {site.equipments.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSiteId(site.id);
                        setShowEquipmentModal(true);
                      }}
                    >
                      <Plus size={14} className="mr-1" />
                      Équipement
                    </Button>
                  </div>

                  {/* Site Details & Equipments */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="grid sm:grid-cols-3 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-text-secondary">Adresse</p>
                          <p className="text-primary-dark">
                            {site.address}, {site.postalCode} {site.city}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-secondary">Surface</p>
                          <p className="text-primary-dark">
                            {site.surface ? `${site.surface} m²` : "Non renseignée"}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-secondary">Énergie principale</p>
                          <p className="text-primary-dark">{site.energyType}</p>
                        </div>
                      </div>

                      {/* Equipments */}
                      {site.equipments.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-primary-dark mb-2">
                            Équipements ({site.equipments.length})
                          </p>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {site.equipments.map((equipment) => (
                              <div
                                key={equipment.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                              >
                                <Settings size={16} className="text-accent" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-primary-dark truncate">
                                    {equipment.name}
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    {equipment.type}
                                    {equipment.power && ` • ${equipment.power} kW`}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    equipment.status === "OPERATIONNEL"
                                      ? "bg-green-100 text-green-700"
                                      : equipment.status === "MAINTENANCE"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {equipment.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {site.equipments.length === 0 && (
                        <p className="text-sm text-text-secondary text-center py-4">
                          Aucun équipement.{" "}
                          <button
                            className="text-accent hover:underline"
                            onClick={() => {
                              setSelectedSiteId(site.id);
                              setShowEquipmentModal(true);
                            }}
                          >
                            Ajouter un équipement
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Create Site Modal */}
      {showSiteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouveau site
              </h2>
              <button
                onClick={() => setShowSiteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Nom du site *
                </label>
                <input
                  type="text"
                  required
                  value={siteFormData.name}
                  onChange={(e) =>
                    setSiteFormData({ ...siteFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Lycée Jean Moulin"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={siteFormData.type}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, type: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {siteTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Énergie principale *
                  </label>
                  <select
                    required
                    value={siteFormData.energyType}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, energyType: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {energyTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
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
                  value={siteFormData.address}
                  onChange={(e) =>
                    setSiteFormData({ ...siteFormData, address: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="12 rue de la République"
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
                    value={siteFormData.postalCode}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, postalCode: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                    value={siteFormData.city}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, city: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Surface (m²)
                </label>
                <input
                  type="number"
                  value={siteFormData.surface}
                  onChange={(e) =>
                    setSiteFormData({ ...siteFormData, surface: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="5000"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSiteModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creatingSite}>
                  {creatingSite ? (
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

      {/* Create Equipment Modal */}
      {showEquipmentModal && selectedSiteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">
                  Nouvel équipement
                </h2>
                <p className="text-sm text-text-secondary">
                  {contract.sites.find((s) => s.id === selectedSiteId)?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEquipmentModal(false);
                  setSelectedSiteId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Nom de l&apos;équipement *
                </label>
                <input
                  type="text"
                  required
                  value={equipmentFormData.name}
                  onChange={(e) =>
                    setEquipmentFormData({ ...equipmentFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Chaudière principale"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Type *
                </label>
                <select
                  required
                  value={equipmentFormData.type}
                  onChange={(e) =>
                    setEquipmentFormData({ ...equipmentFormData, type: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {equipmentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Marque
                  </label>
                  <input
                    type="text"
                    value={equipmentFormData.brand}
                    onChange={(e) =>
                      setEquipmentFormData({ ...equipmentFormData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="Viessmann"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Modèle
                  </label>
                  <input
                    type="text"
                    value={equipmentFormData.model}
                    onChange={(e) =>
                      setEquipmentFormData({ ...equipmentFormData, model: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="Vitocrossal 300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Puissance (kW)
                </label>
                <input
                  type="number"
                  value={equipmentFormData.power}
                  onChange={(e) =>
                    setEquipmentFormData({ ...equipmentFormData, power: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowEquipmentModal(false);
                    setSelectedSiteId(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creatingEquipment}>
                  {creatingEquipment ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer l'équipement"
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
