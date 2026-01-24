"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calculator,
  Building2,
  Wrench,
  AlertTriangle,
  Clock,
  Euro,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  TrendingUp,
  FolderPlus,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/pricing/equipment-pricing";
import { generateDimensioningPDF } from "@/lib/pdf/dimensioning-report";

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
}

interface Site {
  id: string;
  name: string;
  city: string;
  type: string;
}

interface DimensioningResult {
  params: {
    contractId: string | null;
    siteIds: string[] | null;
    duration: number;
    startYear: number;
  };
  summary: {
    equipmentCount: number;
    siteCount: number;
    totalP2Annual: number;
    totalP3GEAnnual: number;
    totalP3RAnnual: number;
    totalP3Annual: number;
    totalAnnual: number;
    totalHoursP2: number;
    totalP2Contract: number;
    totalP3GEContract: number;
    totalP3RContract: number;
    totalP3Contract: number;
    totalContract: number;
    renewalsCount: number;
    mandatoryWorksCount: number;
    totalRenewalCost: number;
    totalMandatoryWorksCost: number;
  };
  bySite: Array<{
    siteId: string;
    siteName: string;
    equipmentCount: number;
    p2Annual: number;
    p3GEAnnual: number;
    p3RAnnual: number;
    hoursP2: number;
    renewalsCount: number;
  }>;
  renewals: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    renewalNeeded: boolean;
    urgency: string;
    renewalYear?: number;
    annualProvision: number;
    notes: string[];
  }>;
  mandatoryWorks: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    urgency: string;
    renewalYear?: number;
    notes: string[];
  }>;
}

const URGENCY_CONFIG = {
  CRITICAL: { label: "Critique", color: "bg-red-100 text-red-700", bgColor: "bg-red-500" },
  HIGH: { label: "Haute", color: "bg-orange-100 text-orange-700", bgColor: "bg-orange-500" },
  MEDIUM: { label: "Moyenne", color: "bg-yellow-100 text-yellow-700", bgColor: "bg-yellow-500" },
  LOW: { label: "Basse", color: "bg-blue-100 text-blue-700", bgColor: "bg-blue-500" },
  NONE: { label: "Aucune", color: "bg-gray-100 text-gray-700", bgColor: "bg-gray-300" },
};

