"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Wrench,
  Plus,
  Search,
  Loader2,
  X,
  ArrowLeft,
  FileText,
  Users,
  List,
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  Building2,
  Flame,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

type EquipmentDomain =
  | "CHAUFFAGE"
  | "ECS"
  | "VENTILATION"
  | "CLIMATISATION"
  | "TRAITEMENT_EAU"
  | "PLOMBERIE"
  | "CFO_CFA"
  | "COMPTAGE"
  | "AUTRE";

type EquipmentType =
  // Chauffage
  | "CHAUDIERE"
  | "CHAUDIERE_CONDENSATION"
  | "PAC"
  | "PAC_AIR_EAU"
  | "PAC_EAU_EAU"
  | "PAC_AIR_AIR"
  | "RADIATEUR"
  | "PLANCHER_CHAUFFANT"
  | "CONVECTEUR"
  | "AEROTERME"
  | "RADIANT_GAZ"
  | "VANNE_3_VOIES"
  | "VANNE_MOTORISEE"
  | "POMPE_CHAUFFAGE"
  | "CIRCULATEUR"
  | "VASE_EXPANSION"
  | "ECHANGEUR_THERMIQUE"
  | "BRULEUR"
  | "REGULATEUR"
  | "SONDE_TEMPERATURE"
  | "SONDE_EXTERIEURE"
  // ECS
  | "BALLON_ECS"
  | "BALLON_THERMODYNAMIQUE"
  | "PREPARATEUR_ECS_GAZ"
  | "ECHANGEUR_ECS"
  | "POMPE_BOUCLAGE"
  | "MITIGEUR_THERMOSTATIQUE"
  | "RESISTANCE_ELECTRIQUE"
  // Ventilation
  | "VMC"
  | "VMC_SIMPLE_FLUX"
  | "VMC_DOUBLE_FLUX"
  | "CTA"
  | "CAISSON_EXTRACTION"
  | "CAISSON_SOUFFLAGE"
  | "VENTILATEUR"
  | "REGISTRE"
  | "BATTERIE_CHAUDE"
  | "BATTERIE_FROIDE"
  | "RECUPERATEUR_CHALEUR"
  // Climatisation
  | "GROUPE_FROID"
  | "CLIMATISATION"
  | "CLIMATISEUR"
  | "SPLIT"
  | "MULTI_SPLIT"
  | "CASSETTE"
  | "GAINABLE"
  | "ROOFTOP"
  // Traitement eau
  | "ADOUCISSEUR"
  | "DISCONNECTEUR"
  | "FILTRE"
  | "POT_BOUE"
  | "DEGAZEUR"
  | "DOSEUR"
  // Plomberie
  | "COMPTEUR_EAU"
  | "VANNE_GENERALE"
  | "SURPRESSEUR"
  | "BACHE_EAU"
  | "REDUCTION_PRESSION"
  // CFO/CFA
  | "ARMOIRE_ELECTRIQUE"
  | "ARMOIRE_TGBT"
  | "ARMOIRE_TD"
  | "ONDULEUR"
  | "GROUPE_ELECTROGENE"
  | "TRANSFORMATEUR"
  | "BAIE_INFORMATIQUE"
  // Comptage
  | "COMPTEUR_ENERGIE"
  | "COMPTEUR_CALORIES"
  | "COMPTEUR_FRIGORIES"
  | "COMPTEUR_ECS"
  | "COMPTEUR_GAZ"
  | "COMPTEUR_ELECTRIQUE"
  | "SOUS_COMPTEUR_ELEC"
  | "COMPTEUR_HORAIRE"
  | "ANALYSEUR_RESEAU"
  | "SONDE_TEMPERATURE_AMB"
  | "SONDE_HYGROMETRIE"
  | "CAPTEUR_CO2"
  | "CAPTEUR_QUALITE_AIR"
  // Autre
  | "AUTRE";

type EquipmentStatus = "OPERATIONNEL" | "MAINTENANCE" | "PANNE" | "HORS_SERVICE";

type AuditRating = "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT";

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  _count?: { contractSites: number };
}

interface Equipment {
  id: string;
  name: string | null;
  domain: EquipmentDomain;
  type: EquipmentType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  year: number | null;
  power: number | null;
  quantity: number | null;
  location: string | null;
  level: string | null;
  theoreticalLifespan: number | null;
  status: EquipmentStatus;
  installDate: string | null;
  site: { id: string; name: string; city: string };
  audits: Audit[];
  _count?: { audits: number };
}

interface Audit {
  id: string;
  auditDate: string;
  auditor: string | null;
  visualState: AuditRating;
  performance: AuditRating;
  security: AuditRating;
  accessibility: AuditRating;
  compliance: AuditRating;
  generalNotes: string | null;
}

interface AnalyticsData {
  summary: {
    totalEquipments: number;
    totalBoilers: number;
    totalPower: number;
    weightedAverageAge: number | null;
    overdueCount: number;
    nearEndCount: number;
    unknownYearCount: number;
    contractStartYear: number | null;
    contractEndYear: number | null;
  };
  equipments: Array<Equipment & {
    age: number | null;
    remainingYears: number | null;
    renewalYear: number | null;
    isOverdue: boolean;
    isNearEnd: boolean;
  }>;
  renewalPlan: Array<{
    year: number;
    count: number;
    totalPower: number;
    equipments: Array<Equipment & { age: number | null }>;
  }>;
  unknownYearEquipments: Array<Equipment & { age: number | null }>;
  riskMatrix: {
    critical: Array<Equipment & { age: number | null }>;
    high: Array<Equipment & { age: number | null }>;
    medium: Array<Equipment & { age: number | null }>;
    low: Array<Equipment & { age: number | null }>;
  };
  recommendations: string[];
}

const domainLabels: Record<EquipmentDomain, string> = {
  CHAUFFAGE: "Chauffage",
  ECS: "ECS",
  VENTILATION: "Ventilation",
  CLIMATISATION: "Climatisation",
  TRAITEMENT_EAU: "Traitement d'eau",
  PLOMBERIE: "Plomberie",
  CFO_CFA: "CFO/CFA",
  COMPTAGE: "Comptage",
  AUTRE: "Autre",
};

