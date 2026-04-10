"use client";

import Link from "next/link";
import { Flame, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { formatNumber } from "@/components/energy/site-detail/constants";
import type { SiteHeatingSeason } from "@/components/energy/site-detail/types";

interface HeatingPeriodsSectionProps {
  heatingSeasons: SiteHeatingSeason[];
}

export default function HeatingPeriodsSection({ heatingSeasons }: HeatingPeriodsSectionProps) {
  const today = new Date();
  const validSeasons = heatingSeasons.filter((season) => {
    const startDate = new Date(season.startDate);
    if (startDate > today) return false;
    const isPlaceholder = startDate.getMonth() === 6 && startDate.getDate() === 1
      && season.startIndex === null && season.endIndex === null;
    return !isPlaceholder;
  });

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-accent" />
          Périodes de chauffage
        </span>
      }
    >
      {validSeasons.length > 0 ? (
        <div className="space-y-3">
          {validSeasons.slice(0, 5).map((season) => (
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
          <p className="text-xs text-text-secondary mt-1">
            Les dates d&apos;allumage/arrêt du chauffage n&apos;ont pas été renseignées.
          </p>
          <Link href="/energy?tab=climat">
            <Button variant="outline" size="sm" className="mt-2">
              Définir les périodes
            </Button>
          </Link>
        </div>
      )}
    </ChartCard>
  );
}
