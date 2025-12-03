"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Plus,
  Calendar,
  Loader2,
  X,
  ArrowLeft,
  Settings,
  ChevronDown,
  ChevronRight,
  Pencil,
  FileText,
  TrendingUp,
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
  surfaceChauffee: number | null;
  energyType: string;
  nb: number | null;
  nbUnit: string | null;
  pce: string | null;
  pdl: string | null;
  equipments: Equipment[];
}

interface PriceChange {
  id: string;
  effectiveDate: string;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  reason: string | null;
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  integrationDate: string | null;
  exitDate: string | null;
  site: Site;
  priceChanges?: PriceChange[];
}

interface AvenantPriceChange {
  id: string;
  effectiveDate: string;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  reason: string | null;
  contractSite: {
    id: string;
    site: { id: string; name: string };
  };
}

interface Avenant {
  id: string;
  reference: string;
  type: string;
  effectiveDate: string;
  description: string | null;
  priceChanges: AvenantPriceChange[];
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "ACTIF" | "EXPIRE" | "EN_ATTENTE" | "RESILIE";
  yearType: "CIVIL" | "HEATING_SEASON";
  yearStartMonth: number;
  yearStartDay: number;
  contractSites: ContractSite[];
  avenants: Avenant[];
}

const statusLabels = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  EN_ATTENTE: "En attente",
  RESILIE: "Résilié",
};

const contractTypes = [
  { value: "MC", label: "MC - Marché Comptage" },
  { value: "MCI", label: "MCI - Marché Comptage avec Intéressement" },
  { value: "MT", label: "MT - Marché à Température" },
  { value: "MTI", label: "MTI - Marché à Température avec Intéressement" },
  { value: "CP", label: "CP - Combustible et Prestations" },
  { value: "CPI", label: "CPI - Combustible et Prestations avec Intéressement" },
  { value: "PF", label: "PF - Prestation et Forfait" },
  { value: "PFI", label: "PFI - Prestation et Forfait avec Intéressement" },
  { value: "MF", label: "MF - Marché Forfaitaire" },
  { value: "AUTRE", label: "Autre" },
];

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