const equipmentTypeLabels: Record<EquipmentType, string> = {
  // Chauffage
  CHAUDIERE: "Chaudière",
  CHAUDIERE_CONDENSATION: "Chaudière condensation",
  PAC: "Pompe à chaleur",
  PAC_AIR_EAU: "PAC air/eau",
  PAC_EAU_EAU: "PAC eau/eau",
  PAC_AIR_AIR: "PAC air/air",
  RADIATEUR: "Radiateur",
  PLANCHER_CHAUFFANT: "Plancher chauffant",
  CONVECTEUR: "Convecteur",
  AEROTERME: "Aérotherme",
  RADIANT_GAZ: "Radiant gaz",
  VANNE_3_VOIES: "Vanne 3 voies",
  VANNE_MOTORISEE: "Vanne motorisée",
  POMPE_CHAUFFAGE: "Pompe chauffage",
  CIRCULATEUR: "Circulateur",
  VASE_EXPANSION: "Vase d'expansion",
  ECHANGEUR_THERMIQUE: "Échangeur thermique",
  BRULEUR: "Brûleur",
  REGULATEUR: "Régulateur",
  SONDE_TEMPERATURE: "Sonde température",
  SONDE_EXTERIEURE: "Sonde extérieure",
  // ECS
  BALLON_ECS: "Ballon ECS",
  BALLON_THERMODYNAMIQUE: "Ballon thermodynamique",
  PREPARATEUR_ECS_GAZ: "Préparateur ECS gaz",
  ECHANGEUR_ECS: "Échangeur ECS",
  POMPE_BOUCLAGE: "Pompe de bouclage",
  MITIGEUR_THERMOSTATIQUE: "Mitigeur thermostatique",
  RESISTANCE_ELECTRIQUE: "Résistance électrique",
  // Ventilation
  VMC: "VMC",
  VMC_SIMPLE_FLUX: "VMC simple flux",
  VMC_DOUBLE_FLUX: "VMC double flux",
  CTA: "CTA",
  CAISSON_EXTRACTION: "Caisson d'extraction",
  CAISSON_SOUFFLAGE: "Caisson de soufflage",
  VENTILATEUR: "Ventilateur",
  REGISTRE: "Registre",
  BATTERIE_CHAUDE: "Batterie chaude",
  BATTERIE_FROIDE: "Batterie froide",
  RECUPERATEUR_CHALEUR: "Récupérateur de chaleur",
  // Climatisation
  GROUPE_FROID: "Groupe froid",
  CLIMATISATION: "Climatisation",
  CLIMATISEUR: "Climatiseur",
  SPLIT: "Split",
  MULTI_SPLIT: "Multi-split",
  CASSETTE: "Cassette",
  GAINABLE: "Gainable",
  ROOFTOP: "Rooftop",
  // Traitement eau
  ADOUCISSEUR: "Adoucisseur",
  DISCONNECTEUR: "Disconnecteur",
  FILTRE: "Filtre",
  POT_BOUE: "Pot à boue",
  DEGAZEUR: "Dégazeur",
  DOSEUR: "Doseur",
  // Plomberie
  COMPTEUR_EAU: "Compteur d'eau",
  VANNE_GENERALE: "Vanne générale",
  SURPRESSEUR: "Surpresseur",
  BACHE_EAU: "Bâche à eau",
  REDUCTION_PRESSION: "Réducteur de pression",
  // CFO/CFA
  ARMOIRE_ELECTRIQUE: "Armoire électrique",
  ARMOIRE_TGBT: "TGBT",
  ARMOIRE_TD: "Tableau divisionnaire",
  ONDULEUR: "Onduleur",
  GROUPE_ELECTROGENE: "Groupe électrogène",
  TRANSFORMATEUR: "Transformateur",
  BAIE_INFORMATIQUE: "Baie informatique",
  // Comptage
  COMPTEUR_ENERGIE: "Compteur d'énergie",
  COMPTEUR_CALORIES: "Compteur de calories",
  COMPTEUR_FRIGORIES: "Compteur de frigories",
  COMPTEUR_ECS: "Compteur ECS",
  COMPTEUR_GAZ: "Compteur gaz",
  COMPTEUR_ELECTRIQUE: "Compteur électrique",
  SOUS_COMPTEUR_ELEC: "Sous-compteur électrique",
  COMPTEUR_HORAIRE: "Compteur horaire",
  ANALYSEUR_RESEAU: "Analyseur réseau",
  SONDE_TEMPERATURE_AMB: "Sonde température ambiante",
  SONDE_HYGROMETRIE: "Sonde hygrométrie",
  CAPTEUR_CO2: "Capteur CO2",
  CAPTEUR_QUALITE_AIR: "Capteur qualité d'air",
  // Autre
  AUTRE: "Autre équipement",
};

// Group equipment types by domain
const typesByDomain: Record<EquipmentDomain, EquipmentType[]> = {
  CHAUFFAGE: [
    "CHAUDIERE", "CHAUDIERE_CONDENSATION", "PAC", "PAC_AIR_EAU", "PAC_EAU_EAU", "PAC_AIR_AIR",
    "RADIATEUR", "PLANCHER_CHAUFFANT", "CONVECTEUR", "AEROTERME", "RADIANT_GAZ",
    "VANNE_3_VOIES", "VANNE_MOTORISEE", "POMPE_CHAUFFAGE", "CIRCULATEUR",
    "VASE_EXPANSION", "ECHANGEUR_THERMIQUE", "BRULEUR", "REGULATEUR",
    "SONDE_TEMPERATURE", "SONDE_EXTERIEURE",
  ],
  ECS: [
    "BALLON_ECS", "BALLON_THERMODYNAMIQUE", "PREPARATEUR_ECS_GAZ", "ECHANGEUR_ECS",
    "POMPE_BOUCLAGE", "MITIGEUR_THERMOSTATIQUE", "RESISTANCE_ELECTRIQUE",
  ],
  VENTILATION: [
    "VMC", "VMC_SIMPLE_FLUX", "VMC_DOUBLE_FLUX", "CTA",
    "CAISSON_EXTRACTION", "CAISSON_SOUFFLAGE", "VENTILATEUR", "REGISTRE",
    "BATTERIE_CHAUDE", "BATTERIE_FROIDE", "RECUPERATEUR_CHALEUR",
  ],
  CLIMATISATION: [
    "GROUPE_FROID", "CLIMATISATION", "CLIMATISEUR", "SPLIT",
    "MULTI_SPLIT", "CASSETTE", "GAINABLE", "ROOFTOP",
  ],
  TRAITEMENT_EAU: [
    "ADOUCISSEUR", "DISCONNECTEUR", "FILTRE", "POT_BOUE", "DEGAZEUR", "DOSEUR",
  ],
  PLOMBERIE: [
    "COMPTEUR_EAU", "VANNE_GENERALE", "SURPRESSEUR", "BACHE_EAU", "REDUCTION_PRESSION",
  ],
  CFO_CFA: [
    "ARMOIRE_ELECTRIQUE", "ARMOIRE_TGBT", "ARMOIRE_TD", "ONDULEUR",
    "GROUPE_ELECTROGENE", "TRANSFORMATEUR", "BAIE_INFORMATIQUE",
  ],
  COMPTAGE: [
    "COMPTEUR_ENERGIE", "COMPTEUR_CALORIES", "COMPTEUR_FRIGORIES", "COMPTEUR_ECS",
    "COMPTEUR_GAZ", "COMPTEUR_ELECTRIQUE", "SOUS_COMPTEUR_ELEC", "COMPTEUR_HORAIRE",
    "ANALYSEUR_RESEAU", "SONDE_TEMPERATURE_AMB", "SONDE_HYGROMETRIE",
    "CAPTEUR_CO2", "CAPTEUR_QUALITE_AIR",
  ],
  AUTRE: ["AUTRE"],
};

