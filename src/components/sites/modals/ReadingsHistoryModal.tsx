"use client";

import { X, Loader2, Activity, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meter, MeterReading } from "../types";

interface ReadingsHistoryModalProps {
  meter: Meter;
  readings: MeterReading[];
  loading: boolean;
  onClose: () => void;
}

export function ReadingsHistoryModal({
  meter,
  readings,
  loading,
  onClose,
}: ReadingsHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-ink/15 bg-white shadow-large">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Historique des relevés</h2>
            <p className="mt-0.5 truncate text-sm text-ink/50">{meter.name}</p>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : readings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Activity size={32} className="mb-3 text-ink/20" />
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                Aucun relevé enregistré
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-ink/10">
              <table className="w-full text-sm">
                <thead className="border-b border-ink/10 bg-ink/[0.02]">
                  <tr>
                    <th className="label-tech px-3 py-2 text-left font-normal">Date</th>
                    <th className="label-tech px-3 py-2 text-right font-normal">Index</th>
                    <th className="label-tech px-3 py-2 text-right font-normal">
                      Conso ({meter.unit})
                    </th>
                    {meter.conversionCoefficient && (
                      <th className="label-tech px-3 py-2 text-right font-normal">
                        Converti ({meter.conversionUnit})
                      </th>
                    )}
                    <th className="label-tech px-3 py-2 text-center font-normal">Source</th>
                    <th className="label-tech px-3 py-2 text-center font-normal">Validé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {readings.map((reading) => (
                    <tr key={reading.id} className="hover:bg-ink/[0.02]">
                      <td className="px-3 py-2 font-mono tabular-nums text-ink/70">
                        {new Date(reading.readingDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/70">
                        {reading.indexValue?.toLocaleString("fr-FR") || "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-ink">
                        {reading.consumption?.toLocaleString("fr-FR") || "-"}
                      </td>
                      {meter.conversionCoefficient && (
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/70">
                          {reading.consumptionConverted?.toLocaleString("fr-FR", {
                            maximumFractionDigits: 2,
                          }) || "-"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${
                            reading.source === "API"
                              ? "border-accent/30 bg-accent/[0.06] text-accent"
                              : "border-ink/15 bg-white text-ink/60"
                          }`}
                        >
                          {reading.source === "API" ? "API" : "Manuel"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {reading.isValidated ? (
                          <CheckCircle size={16} className="inline text-green-600" />
                        ) : (
                          <span className="text-ink/30">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-ink/10 px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