export default function DimensioningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<DimensioningResult | null>(null);

  // Params
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [duration, setDuration] = useState(8);
  const [startYear, setStartYear] = useState(new Date().getFullYear());

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    bySite: true,
    renewals: true,
    mandatory: true,
  });

  // Save project state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedProject, setSavedProject] = useState<{ contractId: string; reference: string } | null>(null);

  // Update URL with current parameters
  const updateURLParams = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedContract) {
      params.set("contractId", selectedContract);
    }
    if (selectedSites.length > 0) {
      params.set("siteIds", selectedSites.join(","));
    }
    params.set("duration", duration.toString());
    params.set("startYear", startYear.toString());
    router.push(`/dimensioning?${params.toString()}`, { scroll: false });
  }, [selectedContract, selectedSites, duration, startYear, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contractsRes, sitesRes] = await Promise.all([
          fetch("/api/contracts"),
          fetch("/api/sites"),
        ]);
        const [contractsData, sitesData] = await Promise.all([
          contractsRes.json(),
          sitesRes.json(),
        ]);
        setContracts(Array.isArray(contractsData) ? contractsData : []);
        setSites(Array.isArray(sitesData) ? sitesData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Restore parameters from URL on page load
  useEffect(() => {
    if (contracts.length > 0 && sites.length > 0) {
      const contractIdFromUrl = searchParams.get("contractId");
      const siteIdsFromUrl = searchParams.get("siteIds");
      const durationFromUrl = searchParams.get("duration");
      const startYearFromUrl = searchParams.get("startYear");

      if (contractIdFromUrl && !selectedContract) {
        setSelectedContract(contractIdFromUrl);
      }
      if (siteIdsFromUrl && selectedSites.length === 0) {
        setSelectedSites(siteIdsFromUrl.split(","));
      }
      if (durationFromUrl) {
        setDuration(parseInt(durationFromUrl));
      }
      if (startYearFromUrl) {
        setStartYear(parseInt(startYearFromUrl));
      }
    }
  }, [contracts, sites, searchParams]);

  const calculateDimensioning = useCallback(async () => {
    setCalculating(true);
    try {
      const params = new URLSearchParams();
      if (selectedContract) {
        params.set("contractId", selectedContract);
      } else if (selectedSites.length > 0) {
        params.set("siteIds", selectedSites.join(","));
      }
      params.set("duration", duration.toString());
      params.set("startYear", startYear.toString());

      const response = await fetch(`/api/dimensioning?${params}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        console.error("Error:", data.error);
      }
    } catch (error) {
      console.error("Error calculating:", error);
    } finally {
      setCalculating(false);
    }
  }, [selectedContract, selectedSites, duration, startYear]);

  const toggleSite = (siteId: string) => {
    const newSites = selectedSites.includes(siteId)
      ? selectedSites.filter((id) => id !== siteId)
      : [...selectedSites, siteId];
    setSelectedSites(newSites);
    setSelectedContract(""); // Clear contract if selecting sites manually

    // Update URL
    const params = new URLSearchParams();
    if (newSites.length > 0) {
      params.set("siteIds", newSites.join(","));
    }
    params.set("duration", duration.toString());
    params.set("startYear", startYear.toString());
    router.push(`/dimensioning?${params.toString()}`, { scroll: false });
  };

  const handleContractChange = (contractId: string) => {
    setSelectedContract(contractId);
    setSelectedSites([]); // Clear sites if selecting contract

    // Update URL
    const params = new URLSearchParams();
    if (contractId) {
      params.set("contractId", contractId);
    }
    params.set("duration", duration.toString());
    params.set("startYear", startYear.toString());
    router.push(`/dimensioning?${params.toString()}`, { scroll: false });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const exportPDF = () => {
    if (!result) return;
    const contractTitle = selectedContract
      ? contracts.find((c) => c.id === selectedContract)?.title
      : undefined;
    generateDimensioningPDF(result, contractTitle);
  };

  const saveProject = async () => {
    if (!projectName.trim() || !result) return;

    setSaving(true);
    try {
      const response = await fetch("/api/dimensioning/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          siteIds: result.bySite.map((s) => s.siteId),
          duration,
          startYear,
          dimensioning: result.summary,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSavedProject({
          contractId: data.contractId,
          reference: data.contractReference,
        });
        setShowSaveDialog(false);
      } else {
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold text-primary-dark">
            Dimensionnement Marché
          </h1>
          <p className="text-text-secondary">
            Estimez les coûts P2/P3 et planifiez les renouvellements
          </p>
        </div>
        {result && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(true)} disabled={!!savedProject}>
              <Save size={18} className="mr-2" />
              {savedProject ? "Sauvegardé" : "Créer projet"}
            </Button>
            <Button onClick={exportPDF}>
              <FileText size={18} className="mr-2" />
              Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Saved project banner */}
      {savedProject && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderPlus className="text-green-600" size={20} />
            <div>
              <p className="font-medium text-green-800">Projet créé</p>
              <p className="text-sm text-green-600">Référence: {savedProject.reference}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `/contracts/${savedProject.contractId}`}
          >
            Voir le projet
          </Button>
        </div>
      )}

      {/* Configuration */}
      <ChartCard title="Configuration du marché">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Sélection contrat ou sites */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Contrat existant
            </label>
            <select
              value={selectedContract}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">-- Ou sélectionner des sites --</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.reference} - {contract.title}
                </option>
              ))}
            </select>

            {!selectedContract && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-primary-dark mb-2">
                  Sites ({selectedSites.length} sélectionnés)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {sites.map((site) => (
                    <label
                      key={site.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSites.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="rounded text-accent focus:ring-accent"
                      />
                      <span className="text-sm">{site.name}</span>
                      <span className="text-xs text-gray-400">({site.city})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Durée */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Durée du marché
            </label>
            <select
              value={duration}
              onChange={(e) => {
                const newDuration = parseInt(e.target.value);
                setDuration(newDuration);

                // Update URL
                const params = new URLSearchParams();
                if (selectedContract) {
                  params.set("contractId", selectedContract);
                }
                if (selectedSites.length > 0) {
                  params.set("siteIds", selectedSites.join(","));
                }
                params.set("duration", newDuration.toString());
                params.set("startYear", startYear.toString());
                router.push(`/dimensioning?${params.toString()}`, { scroll: false });
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {[4, 5, 6, 7, 8, 9, 10, 12, 15].map((y) => (
                <option key={y} value={y}>
                  {y} ans
                </option>
              ))}
            </select>
          </div>

          {/* Année de début */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Année de début
            </label>
            <select
              value={startYear}
              onChange={(e) => {
                const newStartYear = parseInt(e.target.value);
                setStartYear(newStartYear);

                // Update URL
                const params = new URLSearchParams();
                if (selectedContract) {
                  params.set("contractId", selectedContract);
                }
                if (selectedSites.length > 0) {
                  params.set("siteIds", selectedSites.join(","));
                }
                params.set("duration", duration.toString());
                params.set("startYear", newStartYear.toString());
                router.push(`/dimensioning?${params.toString()}`, { scroll: false });
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={calculateDimensioning}
            disabled={calculating || (!selectedContract && selectedSites.length === 0)}
          >
            {calculating ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Calculator size={18} className="mr-2" />
                Calculer le dimensionnement
              </>
            )}
          </Button>
        </div>
      </ChartCard>

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="Équipements"
              value={result.summary.equipmentCount.toString()}
              change={`${result.summary.siteCount} sites`}
              changeType="neutral"
              icon={Wrench}
              iconColor="text-orange-600"
            />
            <StatsCard
              title="P2 Annuel"
              value={`${(result.summary.totalP2Annual / 1000).toFixed(1)}k€`}
              change={`${result.summary.totalHoursP2}h/an`}
              changeType="neutral"
              icon={Clock}
              iconColor="text-blue-600"
            />
            <StatsCard
              title="P3 GE Annuel"
              value={`${(result.summary.totalP3GEAnnual / 1000).toFixed(1)}k€`}
              icon={Wrench}
              iconColor="text-accent"
            />
            <StatsCard
              title="P3 R Annuel"
              value={`${(result.summary.totalP3RAnnual / 1000).toFixed(1)}k€`}
              change={`${result.summary.renewalsCount} renouvellements`}
              changeType={result.summary.renewalsCount > 0 ? "negative" : "positive"}
              icon={TrendingUp}
              iconColor="text-purple-600"
            />
            <StatsCard
              title="Total Marché"
              value={`${(result.summary.totalContract / 1000).toFixed(0)}k€`}
              change={`sur ${duration} ans`}
              changeType="neutral"
              icon={Euro}
              iconColor="text-green-600"
            />
          </div>

          {/* Budget breakdown */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Annuel */}
            <ChartCard title="Budget annuel" subtitle="Répartition P2/P3">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-primary-dark">P2 - Petit entretien</p>
                    <p className="text-sm text-gray-500">{result.summary.totalHoursP2} heures/an</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">
                    {result.summary.totalP2Annual.toLocaleString()} €
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg">
                  <div>
                    <p className="font-medium text-primary-dark">P3 GE - Gros entretien</p>
                    <p className="text-sm text-gray-500">Maintenance lourde annuelle</p>
                  </div>
                  <p className="text-xl font-bold text-accent">
                    {result.summary.totalP3GEAnnual.toLocaleString()} €
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="font-medium text-primary-dark">P3 R - Renouvellement</p>
                    <p className="text-sm text-gray-500">
                      Provision pour {result.summary.renewalsCount} renouvellements
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {result.summary.totalP3RAnnual.toLocaleString()} €
                  </p>
                </div>

                <div className="border-t pt-4 flex items-center justify-between">
                  <p className="font-bold text-lg text-primary-dark">TOTAL ANNUEL</p>
                  <p className="text-2xl font-bold text-primary-dark">
                    {result.summary.totalAnnual.toLocaleString()} €
                  </p>
                </div>
              </div>
            </ChartCard>

            {/* Sur durée du marché */}
            <ChartCard title={`Budget sur ${duration} ans`} subtitle="Total marché">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <p className="text-primary-dark">P2 Total</p>
                  <p className="font-bold">{result.summary.totalP2Contract.toLocaleString()} €</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <p className="text-primary-dark">P3 GE Total</p>
                  <p className="font-bold">{result.summary.totalP3GEContract.toLocaleString()} €</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <p className="text-primary-dark">P3 R Total</p>
                  <p className="font-bold">{result.summary.totalP3RContract.toLocaleString()} €</p>
                </div>

                <div className="border-t pt-4 flex items-center justify-between">
                  <p className="font-bold text-lg text-primary-dark">TOTAL MARCHÉ</p>
                  <p className="text-2xl font-bold text-accent">
                    {result.summary.totalContract.toLocaleString()} €
                  </p>
                </div>

                {/* Visual bar */}
                <div className="mt-4">
                  <div className="h-6 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${(result.summary.totalP2Contract / result.summary.totalContract) * 100}%`,
                      }}
                      title="P2"
                    />
                    <div
                      className="bg-accent h-full"
                      style={{
                        width: `${(result.summary.totalP3GEContract / result.summary.totalContract) * 100}%`,
                      }}
                      title="P3 GE"
                    />
                    <div
                      className="bg-purple-500 h-full"
                      style={{
                        width: `${(result.summary.totalP3RContract / result.summary.totalContract) * 100}%`,
                      }}
                      title="P3 R"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500 rounded" />
                      P2 ({Math.round((result.summary.totalP2Contract / result.summary.totalContract) * 100)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-accent rounded" />
                      P3 GE ({Math.round((result.summary.totalP3GEContract / result.summary.totalContract) * 100)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-purple-500 rounded" />
                      P3 R ({Math.round((result.summary.totalP3RContract / result.summary.totalContract) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Mandatory works */}
          {result.mandatoryWorks.length > 0 && (
            <ChartCard
              title={
                <button
                  onClick={() => toggleSection("mandatory")}
                  className="flex items-center gap-2"
                >
                  {expandedSections.mandatory ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <AlertTriangle className="text-red-500" size={20} />
                  <span>Travaux obligatoires ({result.mandatoryWorks.length})</span>
                </button>
              }
              subtitle={`Urgence haute ou critique - Total: ${result.summary.totalMandatoryWorksCost.toLocaleString()} €`}
            >
              {expandedSections.mandatory && (
                <div className="space-y-3">
                  {result.mandatoryWorks.map((work) => (
                    <div
                      key={work.equipmentId}
                      className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-10 rounded ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.bgColor || "bg-gray-300"}`} />
                        <div>
                          <p className="font-medium text-primary-dark">
                            {EQUIPMENT_TYPE_LABELS[work.equipmentType] || work.equipmentType}
                          </p>
                          <p className="text-sm text-gray-500">{work.siteName}</p>
                          {work.notes.length > 0 && (
                            <p className="text-xs text-red-600 mt-1">{work.notes[0]}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-red-600">
                          {work.replacementCost.toLocaleString()} €
                        </p>
                        <span className={`text-xs px-2 py-1 rounded ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                          {URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          )}

          {/* All renewals */}
          {result.renewals.length > 0 && (
            <ChartCard
              title={
                <button
                  onClick={() => toggleSection("renewals")}
                  className="flex items-center gap-2"
                >
                  {expandedSections.renewals ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <Calendar className="text-purple-500" size={20} />
                  <span>Plan de renouvellement ({result.renewals.length})</span>
                </button>
              }
              subtitle={`Renouvellements prévus sur ${duration} ans`}
            >
              {expandedSections.renewals && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Équipement
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Site
                        </th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Année
                        </th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Urgence
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Coût
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                          Provision/an
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.renewals.map((renewal) => (
                        <tr key={renewal.equipmentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-primary-dark">
                              {EQUIPMENT_TYPE_LABELS[renewal.equipmentType] || renewal.equipmentType}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{renewal.siteName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-medium">{renewal.renewalYear || "-"}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-1 rounded ${URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                              {URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {renewal.replacementCost.toLocaleString()} €
                          </td>
                          <td className="px-4 py-3 text-right text-purple-600">
                            {renewal.annualProvision.toLocaleString()} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          )}

          {/* By site */}
          <ChartCard
            title={
              <button
                onClick={() => toggleSection("bySite")}
                className="flex items-center gap-2"
              >
                {expandedSections.bySite ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <Building2 className="text-accent" size={20} />
                <span>Détail par site ({result.bySite.length})</span>
              </button>
            }
          >
            {expandedSections.bySite && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        Site
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        Équip.
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        P2/an
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        Heures
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        P3 GE/an
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        P3 R/an
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                        Total/an
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.bySite.map((site) => (
                      <tr key={site.siteId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-primary-dark">{site.siteName}</p>
                          {site.renewalsCount > 0 && (
                            <span className="text-xs text-orange-600">
                              {site.renewalsCount} renouvellement(s)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{site.equipmentCount}</td>
                        <td className="px-4 py-3 text-right">{Math.round(site.p2Annual).toLocaleString()} €</td>
                        <td className="px-4 py-3 text-right text-gray-500">{site.hoursP2.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right">{Math.round(site.p3GEAnnual).toLocaleString()} €</td>
                        <td className="px-4 py-3 text-right text-purple-600">
                          {Math.round(site.p3RAnnual).toLocaleString()} €
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {Math.round(site.p2Annual + site.p3GEAnnual + site.p3RAnnual).toLocaleString()} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </>
      )}

      {/* Empty state */}
      {!result && !calculating && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Target size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">
            Aucun dimensionnement calculé
          </h3>
          <p className="text-text-secondary max-w-md mx-auto">
            Sélectionnez un contrat existant ou des sites, puis cliquez sur
            &quot;Calculer le dimensionnement&quot; pour estimer les coûts P2/P3.
          </p>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FolderPlus className="text-accent" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primary-dark">Créer un projet</h2>
                  <p className="text-sm text-text-secondary">Sauvegarder ce dimensionnement</p>
                </div>
              </div>
              <button onClick={() => setShowSaveDialog(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-2">
                  Nom du projet / Marché
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Marché Chauffage Lycées 2025-2033"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-primary-dark mb-2">Résumé du dimensionnement</p>
                <div className="space-y-1 text-gray-600">
                  <p>{result?.summary.siteCount} sites • {result?.summary.equipmentCount} équipements</p>
                  <p>Durée: {duration} ans ({startYear} - {startYear + duration})</p>
                  <p className="font-medium text-accent">
                    Budget total: {result?.summary.totalContract.toLocaleString()} € HT
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Un contrat sera créé avec les sites et le dimensionnement calculé.
              </p>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={saveProject} disabled={!projectName.trim() || saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Créer le projet
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