const statusLabels: Record<EquipmentStatus, string> = {
  OPERATIONNEL: "Opérationnel",
  MAINTENANCE: "En maintenance",
  PANNE: "En panne",
  HORS_SERVICE: "Hors service",
};

const statusColors: Record<EquipmentStatus, string> = {
  OPERATIONNEL: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-yellow-100 text-yellow-700",
  PANNE: "bg-red-100 text-red-700",
  HORS_SERVICE: "bg-gray-100 text-gray-700",
};

const ratingLabels: Record<AuditRating, string> = {
  NON_EVALUE: "Non évalué",
  CRITIQUE: "Critique",
  MAUVAIS: "Mauvais",
  MOYEN: "Moyen",
  BON: "Bon",
  EXCELLENT: "Excellent",
};

const ratingColors: Record<AuditRating, string> = {
  NON_EVALUE: "bg-gray-100 text-gray-600",
  CRITIQUE: "bg-red-100 text-red-700",
  MAUVAIS: "bg-orange-100 text-orange-700",
  MOYEN: "bg-yellow-100 text-yellow-700",
  BON: "bg-green-100 text-green-700",
  EXCELLENT: "bg-emerald-100 text-emerald-700",
};

type ViewType = "list" | "audit" | "renewal" | "risk";

export default function EquipmentsPage() {
  // Contract selection state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // Equipment state
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<EquipmentDomain | "">("");
  const [activeView, setActiveView] = useState<ViewType>("list");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);

  // Import modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "result">("upload");
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      type?: string;
      typeParsed?: string;
      domain?: string;
      site?: string;
      siteId?: string;
      name?: string;
      brand?: string;
      model?: string;
      year?: number;
      power?: number;
      quantity?: number;
      message?: string;
    }>;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    errors: number;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    domain: "CHAUFFAGE" as EquipmentDomain,
    type: "CHAUDIERE" as EquipmentType,
    brand: "",
    model: "",
    serialNumber: "",
    year: "",
    power: "",
    quantity: "",
    location: "",
    level: "",
    theoreticalLifespan: "",
    siteId: "",
  });

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    domain: "CHAUFFAGE" as EquipmentDomain,
    type: "CHAUDIERE" as EquipmentType,
    brand: "",
    model: "",
    serialNumber: "",
    year: "",
    power: "",
    quantity: "",
    location: "",
    level: "",
    theoreticalLifespan: "",
    status: "OPERATIONNEL" as EquipmentStatus,
  });

  // Expanded rows for renewal plan
  const [expandedYears, setExpandedYears] = useState<number[]>([]);

  // Expanded sites for list view
  const [expandedSites, setExpandedSites] = useState<string[]>([]);

  // Audit modal states
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditingEquipment, setAuditingEquipment] = useState<Equipment | null>(null);
  const [savingAudit, setSavingAudit] = useState(false);
  const [auditFormData, setAuditFormData] = useState({
    auditDate: new Date().toISOString().split("T")[0],
    auditor: "",
    visualState: "NON_EVALUE" as AuditRating,
    performance: "NON_EVALUE" as AuditRating,
    security: "NON_EVALUE" as AuditRating,
    accessibility: "NON_EVALUE" as AuditRating,
    compliance: "NON_EVALUE" as AuditRating,
    generalNotes: "",
  });

  // Import audit modal states
  const [showImportAuditModal, setShowImportAuditModal] = useState(false);
  const [importingAudit, setImportingAudit] = useState(false);
  const [importAuditFile, setImportAuditFile] = useState<File | null>(null);
  const [importAuditStep, setImportAuditStep] = useState<"upload" | "preview" | "result">("upload");
  const [importAuditPreview, setImportAuditPreview] = useState<{
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      equipmentId?: string;
      equipmentName?: string;
      site?: string;
      auditDate?: string;
      message?: string;
    }>;
  } | null>(null);
  const [importAuditResult, setImportAuditResult] = useState<{
    total: number;
    created: number;
    errors: number;
  } | null>(null);

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await fetch("/api/contracts");
      if (!response.ok) throw new Error("Erreur lors du chargement des contrats");
      const data = await response.json();
      setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingContracts(false);
    }
  };

  // Fetch equipments and analytics for selected contract
  const fetchEquipmentsForContract = async (contractId: string) => {
    try {
      setLoadingEquipments(true);
      const [eqResponse, analyticsResponse, sitesResponse] = await Promise.all([
        fetch(`/api/equipments?contractId=${contractId}`),
        fetch(`/api/equipments/analytics?contractId=${contractId}`),
        fetch(`/api/contracts/${contractId}/sites`),
      ]);

      if (!eqResponse.ok) throw new Error("Erreur lors du chargement des équipements");
      if (!analyticsResponse.ok) throw new Error("Erreur lors du chargement des analytics");

      const eqData = await eqResponse.json();
      const analyticsData = await analyticsResponse.json();
      const sitesData = await sitesResponse.json();

      setEquipments(eqData);
      setAnalytics(analyticsData);
      setSites(sitesData.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingEquipments(false);
    }
  };

  const handleSelectContract = (contract: Contract) => {
    setSelectedContract(contract);
    setSearchQuery("");
    fetchEquipmentsForContract(contract.id);
  };

  const handleBackToContracts = () => {
    setSelectedContract(null);
    setEquipments([]);
    setAnalytics(null);
    setSearchQuery("");
    setDomainFilter("");
    setActiveView("list");
  };

  const filteredEquipments = useMemo(() => {
    let filtered = equipments;

    // Filter by domain
    if (domainFilter) {
      filtered = filtered.filter((eq) => eq.domain === domainFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (eq) =>
          (eq.name?.toLowerCase().includes(query) || false) ||
          equipmentTypeLabels[eq.type]?.toLowerCase().includes(query) ||
          eq.brand?.toLowerCase().includes(query) ||
          eq.site.name.toLowerCase().includes(query) ||
          eq.serialNumber?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [equipments, searchQuery, domainFilter]);

  const stats = useMemo(() => {
    if (!analytics) return null;
    return analytics.summary;
  }, [analytics]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) return;
    setCreating(true);
    try {
      const response = await fetch("/api/equipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      await fetchEquipmentsForContract(selectedContract.id);
      setShowModal(false);
      setFormData({
        name: "",
        domain: "CHAUFFAGE",
        type: "CHAUDIERE",
        brand: "",
        model: "",
        serialNumber: "",
        year: "",
        power: "",
        quantity: "",
        location: "",
        level: "",
        theoreticalLifespan: "",
        siteId: "",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const toggleYearExpand = (year: number) => {
    setExpandedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const toggleSiteExpand = (siteId: string) => {
    setExpandedSites((prev) =>
      prev.includes(siteId) ? prev.filter((s) => s !== siteId) : [...prev, siteId]
    );
  };

  // Open edit modal
  const handleEditEquipment = (eq: Equipment) => {
    setEditingEquipment(eq);
    setEditFormData({
      name: eq.name || "",
      domain: eq.domain,
      type: eq.type,
      brand: eq.brand || "",
      model: eq.model || "",
      serialNumber: eq.serialNumber || "",
      year: eq.year?.toString() || "",
      power: eq.power?.toString() || "",
      quantity: eq.quantity?.toString() || "",
      location: eq.location || "",
      level: eq.level || "",
      theoreticalLifespan: eq.theoreticalLifespan?.toString() || "",
      status: eq.status,
    });
    setShowEditModal(true);
  };

  // Save equipment edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquipment || !selectedContract) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/equipments/${editingEquipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      await fetchEquipmentsForContract(selectedContract.id);
      setShowEditModal(false);
      setEditingEquipment(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  // Open audit modal
  const handleAuditEquipment = (eq: Equipment) => {
    setAuditingEquipment(eq);
    setAuditFormData({
      auditDate: new Date().toISOString().split("T")[0],
      auditor: "",
      visualState: "NON_EVALUE",
      performance: "NON_EVALUE",
      security: "NON_EVALUE",
      accessibility: "NON_EVALUE",
      compliance: "NON_EVALUE",
      generalNotes: "",
    });
    setShowAuditModal(true);
  };

  // Save audit
  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditingEquipment || !selectedContract) return;
    setSavingAudit(true);
    try {
      const response = await fetch(`/api/equipments/${auditingEquipment.id}/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditFormData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création de l'audit");
      }

      await fetchEquipmentsForContract(selectedContract.id);
      setShowAuditModal(false);
      setAuditingEquipment(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingAudit(false);
    }
  };

  // Import audit handlers
  const resetImportAuditModal = () => {
    setShowImportAuditModal(false);
    setImportAuditFile(null);
    setImportAuditStep("upload");
    setImportAuditPreview(null);
    setImportAuditResult(null);
    setImportingAudit(false);
  };

  const handleImportAuditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportAuditFile(file);
    }
  };

  const parseAuditCSV = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(";").map((v) => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });

      rows.push(row);
    }

    return rows;
  };

  const handleImportAuditPreview = async () => {
    if (!importAuditFile || !selectedContract) return;

    setImportingAudit(true);
    try {
      const text = await importAuditFile.text();
      const rows = parseAuditCSV(text);

      const response = await fetch("/api/equipments/audits/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          contractId: selectedContract.id,
          preview: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      const data = await response.json();
      setImportAuditPreview(data);
      setImportAuditStep("preview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setImportingAudit(false);
    }
  };

  const handleImportAuditConfirm = async () => {
    if (!importAuditFile || !selectedContract) return;

    setImportingAudit(true);
    try {
      const text = await importAuditFile.text();
      const rows = parseAuditCSV(text);

      const response = await fetch("/api/equipments/audits/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          contractId: selectedContract.id,
          preview: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'import");
      }

      const data = await response.json();
      setImportAuditResult({
        total: data.total,
        created: data.created,
        errors: data.errors,
      });
      setImportAuditStep("result");

      // Refresh data
      await fetchEquipmentsForContract(selectedContract.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setImportingAudit(false);
    }
  };

  const downloadAuditTemplate = () => {
    const headers = ["site", "type", "marque", "modele", "numero_serie", "date_audit", "auditeur", "etat_visuel", "performance", "securite", "accessibilite", "conformite", "notes"];
    const example = ["École Jean Jaurès", "CHAUDIERE", "De Dietrich", "DTG 130", "12345", "2024-01-15", "J. Dupont", "BON", "BON", "MOYEN", "BON", "BON", "RAS"];
    const csv = [headers.join(";"), example.join(";")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import_audits.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group equipments by site
  const equipmentsBySite = useMemo(() => {
    const grouped: Record<string, { site: { id: string; name: string; city: string }; equipments: Equipment[] }> = {};

    for (const eq of filteredEquipments) {
      if (!grouped[eq.site.id]) {
        grouped[eq.site.id] = {
          site: eq.site,
          equipments: [],
        };
      }
      grouped[eq.site.id].equipments.push(eq);
    }

    // Sort by site name
    return Object.values(grouped).sort((a, b) => a.site.name.localeCompare(b.site.name));
  }, [filteredEquipments]);

  // Parse CSV content
  const parseCSV = (content: string): Record<string, string>[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Parse header
    const header = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(";").map((v) => v.trim().replace(/['"]/g, ""));
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      rows.push(row);
    }

    return rows;
  };

  // Handle file upload for import
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
  };

  // Parse and preview import
  const handleImportPreview = async () => {
    if (!importFile || !selectedContract) return;
    setImporting(true);

    try {
      const content = await importFile.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        alert("Fichier vide ou format invalide");
        setImporting(false);
        return;
      }

      const response = await fetch("/api/equipments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          contractId: selectedContract.id,
          preview: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      const data = await response.json();
      setImportPreview(data);
      setImportStep("preview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setImporting(false);
    }
  };

  // Confirm and execute import
  const handleImportConfirm = async () => {
    if (!importFile || !selectedContract) return;
    setImporting(true);

    try {
      const content = await importFile.text();
      const rows = parseCSV(content);

      const response = await fetch("/api/equipments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          contractId: selectedContract.id,
          preview: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'import");
      }

      const data = await response.json();
      setImportResult({
        total: data.total,
        created: data.created,
        errors: data.errors,
      });
      setImportStep("result");

      // Refresh equipments
      await fetchEquipmentsForContract(selectedContract.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setImporting(false);
    }
  };

  // Reset import modal
  const resetImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportStep("upload");
    setImportPreview(null);
    setImportResult(null);
  };

  // Download template
  const downloadTemplate = () => {
    const template = `site;type;marque;modele;annee;puissance;quantite;local;niveau
Lycée Victor Hugo;Chaudière condensation;De Dietrich;GT 220;2015;300;;Chaufferie;Sous-sol
Lycée Victor Hugo;Circulateur;Grundfos;Magna3;2018;1.5;;Chaufferie;Sous-sol
Lycée Victor Hugo;Radiateur;;;;2;15;Salle 101;RDC
Collège Jean Moulin;PAC air/eau;Daikin;Altherma;2020;50;;Local technique;Toiture
Collège Jean Moulin;VMC double flux;Atlantic;Duolix;2019;2;;Combles;R+2`;

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_equipements.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // RENDER: CONTRACT SELECTION VIEW
  // ============================================
  if (!selectedContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Équipements</h1>
          <p className="text-text-secondary">Sélectionnez un contrat pour voir ses équipements</p>
        </div>

        {loadingContracts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        ) : contracts.length === 0 ? (
          <ChartCard title="Aucun contrat actif">
            <div className="flex flex-col items-center justify-center py-8">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary mb-4">Créez d&apos;abord un contrat</p>
              <Link href="/contracts">
                <Button>
                  <Plus size={18} className="mr-2" />
                  Créer un contrat
                </Button>
              </Link>
            </div>
          </ChartCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => handleSelectContract(contract)}
                className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <FileText size={24} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Actif
                  </span>
                </div>
                <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {contract.provider}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {contract._count?.contractSites || 0} sites
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: EQUIPMENTS VIEW (Contract Selected)
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={handleBackToContracts} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-text-secondary" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.reference}</h1>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Actif</span>
            </div>
            <p className="text-text-secondary">Équipements — {selectedContract.provider}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload size={18} className="mr-2" />
            Importer
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Équipements" value={stats.totalEquipments.toString()} icon={Wrench} iconColor="text-accent" />
          <StatsCard title="Chaudières" value={stats.totalBoilers.toString()} icon={Flame} iconColor="text-orange-600" />
          <StatsCard
            title="Puissance totale"
            value={stats.totalPower > 0 ? `${stats.totalPower.toLocaleString()} kW` : "-"}
            icon={Wrench}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="À remplacer"
            value={`${stats.overdueCount} (${stats.nearEndCount} à surveiller)`}
            icon={AlertTriangle}
            iconColor="text-red-600"
          />
        </div>
      )}

      {/* View Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-gray-100 rounded-lg p-1 overflow-x-auto">
          <button
            onClick={() => setActiveView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === "list" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <List size={16} />
            Liste
          </button>
          <button
            onClick={() => setActiveView("audit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === "audit" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <ClipboardCheck size={16} />
            Audits
          </button>
          <button
            onClick={() => setActiveView("renewal")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === "renewal" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <Calendar size={16} />
            Renouvellement
          </button>
          <button
            onClick={() => setActiveView("risk")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === "risk" ? "bg-white text-primary-dark shadow-sm" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            <AlertTriangle size={16} />
            Risques
          </button>
        </div>

        {activeView === "audit" && (
          <Button variant="outline" onClick={() => setShowImportAuditModal(true)}>
            <Upload size={16} className="mr-2" />
            Importer audits
          </Button>
        )}

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as EquipmentDomain | "")}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
        >
          <option value="">Tous les domaines</option>
          {Object.entries(domainLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un équipement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {loadingEquipments ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      ) : (
        <>
          {/* LIST VIEW - Grouped by Site */}
          {activeView === "list" && (
            <div className="space-y-4">
              {filteredEquipments.length === 0 ? (
                <ChartCard title="Aucun équipement">
                  <div className="flex flex-col items-center justify-center py-8">
                    <Wrench size={48} className="text-gray-300 mb-4" />
                    <p className="text-text-secondary mb-4">Aucun équipement trouvé</p>
                    <Button onClick={() => setShowModal(true)}>
                      <Plus size={18} className="mr-2" />
                      Ajouter un équipement
                    </Button>
                  </div>
                </ChartCard>
              ) : (
                <>
                  <div className="text-sm text-text-secondary">
                    {filteredEquipments.length} équipement{filteredEquipments.length > 1 ? "s" : ""} sur {equipmentsBySite.length} site{equipmentsBySite.length > 1 ? "s" : ""}
                  </div>
                  {equipmentsBySite.map(({ site, equipments: siteEquipments }) => (
                    <div key={site.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      {/* Site Header - Collapsible */}
                      <button
                        onClick={() => toggleSiteExpand(site.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                            <Building2 size={20} className="text-accent" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-primary-dark">{site.name}</h3>
                            <p className="text-sm text-text-secondary">
                              {site.city} • {siteEquipments.length} équipement{siteEquipments.length > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        {expandedSites.includes(site.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>

                      {/* Equipments Table - Expanded */}
                      {expandedSites.includes(site.id) && (
                        <div className="border-t border-gray-100 overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-background-secondary border-b border-gray-100">
                              <tr>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Équipement</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Localisation</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Puissance</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Année</th>
                                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Statut</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {siteEquipments.map((eq) => (
                                <tr
                                  key={eq.id}
                                  onClick={() => handleEditEquipment(eq)}
                                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <Flame size={18} className="text-orange-600" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-primary-dark">{eq.name || equipmentTypeLabels[eq.type]}</p>
                                        <p className="text-sm text-text-secondary">
                                          {domainLabels[eq.domain]} • {equipmentTypeLabels[eq.type]} {eq.brand && `• ${eq.brand}`}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">
                                    {eq.location || eq.level ? `${eq.location || ""}${eq.level ? ` (${eq.level})` : ""}` : "-"}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">{eq.power ? `${eq.power} kW` : "-"}</td>
                                  <td className="px-6 py-4 text-sm text-text-secondary">{eq.year || "-"}</td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[eq.status]}`}>
                                      {statusLabels[eq.status]}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* AUDIT VIEW */}
          {activeView === "audit" && (
            <div className="space-y-4">
              {filteredEquipments.length === 0 ? (
                <ChartCard title="Aucun équipement">
                  <p className="text-text-secondary text-center py-8">Aucun équipement à auditer</p>
                </ChartCard>
              ) : (
                filteredEquipments.map((eq) => {
                  const latestAudit = eq.audits?.[0];
                  return (
                    <ChartCard key={eq.id} title={eq.name || equipmentTypeLabels[eq.type]} subtitle={`${domainLabels[eq.domain]} • ${equipmentTypeLabels[eq.type]} • ${eq.site.name}`}>
                      {latestAudit ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">
                              Dernier audit: {new Date(latestAudit.auditDate).toLocaleDateString("fr-FR")}
                              {latestAudit.auditor && ` par ${latestAudit.auditor}`}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAuditEquipment(eq)}
                            >
                              <ClipboardCheck size={14} className="mr-1" />
                              Nouvel audit
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="text-center">
                              <p className="text-xs text-text-secondary mb-1">État visuel</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${ratingColors[latestAudit.visualState]}`}>
                                {ratingLabels[latestAudit.visualState]}
                              </span>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-text-secondary mb-1">Performance</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${ratingColors[latestAudit.performance]}`}>
                                {ratingLabels[latestAudit.performance]}
                              </span>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-text-secondary mb-1">Sécurité</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${ratingColors[latestAudit.security]}`}>
                                {ratingLabels[latestAudit.security]}
                              </span>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-text-secondary mb-1">Accessibilité</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${ratingColors[latestAudit.accessibility]}`}>
                                {ratingLabels[latestAudit.accessibility]}
                              </span>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-text-secondary mb-1">Conformité</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${ratingColors[latestAudit.compliance]}`}>
                                {ratingLabels[latestAudit.compliance]}
                              </span>
                            </div>
                          </div>
                          {latestAudit.generalNotes && (
                            <p className="text-sm text-text-secondary italic">{latestAudit.generalNotes}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-text-secondary mb-3">Aucun audit réalisé</p>
                          <Button
                            size="sm"
                            onClick={() => handleAuditEquipment(eq)}
                          >
                            <ClipboardCheck size={14} className="mr-1" />
                            Réaliser un audit
                          </Button>
                        </div>
                      )}
                    </ChartCard>
                  );
                })
              )}
            </div>
          )}

          {/* RENEWAL VIEW */}
          {activeView === "renewal" && analytics && (
            <div className="space-y-4">
              {/* Contract duration info */}
              {analytics.summary.contractStartYear && analytics.summary.contractEndYear && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-text-secondary">
                    Plan de renouvellement limité à la durée du contrat: <strong>{analytics.summary.contractStartYear} - {analytics.summary.contractEndYear}</strong>
                  </p>
                </div>
              )}


              <ChartCard
                title="Plan de renouvellement"
                subtitle={analytics.summary.contractEndYear
                  ? `Équipements à remplacer d'ici ${analytics.summary.contractEndYear}`
                  : "Équipements à remplacer par année"}
              >
                {analytics.renewalPlan.length === 0 && analytics.unknownYearEquipments.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Aucun remplacement prévu (données d&apos;année manquantes)</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.renewalPlan.map((plan) => (
                      <div key={plan.year} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleYearExpand(plan.year)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-primary-dark">{plan.year}</span>
                            <span className="text-sm text-text-secondary">
                              {plan.count} équipement{plan.count > 1 ? "s" : ""} • {plan.totalPower.toLocaleString()} kW
                            </span>
                          </div>
                          {expandedYears.includes(plan.year) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {expandedYears.includes(plan.year) && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-text-secondary">
                                  <th className="pb-2">Équipement</th>
                                  <th className="pb-2">Site</th>
                                  <th className="pb-2">Âge</th>
                                  <th className="pb-2">Puissance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {plan.equipments.map((eq) => (
                                  <tr key={eq.id}>
                                    <td className="py-1">{eq.name || equipmentTypeLabels[eq.type]}</td>
                                    <td className="py-1 text-text-secondary">{eq.site.name}</td>
                                    <td className="py-1">{eq.age} ans</td>
                                    <td className="py-1">{eq.power ? `${eq.power} kW` : "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Equipment without year data */}
              {analytics.unknownYearEquipments.length > 0 && (
                <ChartCard
                  title="Équipements sans date connue"
                  subtitle={`${analytics.unknownYearEquipments.length} équipement(s) sans année de fabrication`}
                >
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-700">
                      Ces équipements n&apos;ont pas d&apos;année renseignée. Complétez les données pour les intégrer au plan de renouvellement.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary border-b border-gray-200">
                          <th className="pb-2 pr-4">Équipement</th>
                          <th className="pb-2 pr-4">Site</th>
                          <th className="pb-2 pr-4">Marque</th>
                          <th className="pb-2">Puissance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {analytics.unknownYearEquipments.map((eq) => (
                          <tr key={eq.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-4">
                              <span className="font-medium">{eq.name || equipmentTypeLabels[eq.type]}</span>
                              <span className="text-text-secondary ml-2 text-xs">({domainLabels[eq.domain]})</span>
                            </td>
                            <td className="py-2 pr-4 text-text-secondary">{eq.site.name}</td>
                            <td className="py-2 pr-4 text-text-secondary">{eq.brand || "-"}</td>
                            <td className="py-2">{eq.power ? `${eq.power} kW` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}
            </div>
          )}

          {/* RISK VIEW */}
          {activeView === "risk" && analytics && (
            <div className="space-y-4">
              {/* Recommendations for boiler risk matrix */}
              {analytics.recommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">Recommandations</h3>
                  <ul className="space-y-1">
                    {analytics.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-blue-700">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Critical */}
                <ChartCard title="Critique" subtitle="≥ 20 ans">
                  <div className="space-y-2">
                    {analytics.riskMatrix.critical.length === 0 ? (
                      <p className="text-text-secondary text-sm">Aucune chaudière</p>
                    ) : (
                      analytics.riskMatrix.critical.map((eq) => (
                        <div key={eq.id} className="p-2 bg-red-50 rounded text-sm">
                          <p className="font-medium text-red-800">{eq.name || equipmentTypeLabels[eq.type]}</p>
                          <p className="text-red-600">{eq.site.name} • {eq.age} ans</p>
                        </div>
                      ))
                    )}
                  </div>
                </ChartCard>

                {/* High */}
                <ChartCard title="Élevé" subtitle="17-19 ans">
                  <div className="space-y-2">
                    {analytics.riskMatrix.high.length === 0 ? (
                      <p className="text-text-secondary text-sm">Aucune chaudière</p>
                    ) : (
                      analytics.riskMatrix.high.map((eq) => (
                        <div key={eq.id} className="p-2 bg-orange-50 rounded text-sm">
                          <p className="font-medium text-orange-800">{eq.name || equipmentTypeLabels[eq.type]}</p>
                          <p className="text-orange-600">{eq.site.name} • {eq.age} ans</p>
                        </div>
                      ))
                    )}
                  </div>
                </ChartCard>

                {/* Medium */}
                <ChartCard title="Moyen" subtitle="10-16 ans">
                  <div className="space-y-2">
                    {analytics.riskMatrix.medium.length === 0 ? (
                      <p className="text-text-secondary text-sm">Aucune chaudière</p>
                    ) : (
                      analytics.riskMatrix.medium.map((eq) => (
                        <div key={eq.id} className="p-2 bg-yellow-50 rounded text-sm">
                          <p className="font-medium text-yellow-800">{eq.name || equipmentTypeLabels[eq.type]}</p>
                          <p className="text-yellow-600">{eq.site.name} • {eq.age} ans</p>
                        </div>
                      ))
                    )}
                  </div>
                </ChartCard>

                {/* Low */}
                <ChartCard title="Faible" subtitle="< 10 ans">
                  <div className="space-y-2">
                    {analytics.riskMatrix.low.length === 0 ? (
                      <p className="text-text-secondary text-sm">Aucune chaudière</p>
                    ) : (
                      analytics.riskMatrix.low.map((eq) => (
                        <div key={eq.id} className="p-2 bg-green-50 rounded text-sm">
                          <p className="font-medium text-green-800">{eq.name || equipmentTypeLabels[eq.type]}</p>
                          <p className="text-green-600">{eq.site.name} • {eq.age} ans</p>
                        </div>
                      ))
                    )}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouvel équipement</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Site *</label>
                <select
                  required
                  value={formData.siteId}
                  onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Domaine *</label>
                  <select
                    required
                    value={formData.domain}
                    onChange={(e) => {
                      const newDomain = e.target.value as EquipmentDomain;
                      const firstType = typesByDomain[newDomain][0];
                      setFormData({ ...formData, domain: newDomain, type: firstType });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(domainLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as EquipmentType })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {typesByDomain[formData.domain].map((type) => (
                      <option key={type} value={type}>{equipmentTypeLabels[type]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Nom (optionnel)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Auto-généré depuis le type si vide"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Marque</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="De Dietrich"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Modèle</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="GT 220"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">N° de série</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="ABC123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Année</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="2010"
                    min="1950"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Puissance (kW)</label>
                  <input
                    type="number"
                    value={formData.power}
                    onChange={(e) => setFormData({ ...formData, power: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Quantité</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Local</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Chaufferie"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Niveau</label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Sous-sol, RDC, Toiture..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer"
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
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                {importStep === "upload" && "Importer des équipements"}
                {importStep === "preview" && "Vérification de l'import"}
                {importStep === "result" && "Résultat de l'import"}
              </h2>
              <button onClick={resetImportModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* Upload Step */}
              {importStep === "upload" && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-800 mb-2">Format du fichier CSV</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Le fichier doit contenir les colonnes suivantes (séparateur: point-virgule):
                    </p>
                    <div className="bg-white rounded p-3 text-xs font-mono overflow-x-auto">
                      <p><strong>site</strong> (obligatoire) — Nom du site (doit correspondre à un site du contrat)</p>
                      <p><strong>type</strong> (obligatoire) — Type d'équipement (ex: chaudière, pompe, clim, VMC...)</p>
                      <p><strong>marque</strong> — Marque (ex: De Dietrich, Daikin)</p>
                      <p><strong>modele</strong> — Modèle</p>
                      <p><strong>annee</strong> — Année de fabrication</p>
                      <p><strong>puissance</strong> — Puissance en kW</p>
                      <p><strong>quantite</strong> — Quantité (pour les émetteurs)</p>
                      <p><strong>local</strong> — Localisation (ex: Chaufferie)</p>
                      <p><strong>niveau</strong> — Niveau (ex: Sous-sol, RDC)</p>
                    </div>
                    <p className="text-sm text-blue-600 mt-3">
                      💡 Les types sont reconnus automatiquement : "pompe" → Circulateur, "clim" → Climatiseur, etc.
                    </p>
                  </div>

                  <div>
                    <Button variant="outline" onClick={downloadTemplate} className="mb-4">
                      <Download size={16} className="mr-2" />
                      Télécharger le modèle CSV
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportFileChange}
                      className="hidden"
                      id="import-file"
                    />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-sm text-text-secondary mb-2">
                        Cliquez pour sélectionner un fichier CSV
                      </p>
                      {importFile && (
                        <p className="text-sm font-medium text-accent">{importFile.name}</p>
                      )}
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetImportModal}>
                      Annuler
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleImportPreview}
                      disabled={!importFile || importing}
                    >
                      {importing ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          Analyse...
                        </>
                      ) : (
                        "Analyser le fichier"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview Step */}
              {importStep === "preview" && importPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <CheckCircle size={24} className="mx-auto text-green-600 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{importPreview.valid}</p>
                      <p className="text-sm text-green-600">Valides</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <AlertCircle size={24} className="mx-auto text-yellow-600 mb-1" />
                      <p className="text-2xl font-bold text-yellow-700">{importPreview.warnings}</p>
                      <p className="text-sm text-yellow-600">Avertissements</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <XCircle size={24} className="mx-auto text-red-600 mb-1" />
                      <p className="text-2xl font-bold text-red-700">{importPreview.errors}</p>
                      <p className="text-sm text-red-600">Erreurs</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Ligne</th>
                          <th className="text-left px-3 py-2">Site</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Reconnu</th>
                          <th className="text-left px-3 py-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.results.map((r) => (
                          <tr key={r.row} className={r.status === "error" ? "bg-red-50" : r.status === "warning" ? "bg-yellow-50" : ""}>
                            <td className="px-3 py-2">{r.row}</td>
                            <td className="px-3 py-2">{r.site || "-"}</td>
                            <td className="px-3 py-2">{r.type || "-"}</td>
                            <td className="px-3 py-2 font-medium">
                              {r.typeParsed ? equipmentTypeLabels[r.typeParsed as EquipmentType] || r.typeParsed : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {r.status === "ok" && <CheckCircle size={16} className="text-green-600" />}
                              {r.status === "warning" && (
                                <span className="flex items-center gap-1 text-yellow-600">
                                  <AlertCircle size={16} />
                                  <span className="text-xs">{r.message}</span>
                                </span>
                              )}
                              {r.status === "error" && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircle size={16} />
                                  <span className="text-xs">{r.message}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setImportStep("upload")}>
                      Retour
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleImportConfirm}
                      disabled={importing || importPreview.valid === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        `Importer ${importPreview.valid} équipement(s)`
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Result Step */}
              {importStep === "result" && importResult && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary-dark mb-2">Import terminé !</h3>
                    <p className="text-text-secondary">
                      {importResult.created} équipement(s) créé(s) sur {importResult.total} ligne(s)
                      {importResult.errors > 0 && ` (${importResult.errors} erreur(s))`}
                    </p>
                  </div>
                  <Button onClick={resetImportModal} className="w-full">
                    Fermer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Modifier l&apos;équipement</h2>
                <p className="text-sm text-text-secondary">{editingEquipment.site.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Domaine</label>
                  <select
                    value={editFormData.domain}
                    onChange={(e) => {
                      const newDomain = e.target.value as EquipmentDomain;
                      const firstType = typesByDomain[newDomain][0];
                      setEditFormData({ ...editFormData, domain: newDomain, type: firstType });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(domainLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type</label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as EquipmentType })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {typesByDomain[editFormData.domain].map((type) => (
                      <option key={type} value={type}>{equipmentTypeLabels[type]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Nom (optionnel)</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Auto-généré depuis le type si vide"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Marque</label>
                  <input
                    type="text"
                    value={editFormData.brand}
                    onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Modèle</label>
                  <input
                    type="text"
                    value={editFormData.model}
                    onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">N° de série</label>
                  <input
                    type="text"
                    value={editFormData.serialNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Année</label>
                  <input
                    type="number"
                    value={editFormData.year}
                    onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    min="1950"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Puissance (kW)</label>
                  <input
                    type="number"
                    value={editFormData.power}
                    onChange={(e) => setEditFormData({ ...editFormData, power: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Quantité</label>
                  <input
                    type="number"
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Local</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Niveau</label>
                  <input
                    type="text"
                    value={editFormData.level}
                    onChange={(e) => setEditFormData({ ...editFormData, level: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Durée de vie (ans)</label>
                  <input
                    type="number"
                    value={editFormData.theoreticalLifespan}
                    onChange={(e) => setEditFormData({ ...editFormData, theoreticalLifespan: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Statut</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as EquipmentStatus })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enregistrement...
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

      {/* Audit Modal */}
      {showAuditModal && auditingEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Nouvel audit</h2>
                <p className="text-sm text-text-secondary">
                  {auditingEquipment.name || equipmentTypeLabels[auditingEquipment.type]} — {auditingEquipment.site.name}
                </p>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAudit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date de l&apos;audit *</label>
                  <input
                    type="date"
                    required
                    value={auditFormData.auditDate}
                    onChange={(e) => setAuditFormData({ ...auditFormData, auditDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Auditeur</label>
                  <input
                    type="text"
                    value={auditFormData.auditor}
                    onChange={(e) => setAuditFormData({ ...auditFormData, auditor: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Nom de l'auditeur"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-primary-dark">Évaluations (1-5)</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">État visuel</label>
                    <select
                      value={auditFormData.visualState}
                      onChange={(e) => setAuditFormData({ ...auditFormData, visualState: e.target.value as AuditRating })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Performance</label>
                    <select
                      value={auditFormData.performance}
                      onChange={(e) => setAuditFormData({ ...auditFormData, performance: e.target.value as AuditRating })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Sécurité</label>
                    <select
                      value={auditFormData.security}
                      onChange={(e) => setAuditFormData({ ...auditFormData, security: e.target.value as AuditRating })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Accessibilité</label>
                    <select
                      value={auditFormData.accessibility}
                      onChange={(e) => setAuditFormData({ ...auditFormData, accessibility: e.target.value as AuditRating })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Conformité</label>
                    <select
                      value={auditFormData.compliance}
                      onChange={(e) => setAuditFormData({ ...auditFormData, compliance: e.target.value as AuditRating })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      {Object.entries(ratingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Observations générales</label>
                <textarea
                  value={auditFormData.generalNotes}
                  onChange={(e) => setAuditFormData({ ...auditFormData, generalNotes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  rows={3}
                  placeholder="Remarques, anomalies constatées..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAuditModal(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={savingAudit}>
                  {savingAudit ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer l'audit"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Audit Modal */}
      {showImportAuditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                {importAuditStep === "upload" && "Importer des audits"}
                {importAuditStep === "preview" && "Vérification de l'import"}
                {importAuditStep === "result" && "Résultat de l'import"}
              </h2>
              <button onClick={resetImportAuditModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* Upload Step */}
              {importAuditStep === "upload" && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-800 mb-2">Format du fichier CSV</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Le fichier doit contenir les colonnes suivantes (séparateur: point-virgule):
                    </p>
                    <div className="bg-white rounded p-3 text-xs font-mono overflow-x-auto">
                      <p><strong>site</strong> — Nom du site</p>
                      <p><strong>type</strong> — Type d&apos;équipement (ex: CHAUDIERE)</p>
                      <p><strong>marque</strong> — Marque de l&apos;équipement</p>
                      <p><strong>modele</strong> — Modèle</p>
                      <p><strong>numero_serie</strong> — Numéro de série (si disponible)</p>
                      <p><strong>date_audit</strong> — Date (YYYY-MM-DD ou DD/MM/YYYY)</p>
                      <p><strong>auditeur</strong> — Nom de l&apos;auditeur</p>
                      <p><strong>etat_visuel</strong> — Note (BON, MOYEN, MAUVAIS, CRITIQUE...)</p>
                      <p><strong>performance</strong> — Note</p>
                      <p><strong>securite</strong> — Note</p>
                      <p><strong>accessibilite</strong> — Note</p>
                      <p><strong>conformite</strong> — Note</p>
                      <p><strong>notes</strong> — Observations</p>
                    </div>
                    <p className="text-sm text-blue-600 mt-3">
                      💡 L&apos;équipement est identifié par numéro de série OU par site + type + marque + modèle
                    </p>
                  </div>

                  <div>
                    <Button variant="outline" onClick={downloadAuditTemplate} className="mb-4">
                      <Download size={16} className="mr-2" />
                      Télécharger le modèle CSV
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportAuditFileChange}
                      className="hidden"
                      id="import-audit-file"
                    />
                    <label htmlFor="import-audit-file" className="cursor-pointer">
                      <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-sm text-text-secondary mb-2">
                        Cliquez pour sélectionner un fichier CSV
                      </p>
                      {importAuditFile && (
                        <p className="text-sm font-medium text-accent">{importAuditFile.name}</p>
                      )}
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetImportAuditModal}>
                      Annuler
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleImportAuditPreview}
                      disabled={!importAuditFile || importingAudit}
                    >
                      {importingAudit ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          Analyse...
                        </>
                      ) : (
                        "Analyser le fichier"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview Step */}
              {importAuditStep === "preview" && importAuditPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <CheckCircle size={24} className="mx-auto text-green-600 mb-1" />
                      <p className="text-2xl font-bold text-green-700">{importAuditPreview.valid}</p>
                      <p className="text-sm text-green-600">Valides</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <AlertCircle size={24} className="mx-auto text-yellow-600 mb-1" />
                      <p className="text-2xl font-bold text-yellow-700">{importAuditPreview.warnings}</p>
                      <p className="text-sm text-yellow-600">Avertissements</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <XCircle size={24} className="mx-auto text-red-600 mb-1" />
                      <p className="text-2xl font-bold text-red-700">{importAuditPreview.errors}</p>
                      <p className="text-sm text-red-600">Erreurs</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Ligne</th>
                          <th className="text-left px-3 py-2">Site</th>
                          <th className="text-left px-3 py-2">Équipement</th>
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importAuditPreview.results.map((r) => (
                          <tr key={r.row} className={r.status === "error" ? "bg-red-50" : r.status === "warning" ? "bg-yellow-50" : ""}>
                            <td className="px-3 py-2">{r.row}</td>
                            <td className="px-3 py-2">{r.site || "-"}</td>
                            <td className="px-3 py-2">{r.equipmentName || "-"}</td>
                            <td className="px-3 py-2">{r.auditDate || "-"}</td>
                            <td className="px-3 py-2">
                              {r.status === "ok" && <CheckCircle size={16} className="text-green-600" />}
                              {r.status === "warning" && (
                                <span className="flex items-center gap-1 text-yellow-600">
                                  <AlertCircle size={16} />
                                  <span className="text-xs">{r.message}</span>
                                </span>
                              )}
                              {r.status === "error" && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <XCircle size={16} />
                                  <span className="text-xs">{r.message}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setImportAuditStep("upload")}>
                      Retour
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleImportAuditConfirm}
                      disabled={importingAudit || importAuditPreview.valid === 0}
                    >
                      {importingAudit ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        `Importer ${importAuditPreview.valid} audit(s)`
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Result Step */}
              {importAuditStep === "result" && importAuditResult && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary-dark mb-2">Import terminé !</h3>
                    <p className="text-text-secondary">
                      {importAuditResult.created} audit(s) importé(s) sur {importAuditResult.total}
                    </p>
                    {importAuditResult.errors > 0 && (
                      <p className="text-red-600 text-sm mt-2">
                        {importAuditResult.errors} erreur(s)
                      </p>
                    )}
                  </div>
                  <Button onClick={resetImportAuditModal} className="w-full">
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
