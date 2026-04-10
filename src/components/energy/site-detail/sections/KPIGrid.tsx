"use client";

import { Zap, Target, TrendingDown, TrendingUp, Thermometer } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { formatNumber, toMWh } from "@/components/energy/site-detail/constants";
import type { SiteDetailData } from "@/components/energy/site-detail/types";

interface KPIGridProps {
  site: SiteDetailData;
  siteAnalytics: {
    nc: number;
    nbPrime: number;
    delta: number;
    deltaPercent: number;
  } | undefined;
  siteDju: {
    djuReel: number;
    djuTrentenaire: number;
  } | undefined;
}

export default function KPIGrid({ site, siteAnalytics, siteDju }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatsCard
        title="NC (Consommation réelle)"
        value={siteAnalytics ? `${toMWh(siteAnalytics.nc)} MWh` : "-"}
        change={site.nb ? `NB: ${formatNumber(site.nb)} MWh` : undefined}
        changeType="neutral"
        icon={Zap}
        iconColor="text-orange-600"
      />
      <StatsCard
        title="N'B (Objectif ajusté)"
        value={siteAnalytics ? `${toMWh(siteAnalytics.nbPrime)} MWh` : "-"}
        change="Ajusté selon DJU réels"
        changeType="neutral"
        icon={Target}
        iconColor="text-blue-600"
      />
      <StatsCard
        title="Écart NC/N'B"
        value={siteAnalytics ? `${siteAnalytics.deltaPercent > 0 ? "+" : ""}${siteAnalytics.deltaPercent.toFixed(1)}%` : "-"}
        change={siteAnalytics ? `${toMWh(siteAnalytics.delta)} MWh` : undefined}
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
  );
}
