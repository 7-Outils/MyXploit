"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import type { Site, SiteChartData } from "../types";

const SiteMap = dynamic(
  () => import("@/components/maps/site-map").then((mod) => mod.SiteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[350px] bg-gray-50 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    ),
  }
);

interface PatrimoineSectionProps {
  allSites: Site[];
  sitesWithCoords: Site[];
  siteChartData: SiteChartData;
}

export function PatrimoineSection({
  allSites,
  sitesWithCoords,
  siteChartData,
}: PatrimoineSectionProps) {
  if (allSites.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary-dark flex items-center gap-2">
          <MapPin size={20} className="text-accent" />
          Patrimoine ({allSites.length} sites)
        </h2>
        <span className="text-sm text-text-secondary">
          {sitesWithCoords.length} géolocalisés
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <ChartCard title="Carte des sites" className="lg:col-span-2">
          {sitesWithCoords.length === 0 ? (
            <div className="h-[350px] bg-gray-50 rounded-xl flex flex-col items-center justify-center">
              <MapPin size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-text-secondary">Aucun site géolocalisé</p>
              <p className="text-xs text-gray-400">Les adresses doivent être géocodées</p>
            </div>
          ) : (
            <SiteMap
              sites={sitesWithCoords.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.type,
                address: s.address,
                city: s.city,
                postalCode: s.postalCode,
                latitude: s.latitude,
                longitude: s.longitude,
                energyType: s.energyType,
                contractName: s.contractSites[0]?.contract?.reference || "Sans contrat",
              }))}
              height="350px"
            />
          )}
        </ChartCard>

        {/* Analytics */}
        <div className="space-y-6">
          <ChartCard title="Par type de bâtiment">
            <DonutChart data={siteChartData.byType} size={140} strokeWidth={20} centerValue={allSites.length} centerLabel="sites" />
          </ChartCard>
          <ChartCard title="Par énergie">
            <DonutChart data={siteChartData.byEnergy} size={140} strokeWidth={20} centerValue={allSites.length} centerLabel="sites" />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
