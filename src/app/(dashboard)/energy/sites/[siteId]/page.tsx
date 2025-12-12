"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Thermometer,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Calendar,
  Wrench,
  ExternalLink,
  Flame,
  Target,
  AlertCircle,
  Info,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";

interface SiteData {
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
  djuContractuel: number | null;
  stationMeteo: string | null;
  pce: string | null;
  pdl: string | null;
  contractSites: Array<{
    contract: {
      id: string;
      reference: string;
      title: string;
    };
  }>;
  consumptions: Array<{
    id: string;
    period: string;
    quantity: number;
    energyType: string;
    usage: string;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

interface AnalyticsData {
  year: number;
  period: { start: string; end: string };
  summary: {
    totalNc: number;
    totalNbPrime: number;
    totalDelta: number;
    deltaPercent: number;
    status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
  };
  monthlyData: Array<{
    month: string;
    label: string;
    nc: number;
    nbPrime: number;
    djr: number;
    ecs: number;
  }>;
  sites: Array<{
    siteId: string;
    siteName: string;
    nc: number;
    nbPrime: number;
    delta: number;
    deltaPercent: number;
    status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
    monthlyData: Array<{
      month: string;
      nc: number;
      nbPrime: number;
      djr: number;
      ecs: number;
    }>;
  }>;
}

interface DJUData {
  year: number;
  period: { start: string; end: string };
  sites: Array<{
    siteId: string;
    siteName: string;
    station: string;
    djuReel: number;
    djuTrentenaire: number;
    djuTrentenaireToDate: number;
    ecartPercent: number;
    heatingStartDate: string;
    heatingEndDate: string;
    hasHeatingSeason: boolean;
    monthlyData: Array<{
      month: string;
      dju: number;
      avgTemp: number;
    }>;
    dailyData: Array<{
      date: string;
      dju: number;
      tMoy: number;
    }>;
  }>;
}

interface HeatingSeason {
  id: string;
  season: string;
  startDate: string;
  endDate: string | null;
  startIndex: number | null;
  endIndex: number | null;
  notes: string | null;
}

interface MultiSeasonData {
  season: string;
  nc: number;
  nbPrime: number;
  deltaPercent: number;
  djuReel: number;
  djuTrentenaire: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
}

const SITE_TYPE_LABELS: Record<string, string> = {
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

const ENERGY_TYPE_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "RCU",
  EAU: "Eau",
  AUTRE: "Autre",
};

export default function SiteEnergyPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const [site, setSite] = useState<SiteData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [djuData, setDjuData] = useState<DJUData | null>(null);
  const [heatingSeasons, setHeatingSeasons] = useState<HeatingSeason[]>([]);
  const [multiSeasonData, setMultiSeasonData] = useState<MultiSeasonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Heating season logic: September starts a new season
  // If current month >= September, we're in season currentYear-nextYear (represented by nextYear)
  // If current month < September, we're in season previousYear-currentYear (represented by currentYear)
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed, September = 8
  const currentCalendarYear = now.getFullYear();

  // The "year" represents the END year of the season (e.g., 2026 for season 2025-2026)
  const getCurrentSeasonYear = () => {
    return currentMonth >= 8 ? currentCalendarYear + 1 : currentCalendarYear;
  };

  const [selectedYear, setSelectedYear] = useState(getCurrentSeasonYear());

  // Generate year options (seasons ending in these years)
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

      if (siteRes.ok) {
        setSite(await siteRes.json());
      }
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (djuRes.ok) {
        setDjuData(await djuRes.json());
      }
      if (seasonsRes.ok) {
        setHeatingSeasons(await seasonsRes.json());
      }
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
          const analyticsData: AnalyticsData = await analyticsRes.json();
          const djuDataYear: DJUData = await djuRes.json();

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

  const getStatusBadge = (status: string) => {
    const base = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "ECONOMIE":
        return <span className={`${base} bg-green-100 text-green-800`}>Économie</span>;
      case "DEPASSEMENT":
        return <span className={`${base} bg-red-100 text-red-800`}>Dépassement</span>;
      default:
        return <span className={`${base} bg-blue-100 text-blue-800`}>Objectif atteint</span>;
    }
  };

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n));
  };

  const siteAnalytics = analytics?.sites.find(s => s.siteId === siteId);
  const siteDju = djuData?.sites.find(s => s.siteId === siteId);

  // Generate corrective actions based on performance
  const generateActions = () => {
    const actions: Array<{
      id: string;
      type: "warning" | "info" | "success" | "action";
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
    }> = [];

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

  // Prepare chart data
  const monthlyChartData = siteAnalytics?.monthlyData.map(m => ({
    label: formatMonthLabel(m.month),
    value: m.nc,
    target: m.nbPrime,
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
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-medium">Site non trouvé</h3>
          <p className="text-text-secondary">Le site demandé n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
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
              <h1 className="text-2xl font-bold text-primary-dark">{site.name}</h1>
              {siteAnalytics && getStatusBadge(siteAnalytics.status)}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {SITE_TYPE_LABELS[site.type] || site.type}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {site.city} ({site.postalCode})
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-4 w-4" />
                {ENERGY_TYPE_LABELS[site.energyType] || site.energyType}
              </span>
              {site.surface && (
                <span className="flex items-center gap-1">
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
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
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

          <Link href={`/sites/${siteId}`}>
            <Button variant="outline">
              <GitBranch className="h-4 w-4 mr-2" />
              Schéma comptage
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="NC (Consommation réelle)"
          value={siteAnalytics ? `${formatNumber(siteAnalytics.nc)} MWh` : "-"}
          change={site.nb ? `NB: ${formatNumber(site.nb)} MWh` : undefined}
          changeType="neutral"
          icon={Zap}
          iconColor="text-orange-600"
        />
        <StatsCard
          title="N'B (Objectif ajusté)"
          value={siteAnalytics ? `${formatNumber(siteAnalytics.nbPrime)} MWh` : "-"}
          change="Ajusté selon DJU réels"
          changeType="neutral"
          icon={Target}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Écart NC/N'B"
          value={siteAnalytics ? `${siteAnalytics.deltaPercent > 0 ? "+" : ""}${siteAnalytics.deltaPercent.toFixed(1)}%` : "-"}
          change={siteAnalytics ? `${formatNumber(siteAnalytics.delta)} MWh` : undefined}
          changeType={siteAnalytics && siteAnalytics.deltaPercent < 0 ? "positive" : siteAnalytics && siteAnalytics.deltaPercent > 0 ? "negative" : "neutral"}
          icon={siteAnalytics && siteAnalytics.deltaPercent < 0 ? TrendingDown : TrendingUp}
          iconColor={siteAnalytics && siteAnalytics.deltaPercent < 0 ? "text-green-600" : "text-red-600"}
        />
        <StatsCard
          title="DJU réels"
          value={siteDju ? `${formatNumber(siteDju.djuReel)} DJU` : "-"}
          change={siteDju ? `vs ${formatNumber(siteDju.djuTrentenaire)} trentenaire` : undefined}
          changeType="neutral"
          icon={Thermometer}
          iconColor="text-indigo-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NC vs N'B mensuel */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              Consommation mensuelle NC vs N&apos;B
            </span>
          }
        >
          {monthlyChartData.length > 0 ? (
            <SimpleBarChart data={monthlyChartData} height={250} />
          ) : (
            <div className="flex items-center justify-center h-[250px] text-text-secondary">
              Aucune donnée disponible
            </div>
          )}
        </ChartCard>

        {/* Signature énergétique */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-accent" />
              Signature énergétique (NC vs DJU)
            </span>
          }
        >
          {siteAnalytics && siteAnalytics.monthlyData.length > 0 ? (
            <div className="h-[250px] relative">
              <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary mb-4">
                <div>
                  <span className="font-medium">Pente:</span> {site.nb && siteDju?.djuTrentenaire
                    ? `${(site.nb / siteDju.djuTrentenaire * 1000).toFixed(2)} kWh/DJU`
                    : "-"}
                </div>
                <div>
                  <span className="font-medium">Ordonnée:</span> Talon ECS
                </div>
                <div>
                  <span className="font-medium">R²:</span> -
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {siteAnalytics.monthlyData.filter(m => m.djr > 0).map((m, i) => (
                  <div key={i} className="bg-indigo-100 px-2 py-1 rounded text-xs">
                    {formatMonthLabel(m.month)}: {formatNumber(m.nc)} MWh / {formatNumber(m.djr)} DJU
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-4">
                La signature énergétique représente la corrélation entre consommation et rigueur climatique.
                Une pente plus faible indique une meilleure performance thermique du bâtiment.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-text-secondary">
              Données insuffisantes pour la signature
            </div>
          )}
        </ChartCard>
      </div>

      {/* Historique multi-saisons */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Historique multi-saisons
          </span>
        }
      >
        {multiSeasonData.length > 0 ? (
          <div className="space-y-6">
            {/* Simple visual comparison */}
            <div className="grid grid-cols-5 gap-4">
              {multiSeasonData.map((season) => (
                <div key={season.season} className="text-center">
                  <div className="text-sm font-medium mb-2">{season.season}</div>
                  <div className="relative h-32 flex items-end justify-center gap-1">
                    <div
                      className="w-6 bg-red-400 rounded-t"
                      style={{ height: `${Math.min((season.nc / Math.max(...multiSeasonData.map(s => s.nc))) * 100, 100)}%` }}
                      title={`NC: ${formatNumber(season.nc)} MWh`}
                    />
                    <div
                      className="w-6 bg-blue-400 rounded-t"
                      style={{ height: `${Math.min((season.nbPrime / Math.max(...multiSeasonData.map(s => s.nbPrime))) * 100, 100)}%` }}
                      title={`N'B: ${formatNumber(season.nbPrime)} MWh`}
                    />
                  </div>
                  <div className={`text-sm font-medium mt-1 ${
                    season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : ""
                  }`}>
                    {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                  </div>
                  {getStatusBadge(season.status)}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 justify-center text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-400 rounded"></span> NC (Réel)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-400 rounded"></span> N&apos;B (Objectif)
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border-t pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Saison</th>
                    <th className="text-right py-2 font-medium">NC (MWh)</th>
                    <th className="text-right py-2 font-medium">N&apos;B (MWh)</th>
                    <th className="text-right py-2 font-medium">Écart</th>
                    <th className="text-right py-2 font-medium">DJU réels</th>
                    <th className="text-center py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {multiSeasonData.map((season) => (
                    <tr key={season.season} className="border-b">
                      <td className="py-2">{season.season}</td>
                      <td className="text-right py-2">{formatNumber(season.nc)}</td>
                      <td className="text-right py-2">{formatNumber(season.nbPrime)}</td>
                      <td className={`text-right py-2 font-medium ${
                        season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : ""
                      }`}>
                        {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                      </td>
                      <td className="text-right py-2">{formatNumber(season.djuReel)}</td>
                      <td className="text-center py-2">{getStatusBadge(season.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-text-secondary">
            Aucun historique disponible
          </div>
        )}
      </ChartCard>

      {/* DJU et périodes de chauffage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DJU */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-accent" />
              DJU mensuels
            </span>
          }
        >
          {siteDju && siteDju.monthlyData.length > 0 ? (
            <div>
              <SimpleBarChart
                data={siteDju.monthlyData.map(m => ({
                  label: formatMonthLabel(m.month),
                  value: m.dju,
                }))}
                height={200}
              />
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">DJU réels:</span>
                  <span className="ml-2 font-medium">{formatNumber(siteDju.djuReel)}</span>
                </div>
                <div>
                  <span className="text-text-secondary">DJU trentenaire:</span>
                  <span className="ml-2 font-medium">{formatNumber(siteDju.djuTrentenaire)}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Écart:</span>
                  <span className={`ml-2 font-medium ${siteDju.ecartPercent > 0 ? "text-blue-600" : "text-orange-600"}`}>
                    {siteDju.ecartPercent > 0 ? "+" : ""}{siteDju.ecartPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Station:</span>
                  <span className="ml-2 font-medium">{siteDju.station}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-text-secondary">
              Aucune donnée DJU disponible
            </div>
          )}
        </ChartCard>

        {/* Périodes de chauffage */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-accent" />
              Périodes de chauffage
            </span>
          }
        >
          {heatingSeasons.length > 0 ? (
            <div className="space-y-3">
              {heatingSeasons.slice(0, 5).map((season) => (
                <div key={season.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="font-medium">Saison {season.season}</p>
                    <p className="text-sm text-text-secondary">
                      {new Date(season.startDate).toLocaleDateString("fr-FR")}
                      {" → "}
                      {season.endDate
                        ? new Date(season.endDate).toLocaleDateString("fr-FR")
                        : "En cours"
                      }
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {season.startIndex !== null && (
                      <p>Index départ: {formatNumber(season.startIndex)}</p>
                    )}
                    {season.endIndex !== null && (
                      <p>Index fin: {formatNumber(season.endIndex)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <Calendar className="h-8 w-8 text-text-secondary mb-2" />
              <p className="text-text-secondary">Aucune période définie</p>
              <Link href="/energy?tab=climat">
                <Button variant="outline" size="sm" className="mt-2">
                  Définir les périodes
                </Button>
              </Link>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Actions correctives */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-accent" />
            Actions et recommandations
          </span>
        }
      >
        {actions.length > 0 ? (
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  action.type === "warning"
                    ? "bg-red-50 border-red-200"
                    : action.type === "success"
                      ? "bg-green-50 border-green-200"
                      : action.type === "action"
                        ? "bg-amber-50 border-amber-200"
                        : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="mt-0.5">
                  {action.type === "warning" ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : action.type === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : action.type === "action" ? (
                    <Wrench className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Info className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{action.title}</h4>
                    {action.priority === "high" && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Prioritaire</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    {action.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="font-medium">Tout est en ordre</p>
            <p className="text-sm text-text-secondary">
              Aucune action corrective nécessaire pour ce site.
            </p>
          </div>
        )}
      </ChartCard>

      {/* Informations site */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            Informations du site
          </span>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-text-secondary">Adresse</p>
            <p className="font-medium">{site.address}</p>
            <p className="text-sm">{site.postalCode} {site.city}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Surfaces</p>
            <p className="font-medium">
              {site.surface ? `${formatNumber(site.surface)} m² total` : "-"}
            </p>
            {site.surfaceChauffee && (
              <p className="text-sm">{formatNumber(site.surfaceChauffee)} m² chauffés</p>
            )}
          </div>
          <div>
            <p className="text-sm text-text-secondary">Station météo</p>
            <p className="font-medium">{siteDju?.station || site.stationMeteo || "-"}</p>
            {site.djuContractuel && (
              <p className="text-sm">DJU contractuel: {formatNumber(site.djuContractuel)}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-text-secondary">Compteurs</p>
            {site.pce && <p className="text-sm">PCE: {site.pce}</p>}
            {site.pdl && <p className="text-sm">PDL: {site.pdl}</p>}
            {!site.pce && !site.pdl && <p className="text-sm">-</p>}
          </div>
        </div>

        {site.contractSites.length > 0 && (
          <>
            <div className="border-t my-4" />
            <div>
              <p className="text-sm text-text-secondary mb-2">Contrats associés</p>
              <div className="flex flex-wrap gap-2">
                {site.contractSites.map((cs) => (
                  <span key={cs.contract.id} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    {cs.contract.reference} - {cs.contract.title}
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

function formatMonthLabel(month: string): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [, m] = month.split("-");
  return months[parseInt(m) - 1] || month;
}
