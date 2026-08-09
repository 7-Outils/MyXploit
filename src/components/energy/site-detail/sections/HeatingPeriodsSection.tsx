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
          <Flame className="h-3.5 w-3.5 text-ink/40" />
          Périodes de chauffage
        </span>
      }
    >
      {validSeasons.length > 0 ? (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {validSeasons.slice(0, 5).map((season) => (
            <div key={season.id} className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">Saison {season.season}</p>
                <p className="font-mono text-xs tabular-nums text-ink/50">
                  {new Date(season.startDate).toLocaleDateString("fr-FR")}
                  {" → "}
                  {season.endDate
                    ? new Date(season.endDate).toLocaleDateString("fr-FR")
                    : "En cours"
                  }
                </p>
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-ink/60">
                {season.startIndex !== null && (
                  <p>Index départ : {formatNumber(season.startIndex)}</p>
                )}
                {season.endIndex !== null && (
                  <p>Index fin : {formatNumber(season.endIndex)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[200px] flex-col items-center justify-center text-center">
          <Calendar className="mb-2 h-6 w-6 text-ink/25" />
          <p className="text-sm text-ink/60">Aucune période définie</p>
          <p className="mt-1 text-xs text-ink/50">
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
