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
  Euro,
  CheckCircle,
  Clock,
  Trash2,
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

interface AvenantItem {
  id: string;
  type: string;
  effectiveDate: string;
  description: string | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  newAmountP1: number | null;
  newAmountP2: number | null;
  newAmountP3: number | null;
  contractSite: {
    id: string;
    site: { id: string; name: string; type: string };
  } | null;
  equipment: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface Avenant {
  id: string;
  reference: string;
  signatureDate: string | null;
  description: string | null;
  items: AvenantItem[];
  _totals: {
    deltaP1: number;
    deltaP2: number;
    deltaP3: number;
    total: number;
  };
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

interface Acompte {
  number: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  billingDate: string;
  percentage: number;
  amountP2: number;
  amountP3: number;
  total: number;
  isPaid: boolean;
  isCurrent: boolean;
}

interface SeasonSite {
  siteId: string;
  siteName: string;
  amountP2: number;
  amountP3: number;
  total: number;
}

interface Season {
  label: string;
  startDate: string;
  endDate: string;
  totalP2: number;
  totalP3: number;
  total: number;
  acomptes: Acompte[];
  sites: SeasonSite[];
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

interface FinancialSummary {
  currentSeasonLabel: string;
  currentSeasonTotal: number;
  currentSeasonPaid: number;
  currentSeasonRemaining: number;
  totalPastSeasons: number;
  totalFutureSeasons: number;
  totalContract: number;
  seasonCount: number;
}

interface FinancialData {
  summary: FinancialSummary;
  seasons: Season[];
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

// Labels pour les types de modifications dans un avenant
const avenantItemTypeLabels: Record<string, string> = {
  AJOUT_SITE: "Ajout de site",
  RETRAIT_SITE: "Retrait de site",
  AJOUT_EQUIPEMENT: "Ajout d'équipement",
  RETRAIT_EQUIPEMENT: "Retrait d'équipement",
  MODIFICATION_PRIX_P1: "Modification P1",
  MODIFICATION_PRIX_P2: "Modification P2",
  MODIFICATION_PRIX_P3: "Modification P3",
  AJOUT_PRESTATION: "Ajout de prestation",
  RETRAIT_PRESTATION: "Retrait de prestation",
  AUTRE: "Autre",
};

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
  const [deletingContract, setDeletingContract] = useState(false);
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
  const [availableSites, setAvailableSites] = useState<{ id: string; name: string; type: string }[]>([]);

  // Avenant form data with support for multiple actions
  interface PriceChangeItem {
    contractSiteId: string;
    siteName: string;
    deltaP2: string;
    deltaP3: string;
    reason: string;
    effectiveDate: string;
  }
  interface NewSiteItem {
    siteId: string;
    siteName: string;
    contractType: string;
    amountP2: string;
    amountP3: string;
    effectiveDate: string;
  }
  interface RemovedSiteItem {
    contractSiteId: string;
    siteName: string;
    effectiveDate: string;
  }

  const [avenantFormData, setAvenantFormData] = useState({
    reference: "",
    signatureDate: "",
    description: "",
  });
  const [priceChanges, setPriceChanges] = useState<PriceChangeItem[]>([]);
  const [newSites, setNewSites] = useState<NewSiteItem[]>([]);
  const [removedSites, setRemovedSites] = useState<RemovedSiteItem[]>([]);

  // Temp state for adding items
  const [tempPriceChange, setTempPriceChange] = useState({
    contractSiteId: "",
    deltaP2: "",
    deltaP3: "",
    reason: "",
    effectiveDate: "",
  });
  const [tempNewSite, setTempNewSite] = useState({
    siteId: "",
    contractType: "MC",
    amountP2: "",
    amountP3: "",
    effectiveDate: "",
  });
  const [tempRemovedSite, setTempRemovedSite] = useState({
    contractSiteId: "",
    effectiveDate: "",
  });

  const [deletingAvenantId, setDeletingAvenantId] = useState<string | null>(null);

  // Tab state for contract view
  const [activeTab, setActiveTab] = useState<"sites" | "avenants" | "financier">("sites");

  // Financial data
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  const fetchFinancials = async () => {
    setLoadingFinancials(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/financials`);
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setLoadingFinancials(false);
    }
  };

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

  // Load financial data when switching to financier tab
  useEffect(() => {
    if (activeTab === "financier" && !financialData && !loadingFinancials) {
      fetchFinancials();
    }
  }, [activeTab]);

  const handleDeleteAvenant = async (avenantId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet avenant ? Cette action est irréversible et annulera toutes les modifications apportées par cet avenant.")) {
      return;
    }

    setDeletingAvenantId(avenantId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/avenants/${avenantId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchContract();
        // Refresh financial data if on that tab
        if (activeTab === "financier") {
          setFinancialData(null);
          fetchFinancials();
        }
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la suppression de l'avenant");
      }
    } catch (error) {
      console.error("Error deleting avenant:", error);
      alert("Erreur lors de la suppression de l'avenant");
    } finally {
      setDeletingAvenantId(null);
    }
  };

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

  const handleDeleteContract = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce contrat ? Cette action est irréversible et supprimera tous les avenants, sites associés et historiques de prix.")) {
      return;
    }

    setDeletingContract(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/contracts");
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la suppression du contrat");
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
      alert("Erreur lors de la suppression du contrat");
    } finally {
      setDeletingContract(false);
    }
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

  // Charger les sites disponibles (pas encore dans le contrat)
  const fetchAvailableSites = async () => {
    try {
      const response = await fetch("/api/sites");
      if (response.ok) {
        const allSites = await response.json();
        // Filtrer les sites qui ne sont pas déjà dans le contrat
        const contractSiteIds = contract?.contractSites.map((cs) => cs.site.id) || [];
        const available = allSites.filter((s: { id: string }) => !contractSiteIds.includes(s.id));
        setAvailableSites(available);
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    }
  };

  const handleCreateAvenant = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier qu'il y a au moins une action
    if (priceChanges.length === 0 && newSites.length === 0 && removedSites.length === 0) {
      alert("Veuillez ajouter au moins une modification (prix, ajout ou retrait de site)");
      return;
    }

    setCreatingAvenant(true);
    try {
      // Convertir les anciennes données en items pour le nouveau modèle
      const items: Array<{
        type: string;
        effectiveDate: string;
        description?: string;
        contractSiteId?: string;
        siteId?: string;
        contractType?: string;
        hasP1?: boolean;
        hasP2?: boolean;
        hasP3?: boolean;
        amountP1?: string;
        amountP2?: string;
        amountP3?: string;
        deltaP1?: string;
        deltaP2?: string;
        deltaP3?: string;
      }> = [];

      // Ajouter les modifications de prix
      for (const pc of priceChanges) {
        if (pc.deltaP2) {
          items.push({
            type: "MODIFICATION_PRIX_P2",
            effectiveDate: pc.effectiveDate,
            description: pc.reason || undefined,
            contractSiteId: pc.contractSiteId,
            deltaP2: pc.deltaP2,
          });
        }
        if (pc.deltaP3) {
          items.push({
            type: "MODIFICATION_PRIX_P3",
            effectiveDate: pc.effectiveDate,
            description: pc.reason || undefined,
            contractSiteId: pc.contractSiteId,
            deltaP3: pc.deltaP3,
          });
        }
      }

      // Ajouter les nouveaux sites
      for (const ns of newSites) {
        items.push({
          type: "AJOUT_SITE",
          effectiveDate: ns.effectiveDate,
          siteId: ns.siteId,
          contractType: ns.contractType,
          hasP2: true,
          hasP3: true,
          amountP2: ns.amountP2 || undefined,
          amountP3: ns.amountP3 || undefined,
        });
      }

      // Ajouter les sites retirés
      for (const rs of removedSites) {
        items.push({
          type: "RETRAIT_SITE",
          effectiveDate: rs.effectiveDate,
          contractSiteId: rs.contractSiteId,
        });
      }

      const response = await fetch(`/api/contracts/${contractId}/avenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: avenantFormData.reference,
          signatureDate: avenantFormData.signatureDate || null,
          description: avenantFormData.description,
          items,
        }),
      });

      if (response.ok) {
        await fetchContract();
        setShowAvenantModal(false);
        // Reset form
        setAvenantFormData({ reference: "", signatureDate: "", description: "" });
        setPriceChanges([]);
        setNewSites([]);
        setRemovedSites([]);
        setTempPriceChange({ contractSiteId: "", deltaP2: "", deltaP3: "", reason: "", effectiveDate: "" });
        setTempNewSite({ siteId: "", contractType: "MC", amountP2: "", amountP3: "", effectiveDate: "" });
        setTempRemovedSite({ contractSiteId: "", effectiveDate: "" });
        // Refresh financials if needed
        if (activeTab === "financier") {
          setFinancialData(null);
          fetchFinancials();
        }
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la création de l'avenant");
      }
    } catch (error) {
      console.error("Error creating avenant:", error);
      alert("Erreur lors de la création de l'avenant");
    } finally {
      setCreatingAvenant(false);
    }
  };

  // Fonctions pour ajouter des éléments aux listes
  const addPriceChange = () => {
    if (!tempPriceChange.contractSiteId || !tempPriceChange.effectiveDate) return;
    const site = contract?.contractSites.find(cs => cs.id === tempPriceChange.contractSiteId);
    if (!site) return;
    setPriceChanges([...priceChanges, {
      ...tempPriceChange,
      siteName: site.site.name,
    }]);
    setTempPriceChange({ contractSiteId: "", deltaP2: "", deltaP3: "", reason: "", effectiveDate: "" });
  };

  const addNewSite = () => {
    if (!tempNewSite.siteId || !tempNewSite.effectiveDate) return;
    const site = availableSites.find(s => s.id === tempNewSite.siteId);
    if (!site) return;
    // Vérifier que le site n'est pas déjà ajouté
    if (newSites.some(ns => ns.siteId === tempNewSite.siteId)) return;
    setNewSites([...newSites, {
      ...tempNewSite,
      siteName: site.name,
    }]);
    setTempNewSite({ siteId: "", contractType: "MC", amountP2: "", amountP3: "", effectiveDate: "" });
  };

  const addRemovedSite = () => {
    if (!tempRemovedSite.contractSiteId || !tempRemovedSite.effectiveDate) return;
    const site = contract?.contractSites.find(cs => cs.id === tempRemovedSite.contractSiteId);
    if (!site) return;
    // Vérifier que le site n'est pas déjà ajouté
    if (removedSites.some(rs => rs.contractSiteId === tempRemovedSite.contractSiteId)) return;
    setRemovedSites([...removedSites, {
      contractSiteId: tempRemovedSite.contractSiteId,
      siteName: site.site.name,
      effectiveDate: tempRemovedSite.effectiveDate,
    }]);
    setTempRemovedSite({ contractSiteId: "", effectiveDate: "" });
  };

  const removePriceChange = (index: number) => {
    setPriceChanges(priceChanges.filter((_, i) => i !== index));
  };

  const removeNewSite = (index: number) => {
    setNewSites(newSites.filter((_, i) => i !== index));
  };

  const removeRemovedSite = (index: number) => {
    setRemovedSites(removedSites.filter((_, i) => i !== index));
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
          {contract.status !== "RESILIE" && contract.status !== "EXPIRE" && (
            <Button onClick={() => setShowSiteModal(true)}>
              <Plus size={18} className="mr-2" />
              Ajouter un site
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDeleteContract}
            disabled={deletingContract}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            {deletingContract ? (
              <Loader2 size={18} className="mr-2 animate-spin" />
            ) : (
              <Trash2 size={18} className="mr-2" />
            )}
            Supprimer
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
        <button
          onClick={() => setActiveTab("financier")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "financier"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-primary-dark"
          }`}
        >
          <Euro size={16} className="inline mr-2" />
          Financier
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
            contract.status !== "RESILIE" && contract.status !== "EXPIRE" ? (
              <Button variant="outline" size="sm" onClick={() => setShowAvenantModal(true)}>
                <Plus size={16} className="mr-1" />
                Nouvel avenant
              </Button>
            ) : null
          }
        >
          {(!contract.avenants || contract.avenants.length === 0) ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-text-secondary mb-4">
                Aucun avenant pour ce contrat
              </p>
              {contract.status !== "RESILIE" && contract.status !== "EXPIRE" && (
                <Button onClick={() => setShowAvenantModal(true)}>
                  <Plus size={18} className="mr-2" />
                  Créer un avenant
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {contract.avenants.map((avenant) => (
                <div
                  key={avenant.id}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-primary-dark">
                          {avenant.reference}
                        </h4>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {avenant.items.length} modification{avenant.items.length > 1 ? "s" : ""}
                        </span>
                        {avenant._totals.total !== 0 && (
                          <span className={`px-2 py-0.5 rounded text-xs ${avenant._totals.total > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {avenant._totals.total > 0 ? "+" : ""}{avenant._totals.total.toLocaleString("fr-FR")} €/an
                          </span>
                        )}
                      </div>
                      {avenant.signatureDate && (
                        <p className="text-sm text-text-secondary mt-1">
                          Signé le : {new Date(avenant.signatureDate).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                      {avenant.description && (
                        <p className="text-sm text-text-secondary mt-1">
                          {avenant.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteAvenant(avenant.id)}
                        disabled={deletingAvenantId === avenant.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Supprimer l'avenant"
                      >
                        {deletingAvenantId === avenant.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Items list */}
                  {avenant.items && avenant.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-text-secondary mb-2">
                        Modifications :
                      </p>
                      <div className="space-y-2">
                        {avenant.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded gap-2"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                                {avenantItemTypeLabels[item.type] || item.type}
                              </span>
                              <span className="text-primary-dark">
                                {item.contractSite?.site?.name || item.equipment?.name || ""}
                              </span>
                              <span className="text-text-secondary text-xs">
                                (effet: {new Date(item.effectiveDate).toLocaleDateString("fr-FR")})
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs">
                              {item.deltaP1 !== null && item.deltaP1 !== 0 && (
                                <span className={`${item.deltaP1 > 0 ? "text-red-600" : "text-green-600"}`}>
                                  P1: {item.deltaP1 > 0 ? "+" : ""}{item.deltaP1.toLocaleString("fr-FR")} €
                                </span>
                              )}
                              {item.deltaP2 !== null && item.deltaP2 !== 0 && (
                                <span className={`${item.deltaP2 > 0 ? "text-red-600" : "text-green-600"}`}>
                                  P2: {item.deltaP2 > 0 ? "+" : ""}{item.deltaP2.toLocaleString("fr-FR")} €
                                </span>
                              )}
                              {item.deltaP3 !== null && item.deltaP3 !== 0 && (
                                <span className={`${item.deltaP3 > 0 ? "text-red-600" : "text-green-600"}`}>
                                  P3: {item.deltaP3 > 0 ? "+" : ""}{item.deltaP3.toLocaleString("fr-FR")} €
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

      {/* Financier Tab */}
      {activeTab === "financier" && (
        <div className="space-y-6">
          {loadingFinancials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : financialData ? (
            <>
              {/* Summary Cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ChartCard title="" className="text-center">
                  <div className="flex flex-col items-center -mt-2">
                    <Calendar size={24} className="text-accent mb-2" />
                    <p className="text-xs text-text-secondary">Saison en cours</p>
                    <p className="text-xl font-bold text-primary-dark">
                      {financialData.summary.currentSeasonTotal.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">{financialData.summary.currentSeasonLabel}</p>
                  </div>
                </ChartCard>

                <ChartCard title="" className="text-center">
                  <div className="flex flex-col items-center -mt-2">
                    <CheckCircle size={24} className="text-green-600 mb-2" />
                    <p className="text-xs text-text-secondary">Saison en cours - Payé</p>
                    <p className="text-xl font-bold text-green-600">
                      {financialData.summary.currentSeasonPaid.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">
                      Reste: {financialData.summary.currentSeasonRemaining.toLocaleString("fr-FR")} €
                    </p>
                  </div>
                </ChartCard>

                <ChartCard title="" className="text-center">
                  <div className="flex flex-col items-center -mt-2">
                    <Clock size={24} className="text-blue-600 mb-2" />
                    <p className="text-xs text-text-secondary">Saisons futures</p>
                    <p className="text-xl font-bold text-primary-dark">
                      {financialData.summary.totalFutureSeasons.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">Prévisionnel</p>
                  </div>
                </ChartCard>

                <ChartCard title="" className="text-center">
                  <div className="flex flex-col items-center -mt-2">
                    <Euro size={24} className="text-accent mb-2" />
                    <p className="text-xs text-text-secondary">Total contrat</p>
                    <p className="text-xl font-bold text-primary-dark">
                      {financialData.summary.totalContract.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">{financialData.summary.seasonCount} saisons</p>
                  </div>
                </ChartCard>
              </div>

              {/* Seasons breakdown with acomptes */}
              <ChartCard title="Saisons de chauffe (P2 + P3)">
                <div className="space-y-6">
                  {financialData.seasons.map((season) => (
                    <div
                      key={season.label}
                      className={`border rounded-xl p-4 ${
                        season.isCurrent
                          ? "border-accent bg-accent/5"
                          : season.isPast
                          ? "border-green-200 bg-green-50/50"
                          : "border-gray-200"
                      }`}
                    >
                      {/* Season Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-primary-dark text-lg">
                            Saison {season.label}
                          </h4>
                          {season.isCurrent && (
                            <span className="px-2 py-0.5 bg-accent text-white rounded text-xs">
                              En cours
                            </span>
                          )}
                          {season.isPast && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Terminée
                            </span>
                          )}
                          {season.isFuture && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              À venir
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary-dark">
                            {season.total.toLocaleString("fr-FR")} € HT
                          </p>
                          <p className="text-xs text-text-secondary">
                            P2: {season.totalP2.toLocaleString("fr-FR")} € | P3: {season.totalP3.toLocaleString("fr-FR")} €
                          </p>
                        </div>
                      </div>

                      {/* 4 Acomptes Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {season.acomptes.map((acompte) => (
                          <div
                            key={acompte.number}
                            className={`p-3 rounded-lg border ${
                              acompte.isCurrent
                                ? "border-accent bg-accent/10"
                                : acompte.isPaid
                                ? "border-green-200 bg-green-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-text-secondary">
                                {acompte.label}
                              </span>
                              {acompte.isCurrent && (
                                <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
                              )}
                              {acompte.isPaid && (
                                <CheckCircle size={12} className="text-green-600" />
                              )}
                            </div>
                            <p className="font-bold text-primary-dark">
                              {acompte.total.toLocaleString("fr-FR")} €
                            </p>
                            <p className="text-xs text-text-secondary">
                              {new Date(acompte.periodStart).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} - {new Date(acompte.periodEnd).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                              Fact. {new Date(acompte.billingDate).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Site breakdown */}
                      {season.sites.length > 0 && (
                        <div className="border-t border-gray-100 pt-3">
                          <p className="text-xs font-medium text-text-secondary mb-2">Détail par site</p>
                          <div className="space-y-2">
                            {season.sites.map((site) => (
                              <div
                                key={site.siteId}
                                className="flex items-center justify-between text-sm bg-white px-3 py-2 rounded border border-gray-100"
                              >
                                <span className="text-primary-dark font-medium">
                                  {site.siteName}
                                </span>
                                <div className="text-right">
                                  <span className="font-medium text-primary-dark">
                                    {site.total.toLocaleString("fr-FR")} €
                                  </span>
                                  <p className="text-xs text-text-secondary">
                                    P2: {site.amountP2.toLocaleString("fr-FR")} € | P3: {site.amountP3.toLocaleString("fr-FR")} €
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ChartCard>
            </>
          ) : (
            <ChartCard title="">
              <div className="text-center py-12">
                <Euro size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-text-secondary">
                  Aucune donnée financière disponible
                </p>
              </div>
            </ChartCard>
          )}
        </div>
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

      {/* Create Avenant Modal - Multi-actions */}
      {showAvenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouvel avenant
              </h2>
              <button
                onClick={() => {
                  setShowAvenantModal(false);
                  setPriceChanges([]);
                  setNewSites([]);
                  setRemovedSites([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAvenant} className="p-6 space-y-4">
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date de signature
                  </label>
                  <input
                    type="date"
                    value={avenantFormData.signatureDate}
                    onChange={(e) =>
                      setAvenantFormData({ ...avenantFormData, signatureDate: e.target.value })
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
                  placeholder="Ex: Ajout équipements et modifications tarifaires"
                />
              </div>

              {/* Section Modifications de prix */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-primary-dark mb-3 flex items-center gap-2">
                  <Euro size={18} className="text-accent" />
                  Modifications de prix ({priceChanges.length})
                </h3>

                {/* Liste des modifications ajoutées */}
                {priceChanges.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {priceChanges.map((pc, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{pc.siteName}</span>
                          <span className="text-accent ml-2 text-xs">
                            {new Date(pc.effectiveDate).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="text-text-secondary ml-2">
                            {pc.deltaP2 && `P2: ${Number(pc.deltaP2) > 0 ? '+' : ''}${pc.deltaP2}€`}
                            {pc.deltaP2 && pc.deltaP3 && ' | '}
                            {pc.deltaP3 && `P3: ${Number(pc.deltaP3) > 0 ? '+' : ''}${pc.deltaP3}€`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePriceChange(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire pour ajouter une modification */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select
                        value={tempPriceChange.contractSiteId}
                        onChange={(e) => setTempPriceChange({ ...tempPriceChange, contractSiteId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="">Sélectionner un site</option>
                        {contract.contractSites.filter(cs => !cs.exitDate).map((cs) => (
                          <option key={cs.id} value={cs.id}>{cs.site.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="date"
                        placeholder="Date d'effet"
                        value={tempPriceChange.effectiveDate}
                        onChange={(e) => setTempPriceChange({ ...tempPriceChange, effectiveDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Delta P2 (€)"
                        value={tempPriceChange.deltaP2}
                        onChange={(e) => setTempPriceChange({ ...tempPriceChange, deltaP2: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Delta P3 (€)"
                        value={tempPriceChange.deltaP3}
                        onChange={(e) => setTempPriceChange({ ...tempPriceChange, deltaP3: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Raison (optionnel)"
                        value={tempPriceChange.reason}
                        onChange={(e) => setTempPriceChange({ ...tempPriceChange, reason: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPriceChange}
                    disabled={!tempPriceChange.contractSiteId || !tempPriceChange.effectiveDate || (!tempPriceChange.deltaP2 && !tempPriceChange.deltaP3)}
                    className="w-full"
                  >
                    <Plus size={16} className="mr-1" />
                    Ajouter modification
                  </Button>
                </div>
              </div>

              {/* Section Ajout de sites */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-primary-dark mb-3 flex items-center gap-2">
                  <Plus size={18} className="text-green-600" />
                  Ajout de sites ({newSites.length})
                </h3>

                {/* Liste des sites à ajouter */}
                {newSites.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newSites.map((ns, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{ns.siteName}</span>
                          <span className="text-green-600 ml-2 text-xs">
                            {new Date(ns.effectiveDate).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="text-text-secondary ml-2">
                            {ns.amountP2 && `P2: ${ns.amountP2}€`}
                            {ns.amountP2 && ns.amountP3 && ' | '}
                            {ns.amountP3 && `P3: ${ns.amountP3}€`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNewSite(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire pour ajouter un site */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select
                        value={tempNewSite.siteId}
                        onChange={(e) => setTempNewSite({ ...tempNewSite, siteId: e.target.value })}
                        onFocus={fetchAvailableSites}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="">Sélectionner un site à ajouter</option>
                        {availableSites
                          .filter(s => !contract.contractSites.some(cs => cs.site.id === s.id))
                          .filter(s => !newSites.some(ns => ns.siteId === s.id))
                          .map((site) => (
                            <option key={site.id} value={site.id}>{site.name} ({site.type})</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="date"
                        placeholder="Date d'entrée"
                        value={tempNewSite.effectiveDate}
                        onChange={(e) => setTempNewSite({ ...tempNewSite, effectiveDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <select
                        value={tempNewSite.contractType}
                        onChange={(e) => setTempNewSite({ ...tempNewSite, contractType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        {contractTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="P2 (€)"
                        value={tempNewSite.amountP2}
                        onChange={(e) => setTempNewSite({ ...tempNewSite, amountP2: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="P3 (€)"
                        value={tempNewSite.amountP3}
                        onChange={(e) => setTempNewSite({ ...tempNewSite, amountP3: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewSite}
                    disabled={!tempNewSite.siteId || !tempNewSite.effectiveDate}
                    className="w-full"
                  >
                    <Plus size={16} className="mr-1" />
                    Ajouter site
                  </Button>
                </div>
              </div>

              {/* Section Retrait de sites */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-medium text-primary-dark mb-3 flex items-center gap-2">
                  <X size={18} className="text-red-600" />
                  Retrait de sites ({removedSites.length})
                </h3>

                {/* Liste des sites à retirer */}
                {removedSites.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {removedSites.map((rs, index) => (
                      <div key={index} className="flex items-center justify-between bg-red-50 px-3 py-2 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{rs.siteName}</span>
                          <span className="text-red-600 ml-2 text-xs">
                            {new Date(rs.effectiveDate).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRemovedSite(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire pour retirer un site */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={tempRemovedSite.contractSiteId}
                      onChange={(e) => setTempRemovedSite({ ...tempRemovedSite, contractSiteId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">Sélectionner un site à retirer</option>
                      {contract.contractSites
                        .filter(cs => !cs.exitDate)
                        .filter(cs => !removedSites.some(rs => rs.contractSiteId === cs.id))
                        .map((cs) => (
                          <option key={cs.id} value={cs.id}>{cs.site.name}</option>
                        ))}
                    </select>
                    <input
                      type="date"
                      placeholder="Date de sortie"
                      value={tempRemovedSite.effectiveDate}
                      onChange={(e) => setTempRemovedSite({ ...tempRemovedSite, effectiveDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRemovedSite}
                    disabled={!tempRemovedSite.contractSiteId || !tempRemovedSite.effectiveDate}
                    className="w-full"
                  >
                    <Plus size={16} className="mr-1" />
                    Ajouter au retrait
                  </Button>
                </div>
              </div>

              {/* Résumé */}
              {(priceChanges.length > 0 || newSites.length > 0 || removedSites.length > 0) && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary-dark mb-1">Résumé de l&apos;avenant :</p>
                  <ul className="text-sm text-text-secondary space-y-1">
                    {priceChanges.length > 0 && <li>• {priceChanges.length} modification(s) de prix</li>}
                    {newSites.length > 0 && <li>• {newSites.length} site(s) à ajouter</li>}
                    {removedSites.length > 0 && <li>• {removedSites.length} site(s) à retirer</li>}
                  </ul>
                </div>
              )}

              <p className="text-xs text-text-secondary bg-gray-50 p-3 rounded-lg">
                Le prix sera calculé au prorata selon la date d&apos;effet. Vous pouvez combiner plusieurs types de modifications dans un même avenant.
              </p>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAvenantModal(false);
                    setPriceChanges([]);
                    setNewSites([]);
                    setRemovedSites([]);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={creatingAvenant || (priceChanges.length === 0 && newSites.length === 0 && removedSites.length === 0)}
                >
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