const avenantTypes = [
  { value: "AJOUT_EQUIPEMENT", label: "Ajout d'équipement" },
  { value: "RETRAIT_EQUIPEMENT", label: "Retrait d'équipement" },
  { value: "MODIFICATION_PRIX", label: "Modification de prix" },
  { value: "AJOUT_SITE", label: "Ajout de site" },
  { value: "RETRAIT_SITE", label: "Retrait de site" },
  { value: "MODIFICATION_PRESTATION", label: "Modification de prestation" },
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
    surfaceChauffee: "",
    energyType: "GAZ",
    nb: "",
    nbUnit: "PCS",
    pce: "",
    pdl: "",
    // Contract-specific settings
    contractType: "MC",
    hasP1: false,
    hasP2: false,
    hasP3: false,
    hasP4: false,
    amountP1: "",
    amountP2: "",
    amountP3: "",
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

  // Contract edit modal
  const [showEditContractModal, setShowEditContractModal] = useState(false);
  const [updatingContract, setUpdatingContract] = useState(false);
  const [contractFormData, setContractFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "ACTIF",
  });

  // Site edit modal
  const [showEditSiteModal, setShowEditSiteModal] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [updatingSite, setUpdatingSite] = useState(false);
  const [editSiteFormData, setEditSiteFormData] = useState({
    name: "",
    type: "LYCEE",
    address: "",
    city: "",
    postalCode: "",
    surface: "",
    surfaceChauffee: "",
    energyType: "GAZ",
    nb: "",
    nbUnit: "PCS",
    pce: "",
    pdl: "",
  });

  // Avenant creation modal
  const [showAvenantModal, setShowAvenantModal] = useState(false);
  const [creatingAvenant, setCreatingAvenant] = useState(false);
  const [avenantFormData, setAvenantFormData] = useState({
    reference: "",
    type: "MODIFICATION_PRIX",
    effectiveDate: "",
    description: "",
    // Price changes for selected site
    selectedContractSiteId: "",
    deltaP2: "",
    deltaP3: "",
    reason: "",
  });

  // Tab state for contract view
  const [activeTab, setActiveTab] = useState<"sites" | "avenants">("sites");

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
      // Create the site first
      const siteResponse = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: siteFormData.name,
          type: siteFormData.type,
          address: siteFormData.address,
          city: siteFormData.city,
          postalCode: siteFormData.postalCode,
          energyType: siteFormData.energyType,
          surface: siteFormData.surface ? parseFloat(siteFormData.surface) : null,
          surfaceChauffee: siteFormData.surfaceChauffee ? parseFloat(siteFormData.surfaceChauffee) : null,
          nb: siteFormData.nb ? parseFloat(siteFormData.nb) : null,
          nbUnit: siteFormData.nbUnit,
          pce: siteFormData.pce,
          pdl: siteFormData.pdl,
        }),
      });

      if (siteResponse.ok) {
        const newSite = await siteResponse.json();

        // Add the site to this contract with contract type and prestations
        await fetch(`/api/contracts/${contractId}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: newSite.id,
            contractType: siteFormData.contractType,
            hasP1: siteFormData.hasP1,
            hasP2: siteFormData.hasP2,
            hasP3: siteFormData.hasP3,
            hasP4: siteFormData.hasP4,
            amountP1: siteFormData.amountP1,
            amountP2: siteFormData.amountP2,
            amountP3: siteFormData.amountP3,
          }),
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
          surfaceChauffee: "",
          energyType: "GAZ",
          nb: "",
          nbUnit: "PCS",
          pce: "",
          pdl: "",
          contractType: "MC",
          hasP1: false,
          hasP2: false,
          hasP3: false,
          hasP4: false,
          amountP1: "",
          amountP2: "",
          amountP3: "",
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

  const openEditContractModal = () => {
    if (!contract) return;
    setContractFormData({
      reference: contract.reference,
      title: contract.title,
      provider: contract.provider,
      description: contract.description || "",
      startDate: contract.startDate.split("T")[0],
      endDate: contract.endDate.split("T")[0],
      status: contract.status,
    });
    setShowEditContractModal(true);
  };

  const handleUpdateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingContract(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: contractFormData.reference,
          title: contractFormData.title,
          provider: contractFormData.provider,
          description: contractFormData.description || null,
          startDate: contractFormData.startDate,
          endDate: contractFormData.endDate,
          status: contractFormData.status,
        }),
      });

      if (response.ok) {
        await fetchContract();
        setShowEditContractModal(false);
      }
    } catch (error) {
      console.error("Error updating contract:", error);
    } finally {
      setUpdatingContract(false);
    }
  };

  const openEditSiteModal = (site: Site) => {
    setEditingSiteId(site.id);
    setEditSiteFormData({
      name: site.name,
      type: site.type,
      address: site.address,
      city: site.city,
      postalCode: site.postalCode,
      surface: site.surface?.toString() || "",
      surfaceChauffee: site.surfaceChauffee?.toString() || "",
      energyType: site.energyType,
      nb: site.nb?.toString() || "",
      nbUnit: site.nbUnit || "PCS",
      pce: site.pce || "",
      pdl: site.pdl || "",
    });
    setShowEditSiteModal(true);
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSiteId) return;

    setUpdatingSite(true);
    try {
      const response = await fetch(`/api/sites/${editingSiteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editSiteFormData,
          surface: editSiteFormData.surface ? parseFloat(editSiteFormData.surface) : null,
          surfaceChauffee: editSiteFormData.surfaceChauffee ? parseFloat(editSiteFormData.surfaceChauffee) : null,
          nb: editSiteFormData.nb ? parseFloat(editSiteFormData.nb) : null,
        }),
      });

      if (response.ok) {
        await fetchContract();
        setShowEditSiteModal(false);
        setEditingSiteId(null);
      }
    } catch (error) {
      console.error("Error updating site:", error);
    } finally {
      setUpdatingSite(false);
    }
  };

  const handleCreateAvenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAvenant(true);
    try {
      const priceChanges = avenantFormData.selectedContractSiteId
        ? [
            {
              contractSiteId: avenantFormData.selectedContractSiteId,
              deltaP2: avenantFormData.deltaP2 || null,
              deltaP3: avenantFormData.deltaP3 || null,
              reason: avenantFormData.reason || null,
            },
          ]
        : [];

      const response = await fetch(`/api/contracts/${contractId}/avenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: avenantFormData.reference,
          type: avenantFormData.type,
          effectiveDate: avenantFormData.effectiveDate,
          description: avenantFormData.description,
          priceChanges,
        }),
      });

      if (response.ok) {
        await fetchContract();
        setShowAvenantModal(false);
        setAvenantFormData({
          reference: "",
          type: "MODIFICATION_PRIX",
          effectiveDate: "",
          description: "",
          selectedContractSiteId: "",
          deltaP2: "",
          deltaP3: "",
          reason: "",
        });
      }
    } catch (error) {
      console.error("Error creating avenant:", error);
    } finally {
      setCreatingAvenant(false);
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

  // Aggregate data from contract sites
  const totalEquipments = contract.contractSites.reduce(
    (sum: number, cs: ContractSite) => sum + cs.site.equipments.length,
    0
  );
  const hasAnyP1 = contract.contractSites.some((cs) => cs.hasP1);
  const hasAnyP2 = contract.contractSites.some((cs) => cs.hasP2);
  const hasAnyP3 = contract.contractSites.some((cs) => cs.hasP3);
  const hasAnyP4 = contract.contractSites.some((cs) => cs.hasP4);
  const uniqueContractTypes = [...new Set(contract.contractSites.map((cs) => cs.contractType))];

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditContractModal}>
            <Pencil size={18} className="mr-2" />
            Modifier
          </Button>
          <Button onClick={() => setShowSiteModal(true)}>
            <Plus size={18} className="mr-2" />
            Ajouter un site
          </Button>
        </div>
      </div>

      {/* Contract Info */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <Settings size={24} className="text-blue-600 mb-2" />
            <p className="text-xs text-text-secondary">Types de contrat</p>
            <div className="flex flex-wrap gap-1 justify-center mt-1">
              {uniqueContractTypes.length > 0 ? (
                uniqueContractTypes.map((type) => (
                  <span key={type} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                    {type}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-secondary">Aucun</span>
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Building2 size={24} className="text-green-600 mb-2" />
            <p className="text-xs text-text-secondary mb-2">Prestations</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {hasAnyP1 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">P1</span>
              )}
              {hasAnyP2 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">P2</span>
              )}
              {hasAnyP3 && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">P3</span>
              )}
              {hasAnyP4 && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">P4</span>
              )}
              {!hasAnyP1 && !hasAnyP2 && !hasAnyP3 && !hasAnyP4 && (
                <span className="text-xs text-text-secondary">Aucune</span>
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Building2 size={24} className="text-accent mb-2" />
            <p className="text-xs text-text-secondary">Sites / Équipements</p>
            <p className="text-xl font-bold text-primary-dark">
              {contract.contractSites.length} / {totalEquipments}
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("sites")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sites"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <Building2 size={16} className="inline mr-2" />
          Sites ({contract.contractSites.length})
        </button>
        <button
          onClick={() => setActiveTab("avenants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "avenants"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <FileText size={16} className="inline mr-2" />
          Avenants ({contract.avenants?.length || 0})
        </button>
      </div>

      {/* Sites List */}
      {activeTab === "sites" && (
      <ChartCard
        title={`Sites du contrat (${contract.contractSites.length})`}
        action={
          <Button variant="outline" size="sm" onClick={() => setShowSiteModal(true)}>
            <Plus size={16} className="mr-1" />
            Ajouter
          </Button>
        }
      >
        {contract.contractSites.length === 0 ? (
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
            {contract.contractSites.map((contractSite: ContractSite) => {
              const site = contractSite.site;
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-primary-dark">
                            {site.name}
                          </p>
                          <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                            {contractSite.contractType}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {site.type} • {site.city} • {site.equipments.length} équipement
                          {site.equipments.length > 1 ? "s" : ""}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {contractSite.hasP1 && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">P1</span>
                          )}
                          {contractSite.hasP2 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              P2{contractSite.amountP2 ? ` (${contractSite.amountP2.toLocaleString('fr-FR')} €)` : ''}
                            </span>
                          )}
                          {contractSite.hasP3 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              P3{contractSite.amountP3 ? ` (${contractSite.amountP3.toLocaleString('fr-FR')} €)` : ''}
                            </span>
                          )}
                          {contractSite.hasP4 && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">P4</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSiteModal(site);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
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
                            {site.equipments.map((equipment: Equipment) => (
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
      )}

      {/* Avenants List */}
      {activeTab === "avenants" && (
        <ChartCard
          title={`Avenants (${contract.avenants?.length || 0})`}
          action={
            <Button variant="outline" size="sm" onClick={() => setShowAvenantModal(true)}>
              <Plus size={16} className="mr-1" />
              Nouvel avenant
            </Button>
          }
        >
          {(!contract.avenants || contract.avenants.length === 0) ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-text-secondary mb-4">
                Aucun avenant pour ce contrat
              </p>
              <Button onClick={() => setShowAvenantModal(true)}>
                <Plus size={18} className="mr-2" />
                Créer un avenant
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {contract.avenants.map((avenant) => (
                <div
                  key={avenant.id}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-primary-dark">
                          {avenant.reference}
                        </h4>
                        <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
                          {avenantTypes.find((t) => t.value === avenant.type)?.label || avenant.type}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary mt-1">
                        Date d&apos;effet : {new Date(avenant.effectiveDate).toLocaleDateString("fr-FR")}
                      </p>
                      {avenant.description && (
                        <p className="text-sm text-text-secondary mt-1">
                          {avenant.description}
                        </p>
                      )}
                    </div>
                    <TrendingUp size={20} className="text-accent" />
                  </div>

                  {/* Price changes */}
                  {avenant.priceChanges && avenant.priceChanges.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-text-secondary mb-2">
                        Modifications de prix :
                      </p>
                      <div className="space-y-2">
                        {avenant.priceChanges.map((pc) => (
                          <div
                            key={pc.id}
                            className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded"
                          >
                            <span className="text-primary-dark">
                              {pc.contractSite?.site?.name || "Site"}
                            </span>
                            <div className="flex gap-3">
                              {pc.deltaP2 && (
                                <span className={`${pc.deltaP2 > 0 ? "text-red-600" : "text-green-600"}`}>
                                  P2: {pc.deltaP2 > 0 ? "+" : ""}{pc.deltaP2.toLocaleString("fr-FR")} €
                                </span>
                              )}
                              {pc.deltaP3 && (
                                <span className={`${pc.deltaP3 > 0 ? "text-red-600" : "text-green-600"}`}>
                                  P3: {pc.deltaP3 > 0 ? "+" : ""}{pc.deltaP3.toLocaleString("fr-FR")} €
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      )}

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Surface totale (m²)
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
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Surface chauffée (m²)
                  </label>
                  <input
                    type="number"
                    value={siteFormData.surfaceChauffee}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, surfaceChauffee: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="4500"
                  />
                </div>
              </div>

              {/* Données énergétiques P1 */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Données énergétiques (P1)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      NB - Cible énergétique (MWh)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={siteFormData.nb}
                      onChange={(e) =>
                        setSiteFormData({ ...siteFormData, nb: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Unité NB
                    </label>
                    <select
                      value={siteFormData.nbUnit}
                      onChange={(e) =>
                        setSiteFormData({ ...siteFormData, nbUnit: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="PCS">PCS (Pouvoir Calorifique Supérieur)</option>
                      <option value="UTILE">Utile</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      PCE (compteur gaz)
                    </label>
                    <input
                      type="text"
                      value={siteFormData.pce}
                      onChange={(e) =>
                        setSiteFormData({ ...siteFormData, pce: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="GI123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      PDL (compteur élec)
                    </label>
                    <input
                      type="text"
                      value={siteFormData.pdl}
                      onChange={(e) =>
                        setSiteFormData({ ...siteFormData, pdl: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="12345678901234"
                    />
                  </div>
                </div>
              </div>

              {/* Contract settings for this site */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Paramètres du contrat pour ce site</p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type de contrat *
                  </label>
                  <select
                    required
                    value={siteFormData.contractType}
                    onChange={(e) =>
                      setSiteFormData({ ...siteFormData, contractType: e.target.value })
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
                        checked={siteFormData.hasP1}
                        onChange={(e) =>
                          setSiteFormData({ ...siteFormData, hasP1: e.target.checked })
                        }
                        className="w-4 h-4 text-accent rounded focus:ring-accent"
                      />
                      <span className="text-sm text-primary-dark">P1 - Énergie</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={siteFormData.hasP2}
                        onChange={(e) =>
                          setSiteFormData({ ...siteFormData, hasP2: e.target.checked })
                        }
                        className="w-4 h-4 text-accent rounded focus:ring-accent"
                      />
                      <span className="text-sm text-primary-dark">P2 - Maintenance</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={siteFormData.hasP3}
                        onChange={(e) =>
                          setSiteFormData({ ...siteFormData, hasP3: e.target.checked })
                        }
                        className="w-4 h-4 text-accent rounded focus:ring-accent"
                      />
                      <span className="text-sm text-primary-dark">P3 - Travaux</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={siteFormData.hasP4}
                        onChange={(e) =>
                          setSiteFormData({ ...siteFormData, hasP4: e.target.checked })
                        }
                        className="w-4 h-4 text-accent rounded focus:ring-accent"
                      />
                      <span className="text-sm text-primary-dark">P4 - Financement</span>
                    </label>
                  </div>
                </div>

                {/* Prix de base P2/P3 - affichés conditionnellement */}
                {(siteFormData.hasP2 || siteFormData.hasP3) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-primary-dark mb-3">
                      Montants de base (révisés annuellement)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {siteFormData.hasP2 && (
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">
                            Prix P2 de base (€ HT/an)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={siteFormData.amountP2}
                            onChange={(e) =>
                              setSiteFormData({ ...siteFormData, amountP2: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                            placeholder="5000"
                          />
                        </div>
                      )}
                      {siteFormData.hasP3 && (
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">
                            Prix P3 de base (€ HT/an)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={siteFormData.amountP3}
                            onChange={(e) =>
                              setSiteFormData({ ...siteFormData, amountP3: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                            placeholder="3000"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-2">
                      Ces montants sont révisés à la date anniversaire du contrat.
                    </p>
                  </div>
                )}
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
                  {contract.contractSites.find((cs: ContractSite) => cs.site.id === selectedSiteId)?.site.name}
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

      {/* Edit Contract Modal */}
      {showEditContractModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Modifier le contrat
              </h2>
              <button
                onClick={() => setShowEditContractModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateContract} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Référence *
                </label>
                <input
                  type="text"
                  required
                  value={contractFormData.reference}
                  onChange={(e) =>
                    setContractFormData({ ...contractFormData, reference: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titre du contrat *
                </label>
                <input
                  type="text"
                  required
                  value={contractFormData.title}
                  onChange={(e) =>
                    setContractFormData({ ...contractFormData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titulaire (exploitant) *
                </label>
                <input
                  type="text"
                  required
                  value={contractFormData.provider}
                  onChange={(e) =>
                    setContractFormData({ ...contractFormData, provider: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Description
                </label>
                <textarea
                  value={contractFormData.description}
                  onChange={(e) =>
                    setContractFormData({ ...contractFormData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                    value={contractFormData.startDate}
                    onChange={(e) =>
                      setContractFormData({ ...contractFormData, startDate: e.target.value })
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
                    value={contractFormData.endDate}
                    onChange={(e) =>
                      setContractFormData({ ...contractFormData, endDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <p className="text-sm text-text-secondary bg-gray-50 p-3 rounded-lg">
                Le type de contrat et les prestations (P1, P2, P3, P4) sont définis au niveau de chaque site.
              </p>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Statut
                </label>
                <select
                  value={contractFormData.status}
                  onChange={(e) =>
                    setContractFormData({ ...contractFormData, status: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="ACTIF">Actif</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="EXPIRE">Expiré</option>
                  <option value="RESILIE">Résilié</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEditContractModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={updatingContract}>
                  {updatingContract ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {showEditSiteModal && editingSiteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Modifier le site
              </h2>
              <button
                onClick={() => {
                  setShowEditSiteModal(false);
                  setEditingSiteId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Nom du site *
                </label>
                <input
                  type="text"
                  required
                  value={editSiteFormData.name}
                  onChange={(e) =>
                    setEditSiteFormData({ ...editSiteFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={editSiteFormData.type}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, type: e.target.value })
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
                    value={editSiteFormData.energyType}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, energyType: e.target.value })
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
                  value={editSiteFormData.address}
                  onChange={(e) =>
                    setEditSiteFormData({ ...editSiteFormData, address: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                    value={editSiteFormData.postalCode}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, postalCode: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSiteFormData.city}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, city: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Surface totale (m²)
                  </label>
                  <input
                    type="number"
                    value={editSiteFormData.surface}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, surface: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Surface chauffée (m²)
                  </label>
                  <input
                    type="number"
                    value={editSiteFormData.surfaceChauffee}
                    onChange={(e) =>
                      setEditSiteFormData({ ...editSiteFormData, surfaceChauffee: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Données énergétiques P1 */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Données énergétiques (P1)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      NB - Cible énergétique (MWh)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editSiteFormData.nb}
                      onChange={(e) =>
                        setEditSiteFormData({ ...editSiteFormData, nb: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Unité NB
                    </label>
                    <select
                      value={editSiteFormData.nbUnit}
                      onChange={(e) =>
                        setEditSiteFormData({ ...editSiteFormData, nbUnit: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="PCS">PCS (Pouvoir Calorifique Supérieur)</option>
                      <option value="UTILE">Utile</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      PCE (compteur gaz)
                    </label>
                    <input
                      type="text"
                      value={editSiteFormData.pce}
                      onChange={(e) =>
                        setEditSiteFormData({ ...editSiteFormData, pce: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      PDL (compteur élec)
                    </label>
                    <input
                      type="text"
                      value={editSiteFormData.pdl}
                      onChange={(e) =>
                        setEditSiteFormData({ ...editSiteFormData, pdl: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowEditSiteModal(false);
                    setEditingSiteId(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={updatingSite}>
                  {updatingSite ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Avenant Modal */}
      {showAvenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouvel avenant
              </h2>
              <button
                onClick={() => setShowAvenantModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAvenant} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Référence *
                </label>
                <input
                  type="text"
                  required
                  value={avenantFormData.reference}
                  onChange={(e) =>
                    setAvenantFormData({ ...avenantFormData, reference: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Avenant n°1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={avenantFormData.type}
                    onChange={(e) =>
                      setAvenantFormData({ ...avenantFormData, type: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {avenantTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date d&apos;effet *
                  </label>
                  <input
                    type="date"
                    required
                    value={avenantFormData.effectiveDate}
                    onChange={(e) =>
                      setAvenantFormData({ ...avenantFormData, effectiveDate: e.target.value })
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
                  value={avenantFormData.description}
                  onChange={(e) =>
                    setAvenantFormData({ ...avenantFormData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Ex: Ajout chaudière 300kW"
                />
              </div>

              {/* Price change section */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">
                  Modification de prix (optionnel)
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Site concerné
                  </label>
                  <select
                    value={avenantFormData.selectedContractSiteId}
                    onChange={(e) =>
                      setAvenantFormData({ ...avenantFormData, selectedContractSiteId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner un site</option>
                    {contract.contractSites.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.site.name}
                      </option>
                    ))}
                  </select>
                </div>

                {avenantFormData.selectedContractSiteId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">
                          Delta P2 (€ HT/an)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={avenantFormData.deltaP2}
                          onChange={(e) =>
                            setAvenantFormData({ ...avenantFormData, deltaP2: e.target.value })
                          }
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                          placeholder="+300 ou -100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-primary-dark mb-1">
                          Delta P3 (€ HT/an)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={avenantFormData.deltaP3}
                          onChange={(e) =>
                            setAvenantFormData({ ...avenantFormData, deltaP3: e.target.value })
                          }
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                          placeholder="+200 ou -50"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Raison du changement
                      </label>
                      <input
                        type="text"
                        value={avenantFormData.reason}
                        onChange={(e) =>
                          setAvenantFormData({ ...avenantFormData, reason: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="Ex: Ajout chaudière 300kW"
                      />
                    </div>
                  </>
                )}
              </div>

              <p className="text-sm text-text-secondary bg-gray-50 p-3 rounded-lg">
                Le prix sera calculé au prorata selon la date d&apos;effet et le type d&apos;année contractuelle.
              </p>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAvenantModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creatingAvenant}>
                  {creatingAvenant ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer l'avenant"
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
