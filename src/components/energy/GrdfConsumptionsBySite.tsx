"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Wifi, Flame, Zap } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  ConsumptionTimeChart,
  type ConsumptionPoint,
} from "@/components/dashboard/consumption-time-chart";

/**
 * GrdfConsumptionsBySite — Show daily consumption charts for every site
 * of a given contract that has a PCE (gas) or PDL (electricity) configured
 * and synced data from the distributor (GRDF / Enedis).
 *
 * The data shown here is the RAW telerelevé data (meterName === null),
 * NOT the exploitant Excel imports. Exploitant data is shown on the
 * Energy tab of each building's detail page.
 */

interface SiteSummary {
  id: string;
  name: string;
  pce: string | null;
  pdl: string | null;
}

interface ConsumptionRecord {
  id: string;
  energyType: string;
  period: string;
  quantity: number;
  meterName: string | null;
}

const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#3b82f6",
};

interface GrdfConsumptionsBySiteProps {
  contractId: string;
}

export function GrdfConsumptionsBySite({ contractId }: GrdfConsumptionsBySiteProps) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  // Fetch sites of the contract that have a PCE or PDL configured
  useEffect(() => {
    let cancelled = false;
    setLoadingSites(true);
    fetch(`/api/contracts/${contractId}/sites`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteSummary[]) => {
        if (cancelled) return;
        setSites(
          (data || []).filter((s) => s.pce !== null || s.pdl !== null)
        );
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (loadingSites) {
    return (
      <ChartCard title="Données par PCE / PDL" subtitle="Relevés télérelevés">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (sites.length === 0) {
    return (
      <ChartCard title="Données par PCE / PDL" subtitle="Relevés télérelevés">
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <Wifi size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            Aucun site avec un PCE ou PDL configuré sur ce contrat
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Renseignez le PCE (gaz) ou le PDL (électricité) sur la fiche de
            chaque bâtiment pour activer la télérelève.
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-primary-dark">
            Données télérelevées par site
          </h3>
          <p className="text-xs text-text-secondary">
            Relevés bruts du distributeur (GRDF, Enedis) — non modifiables
          </p>
        </div>
      </div>

      {sites.map((site) => (
        <SiteGrdfChart key={site.id} site={site} />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Single-site chart card with its own data fetch and date range
// ────────────────────────────────────────────────────────────────────────

function SiteGrdfChart({ site }: { site: SiteSummary }) {
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/consumptions?siteId=${site.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsumptionRecord[]) => {
        if (cancelled) return;
        // Only keep distributor (GRDF/Enedis) data — meterName is null
        // for sync-imported records.
        setRecords((data || []).filter((c) => c.meterName === null));
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [site.id]);

  // Group by energy type so each PCE/PDL gets its own chart
  const byEnergy = useMemo(() => {
    const groups: Record<string, ConsumptionRecord[]> = {};
    for (const r of records) {
      if (!groups[r.energyType]) groups[r.energyType] = [];
      groups[r.energyType].push(r);
    }
    return groups;
  }, [records]);

  const energyTypes = Object.keys(byEnergy).sort();

  return (
    <ChartCard
      title={site.name}
      subtitle={
        [
          site.pce ? `PCE ${site.pce}` : null,
          site.pdl ? `PDL ${site.pdl}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-accent" />
        </div>
      ) : energyTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-text-secondary">
          <Wifi size={28} className="text-gray-300 mb-2" />
          <p className="text-sm">
            En attente des premiers relevés du distributeur
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Le raccordement GRDF prend généralement 24 à 72h après la
            validation du droit d&apos;accès.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {energyTypes.map((energy) => {
            const points: ConsumptionPoint[] = byEnergy[energy]
              .map((r) => ({ date: r.period, kwh: r.quantity }))
              .sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
            const total = points.reduce((s, p) => s + p.kwh, 0);
            const Icon = energy === "GAZ" ? Flame : Zap;
            const color = ENERGY_COLORS[energy] || "#6b7280";
            return (
              <div key={energy}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} style={{ color }} />
                    <span className="text-sm font-medium text-primary-dark">
                      {energy === "GAZ" ? "Gaz" : energy === "ELECTRICITE" ? "Électricité" : energy}
                    </span>
                    <span className="text-xs text-text-secondary">
                      · {points.length} relevé{points.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-text-secondary">
                    Total :{" "}
                    {total >= 5000
                      ? `${(total / 1000).toLocaleString("fr-FR", {
                          maximumFractionDigits: 1,
                        })} MWh`
                      : `${Math.round(total).toLocaleString("fr-FR")} kWh`}
                  </span>
                </div>
                <ConsumptionTimeChart data={points} color={color} height={260} />
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
