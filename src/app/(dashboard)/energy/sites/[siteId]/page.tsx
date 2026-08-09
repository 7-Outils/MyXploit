"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  AlertTriangle,
  Wrench,
  ExternalLink,
  Flame,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import ThermalProfileSection from "@/components/energy/ThermalProfileSection";

import type {
  SiteDetailData,
  SiteAnalyticsData,
  SiteDJUData,
  SiteHeatingSeason,
  MultiSeasonData,
  ActionItem,
} from "@/components/energy/site-detail/types";
import {
  SITE_TYPE_LABELS,
  ENERGY_TYPE_LABELS,
  formatMonthLabel,
  formatNumber,
  getStatusBadge,
} from "@/components/energy/site-detail/constants";

import KPIGrid from "@/components/energy/site-detail/sections/KPIGrid";
import ConsumptionCharts from "@/components/energy/site-detail/sections/ConsumptionCharts";
import HistoricalSection, { DJUChart } from "@/components/energy/site-detail/sections/HistoricalSection";
import HeatingPeriodsSection from "@/components/energy/site-detail/sections/HeatingPeriodsSection";
import CorrectiveActions from "@/components/energy/site-detail/sections/CorrectiveActions";

export default function SiteEnergyPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const [site, setSite] = useState<SiteDetailData | null>(null);
  const [analytics, setAnalytics] = useState<SiteAnalyticsData | null>(null);
  const [djuData, setDjuData] = useState<SiteDJUData | null>(null);
  const [heatingSeasons, setHeatingSeasons] = useState<SiteHeatingSeason[]>([]);
  const [multiSeasonData, setMultiSeasonData] = useState<MultiSeasonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentCalendarYear = now.getFullYear();

  const getCurrentSeasonYear = () => {
    return currentMonth >= 8 ? currentCalendarYear + 1 : currentCalendarYear;
  };

  const [selectedYear, setSelectedYear] = useState(getCurrentSeasonYear());

  const currentSeasonYear = getCurrentSeasonYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentSeasonYear - i);

  useEffect(() => {
    fetchData();
  }, [siteId, selectedYear]);

  useEffect(() => {
    fetchMultiSeasonData();
  }, [siteId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [siteRes, analyticsRes, djuRes, seasonsRes] = await Promise.all([
        fetch(`/api/sites/${siteId}`),
        fetch(`/api/consumptions/analytics?siteId=${siteId}&year=${selectedYear}`),
        fetch(`/api/dju?siteId=${siteId}&year=${selectedYear}`),
        fetch(`/api/heating-seasons?siteId=${siteId}`),
      ]);

      if (siteRes.ok) setSite(await siteRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (djuRes.ok) setDjuData(await djuRes.json());
      if (seasonsRes.ok) setHeatingSeasons(await seasonsRes.json());
    } catch (error) {
      console.error("Error fetching site data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMultiSeasonData = async () => {
    const seasons: MultiSeasonData[] = [];

    for (let year = currentSeasonYear; year >= currentSeasonYear - 4; year--) {
      try {
        const [analyticsRes, djuRes] = await Promise.all([
          fetch(`/api/consumptions/analytics?siteId=${siteId}&year=${year}`),
          fetch(`/api/dju?siteId=${siteId}&year=${year}`),
        ]);

        if (analyticsRes.ok && djuRes.ok) {
          const analyticsData: SiteAnalyticsData = await analyticsRes.json();
          const djuDataYear: SiteDJUData = await djuRes.json();

          const siteAnalytics = analyticsData.sites.find(s => s.siteId === siteId);
          const siteDju = djuDataYear.sites.find(s => s.siteId === siteId);

          if (siteAnalytics && siteAnalytics.nc > 0) {
            seasons.push({
              season: `${year - 1}-${year}`,
              nc: siteAnalytics.nc,
              nbPrime: siteAnalytics.nbPrime,
              deltaPercent: siteAnalytics.deltaPercent,
              djuReel: siteDju?.djuReel || 0,
              djuTrentenaire: siteDju?.djuTrentenaire || 0,
              status: siteAnalytics.status,
            });
          }
        }
      } catch {
        // Skip failed years
      }
    }

    setMultiSeasonData(seasons.reverse());
  };

  const siteAnalytics = analytics?.sites.find(s => s.siteId === siteId);
  const siteDju = djuData?.sites.find(s => s.siteId === siteId);

  // Generate corrective actions based on performance
  const generateActions = (): ActionItem[] => {
    const actions: ActionItem[] = [];

    if (siteAnalytics) {
      if (siteAnalytics.status === "DEPASSEMENT") {
        actions.push({
          id: "perf-1",
          type: "warning",
          title: "Dépassement de consommation",
          description: `Le site dépasse son objectif de ${Math.abs(siteAnalytics.deltaPercent).toFixed(1)}%. Vérifier les réglages de régulation et l'état des équipements.`,
          priority: "high",
        });
      }

      if (siteAnalytics.status === "ECONOMIE" && siteAnalytics.deltaPercent < -15) {
        actions.push({
          id: "perf-2",
          type: "info",
          title: "Économie importante",
          description: `Économie de ${Math.abs(siteAnalytics.deltaPercent).toFixed(1)}% par rapport à l'objectif. Vérifier le confort des occupants.`,
          priority: "medium",
        });
      }
    }

    if (siteDju) {
      if (!siteDju.hasHeatingSeason) {
        actions.push({
          id: "dju-1",
          type: "action",
          title: "Période de chauffe non définie",
          description: "Définir les dates d'allumage et d'arrêt pour un calcul DJU précis.",
          priority: "medium",
        });
      }

      if (siteDju.ecartPercent > 10) {
        actions.push({
          id: "dju-2",
          type: "info",
          title: "Saison plus froide que la normale",
          description: `DJU réels supérieurs de ${siteDju.ecartPercent}% à la moyenne trentenaire.`,
          priority: "low",
        });
      }
    }

    if (site) {
      if (!site.nb) {
        actions.push({
          id: "config-1",
          type: "action",
          title: "NB non configuré",
          description: "Définir le Niveau de Base (cible énergétique) pour le suivi de performance.",
          priority: "high",
        });
      }

      if (!site.djuContractuel) {
        actions.push({
          id: "config-2",
          type: "action",
          title: "DJU contractuel non défini",
          description: "Définir les DJU contractuels pour le calcul du N'B ajusté.",
          priority: "medium",
        });
      }
    }

    if (site?.alerts && site.alerts.length > 0) {
      site.alerts.slice(0, 3).forEach((alert, i) => {
        actions.push({
          id: `alert-${i}`,
          type: alert.priority === "HAUTE" ? "warning" : "info",
          title: alert.title,
          description: alert.message,
          priority: alert.priority === "HAUTE" ? "high" : alert.priority === "MOYENNE" ? "medium" : "low",
        });
      });
    }

    return actions;
  };

  const actions = generateActions();

  const monthlyChartData = siteAnalytics?.monthlyData.map(m => ({
    label: formatMonthLabel(m.month),
    value: m.nc / 1000,
    target: m.nbPrime / 1000,
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h3 className="mt-3 text-sm font-semibold text-ink">Site non trouvé</h3>
          <p className="text-sm text-text-secondary">Le site demandé n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
          <Button className="mt-4">
            <Link href="/energy?tab=sites">Retour aux sites</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/energy?tab=sites">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-ink">{site.name}</h1>
              {siteAnalytics && getStatusBadge(siteAnalytics.status)}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-ink/50">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {SITE_TYPE_LABELS[site.type] || site.type}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {site.city} ({site.postalCode})
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                {ENERGY_TYPE_LABELS[site.energyType] || site.energyType}
              </span>
              {site.surface && (
                <span className="flex items-center gap-1.5 tabular-nums">
                  {formatNumber(site.surface)} m²
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year.toString()}>
                Saison {year - 1}-{year}
              </option>
            ))}
          </select>

          <Link href={`/exploitation?siteId=${siteId}`}>
            <Button variant="outline">
              <Wrench className="h-4 w-4 mr-2" />
              Équipements
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>

          <Link href={`/buildings/${siteId}?tab=meters`}>
            <Button variant="outline">
              <GitBranch className="h-4 w-4 mr-2" />
              Schéma comptage
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <KPIGrid site={site} siteAnalytics={siteAnalytics} siteDju={siteDju} />

      <ConsumptionCharts
        site={site}
        siteAnalytics={siteAnalytics}
        siteDju={siteDju}
        monthlyChartData={monthlyChartData}
      />

      <HistoricalSection multiSeasonData={multiSeasonData} />

      {/* DJU and heating periods side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DJUChart siteAnalytics={siteAnalytics} siteDju={siteDju} />
        <HeatingPeriodsSection heatingSeasons={heatingSeasons} />
      </div>

      <CorrectiveActions actions={actions} />

      {/* Profil thermique */}
      <ThermalProfileSection siteId={siteId} />

      {/* Informations site */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-ink/40" />
            Informations du site
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 divide-ink/10 md:grid-cols-4 md:divide-x">
          <div>
            <p className="label-tech">Adresse</p>
            <p className="text-sm font-medium text-ink">{site.address}</p>
            <p className="font-mono text-xs tabular-nums text-ink/50">
              {site.postalCode} {site.city}
            </p>
          </div>
          <div className="md:pl-4">
            <p className="label-tech">Surfaces</p>
            <p className="font-mono text-sm font-medium tabular-nums text-ink">
              {site.surface ? `${formatNumber(site.surface)} m² total` : "—"}
            </p>
            {site.surfaceChauffee && (
              <p className="font-mono text-xs tabular-nums text-ink/50">
                {formatNumber(site.surfaceChauffee)} m² chauffés
              </p>
            )}
          </div>
          <div className="md:pl-4">
            <p className="label-tech">Station météo</p>
            <p className="text-sm font-medium text-ink">
              {siteDju?.station || site.stationMeteo || "—"}
            </p>
            {site.djuContractuel && (
              <p className="font-mono text-xs tabular-nums text-ink/50">
                DJU contractuel : {formatNumber(site.djuContractuel)}
              </p>
            )}
          </div>
          <div className="md:pl-4">
            <p className="label-tech">Compteurs</p>
            {site.pce && (
              <p className="font-mono text-xs tabular-nums text-ink">PCE : {site.pce}</p>
            )}
            {site.pdl && (
              <p className="font-mono text-xs tabular-nums text-ink">PDL : {site.pdl}</p>
            )}
            {!site.pce && !site.pdl && <p className="text-sm text-ink/40">—</p>}
          </div>
        </div>

        {site.contractSites.length > 0 && (
          <>
            <div className="my-3 border-t border-ink/10" />
            <div>
              <p className="label-tech mb-1.5">Contrats associés</p>
              <div className="flex flex-wrap gap-1.5">
                {site.contractSites.map((cs) => (
                  <span
                    key={cs.contract.id}
                    className="border border-ink/10 px-2 py-0.5 text-xs text-ink/70"
                  >
                    {cs.contract.reference} — {cs.contract.title}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}
