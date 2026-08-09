"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calculator,
  Wrench,
  Clock,
  Euro,
  FileText,
  Loader2,
  Target,
  TrendingUp,
  FolderPlus,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Contract, Site, DimensioningResult } from "@/components/dimensioning/types";
import { BudgetSection } from "@/components/dimensioning/sections/BudgetSection";
import { WorksSection } from "@/components/dimensioning/sections/WorksSection";
import { SiteDetailSection } from "@/components/dimensioning/sections/SiteDetailSection";
import { SaveProjectModal } from "@/components/dimensioning/modals/SaveProjectModal";

function DimensioningPageContent() {
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

  const exportPDF = async () => {
    if (!result) return;
    const contractTitle = selectedContract
      ? contracts.find((c) => c.id === selectedContract)?.title
      : undefined;
    // jspdf ne sert qu'ici : chargé au clic, pas au montage de la page.
    const { generateDimensioningPDF } = await import("@/lib/pdf/dimensioning-report");
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
          <h1 className="text-xl font-semibold text-ink">
            Dimensionnement marché
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
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
        <div className="flex items-center justify-between border border-green-600/20 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <FolderPlus className="text-green-700" size={18} />
            <div>
              <p className="text-sm font-medium text-green-800">Projet créé</p>
              <p className="font-mono text-xs tabular-nums text-green-700">
                Référence : {savedProject.reference}
              </p>
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sélection contrat ou sites */}
          <div className="lg:col-span-2">
            <label className="label-tech mb-1.5 block">
              Contrat existant
            </label>
            <select
              value={selectedContract}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">-- Ou sélectionner des sites --</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.reference} - {contract.title}
                </option>
              ))}
            </select>

            {!selectedContract && (
              <div className="mt-3">
                <label className="label-tech mb-1.5 block">
                  Sites ({selectedSites.length} sélectionnés)
                </label>
                <div className="max-h-40 divide-y divide-ink/[0.06] overflow-y-auto border border-ink/10">
                  {sites.map((site) => (
                    <label
                      key={site.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-ink/[0.02]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSites.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="accent-accent"
                      />
                      <span className="text-sm text-ink">{site.name}</span>
                      <span className="text-xs text-ink/40">({site.city})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Durée */}
          <div>
            <label className="label-tech mb-1.5 block">
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
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
            <label className="label-tech mb-1.5 block">
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
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
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
            />
            <StatsCard
              title="P2 Annuel"
              value={`${(result.summary.totalP2Annual / 1000).toFixed(1)}k€`}
              change={`${result.summary.totalHoursP2}h/an`}
              changeType="neutral"
              icon={Clock}
            />
            <StatsCard
              title="P3 GE Annuel"
              value={`${(result.summary.totalP3GEAnnual / 1000).toFixed(1)}k€`}
              icon={Wrench}
            />
            <StatsCard
              title="P3 R Annuel"
              value={`${(result.summary.totalP3RAnnual / 1000).toFixed(1)}k€`}
              change={`${result.summary.renewalsCount} renouvellements`}
              changeType={result.summary.renewalsCount > 0 ? "negative" : "positive"}
              icon={TrendingUp}
            />
            <StatsCard
              title="Total Marché"
              value={`${(result.summary.totalContract / 1000).toFixed(0)}k€`}
              change={`sur ${duration} ans`}
              changeType="neutral"
              icon={Euro}
            />
          </div>

          <BudgetSection result={result} duration={duration} />

          <WorksSection
            result={result}
            duration={duration}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />

          <SiteDetailSection
            result={result}
            expanded={expandedSections.bySite}
            toggleSection={() => toggleSection("bySite")}
          />
        </>
      )}

      {/* Empty state */}
      {!result && !calculating && (
        <div className="panel px-6 py-12 text-center">
          <Target size={32} className="mx-auto mb-3 text-ink/25" />
          <h3 className="mb-1.5 text-sm font-semibold text-ink">
            Aucun dimensionnement calculé
          </h3>
          <p className="mx-auto max-w-md text-sm text-text-secondary">
            Sélectionnez un contrat existant ou des sites, puis cliquez sur
            &quot;Calculer le dimensionnement&quot; pour estimer les coûts P2/P3.
          </p>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && result && (
        <SaveProjectModal
          result={result}
          duration={duration}
          startYear={startYear}
          projectName={projectName}
          setProjectName={setProjectName}
          saving={saving}
          onSave={saveProject}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}

export default function DimensioningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    }>
      <DimensioningPageContent />
    </Suspense>
  );
}
