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
  // Autre
  AUTRE: "Autre équipement",
};

// Group equipment types by domain
const typesByDomain: Record<EquipmentDomain, EquipmentType[]> = {
  CHAUFFAGE: [
    "CHAUDIERE", "CHAUDIERE_CONDENSATION", "PAC", "PAC_AIR_EAU", "PAC_EAU_EAU", "PAC_AIR_AIR",
    "RADIATEUR", "PLANCHER_CHAUFFANT", "CONVECTEUR", "AEROTERME",
    "VANNE_3_VOIES", "VANNE_MOTORISEE", "POMPE_CHAUFFAGE", "CIRCULATEUR",
    "VASE_EXPANSION", "ECHANGEUR_THERMIQUE", "BRULEUR", "REGULATEUR",
    "SONDE_TEMPERATURE", "SONDE_EXTERIEURE",
  ],
  ECS: [
    "BALLON_ECS", "BALLON_THERMODYNAMIQUE", "ECHANGEUR_ECS",
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
    location: "",
    level: "",
    theoreticalLifespan: "",
    siteId: "",
  });

  // Expanded rows for renewal plan
  const [expandedYears, setExpandedYears] = useState<number[]>([]);

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
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" />
          Ajouter un équipement
        </Button>
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
          {/* LIST VIEW */}
          {activeView === "list" && (
            <ChartCard title={`${filteredEquipments.length} équipement${filteredEquipments.length > 1 ? "s" : ""}`}>
              {filteredEquipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Wrench size={48} className="text-gray-300 mb-4" />
                  <p className="text-text-secondary mb-4">Aucun équipement trouvé</p>
                  <Button onClick={() => setShowModal(true)}>
                    <Plus size={18} className="mr-2" />
                    Ajouter un équipement
                  </Button>
                </div>
              ) : (
                <div className="-mx-6 -mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background-secondary border-y border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Équipement</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Localisation</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Puissance</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Année</th>
                        <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredEquipments.map((eq) => (
                        <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
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
                          <td className="px-6 py-4 text-sm text-text-secondary">{eq.site.name}</td>
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
            </ChartCard>
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
                        <p className="text-text-secondary text-center py-4">Aucun audit réalisé</p>
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
              {analytics.recommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">Recommandations</h3>
                  <ul className="space-y-1">
                    {analytics.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-blue-700">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <ChartCard title="Plan de renouvellement" subtitle="Équipements à remplacer par année">
                {analytics.renewalPlan.length === 0 ? (
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
            </div>
          )}

          {/* RISK VIEW */}
          {activeView === "risk" && analytics && (
            <div className="space-y-4">
              {stats && stats.weightedAverageAge !== null && (
                <div className={`p-4 rounded-lg ${stats.weightedAverageAge > 12 ? "bg-red-50" : stats.weightedAverageAge < 10 ? "bg-green-50" : "bg-blue-50"}`}>
                  <p className={`font-medium ${stats.weightedAverageAge > 12 ? "text-red-800" : stats.weightedAverageAge < 10 ? "text-green-800" : "text-blue-800"}`}>
                    Âge moyen pondéré du parc chaudières: <span className="text-xl">{stats.weightedAverageAge.toFixed(1)} ans</span>
                  </p>
                  <p className={`text-sm ${stats.weightedAverageAge > 12 ? "text-red-600" : stats.weightedAverageAge < 10 ? "text-green-600" : "text-blue-600"}`}>
                    Cible: 10-12 ans
                  </p>
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
                  <label className="block text-sm font-medium text-primary-dark mb-1">Local</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                    placeholder="Chaufferie"
                  />
                </div>
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
    </div>
  );
}
