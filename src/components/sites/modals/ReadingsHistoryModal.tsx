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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Historique des relevés</h2>
            <p className="text-sm text-text-secondary">{meter.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : readings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Activity size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary">Aucun relevé enregistré</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-text-secondary">Date</th>
                  <th className="text-right px-4 py-2 font-medium text-text-secondary">Index</th>
                  <th className="text-right px-4 py-2 font-medium text-text-secondary">
                    Conso ({meter.unit})
                  </th>
                  {meter.conversionCoefficient && (
                    <th className="text-right px-4 py-2 font-medium text-text-secondary">
                      Converti ({meter.conversionUnit})
                    </th>
                  )}
                  <th className="text-center px-4 py-2 font-medium text-text-secondary">
                    Source
                  </th>
                  <th className="text-center px-4 py-2 font-medium text-text-secondary">
                    Validé
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {readings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {new Date(reading.readingDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {reading.indexValue?.toLocaleString("fr-FR") || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {reading.consumption?.toLocaleString("fr-FR") || "-"}
                    </td>
                    {meter.conversionCoefficient && (
                      <td className="px-4 py-3 text-right font-mono">
                        {reading.consumptionConverted?.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        }) || "-"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          reading.source === "API"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {reading.source === "API" ? "API" : "Manuel"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {reading.isValidated ? (
                        <CheckCircle size={16} className="text-green-500 inline" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
