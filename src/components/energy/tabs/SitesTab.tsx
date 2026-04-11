"use client";

import { useEffect, useState } from "react";
import { Building2, Flame, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface MeterReadingRow {
  id: string;
  readingDate: string;
  indexValue: number | null;
  consumption: number | null;
  unit: string;
  consumptionConverted: number | null;
  unitConverted: string | null;
  notes: string | null;
  meter: {
    name: string;
    fluid: string;
    site: { name: string };
  };
}

const FLUID_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "ECS",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

export function SitesContent({
  contractId,
  setShowIdexImportModal,
  setShowCreateModal,
}: {
  contractId: string | null;
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
}) {
  const [readings, setReadings] = useState<MeterReadingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contractId) {
      setReadings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/contracts/${contractId}/readings?limit=20`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setReadings(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReadings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [contractId]);

  return (
    <>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
          <Flame size={18} className="mr-2" />
          Import Exploitant
        </Button>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />
          Saisir relevé
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : readings.length === 0 ? (
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucun relevé de compteur</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title="Derniers relevés">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Compteur</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Date</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Index</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Consommation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-primary-dark">
                      {r.meter.site.name}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-primary-dark">{r.meter.name}</p>
                        <span className="text-xs text-text-secondary">{FLUID_LABELS[r.meter.fluid] || r.meter.fluid}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {new Date(r.readingDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-primary-dark">
                      {r.indexValue !== null ? `${r.indexValue.toLocaleString("fr-FR")} ${r.unit}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-primary-dark">
                      {r.consumption !== null ? (
                        <>
                          {r.consumption.toLocaleString("fr-FR")} {r.unit}
                          {r.consumptionConverted !== null && r.unitConverted && (
                            <span className="text-xs text-text-secondary ml-1">
                              ({r.consumptionConverted.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {r.unitConverted})
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-text-secondary text-xs">1er relevé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </>
  );
}
