"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meter, MeterDataSource } from "../types";

interface ReadingModalProps {
  meter: Meter;
  siteId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ReadingModal({ meter, siteId, onClose, onSaved }: ReadingModalProps) {
  const [savingReading, setSavingReading] = useState(false);
  const [readingForm, setReadingForm] = useState({
    readingDate: new Date().toISOString().split("T")[0],
    indexValue: "",
    consumption: "",
    unit: meter.unit,
    source: "MANUEL" as MeterDataSource,
    notes: "",
  });

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReading(true);

    try {
      const payload = {
        readingDate: readingForm.readingDate,
        indexValue: readingForm.indexValue ? parseFloat(readingForm.indexValue) : null,
        consumption: readingForm.consumption ? parseFloat(readingForm.consumption) : null,
        unit: readingForm.unit,
        source: readingForm.source,
        notes: readingForm.notes || null,
      };

      const response = await fetch(
        `/api/sites/${siteId}/meters/${meter.id}/readings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'ajout du relevé");
      }

      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingReading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Nouveau relevé</h2>
            <p className="text-sm text-text-secondary">{meter.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveReading} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Date du relevé *
            </label>
            <input
              type="date"
              required
              value={readingForm.readingDate}
              onChange={(e) => setReadingForm({ ...readingForm, readingDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Index compteur
              </label>
              <input
                type="number"
                step="0.01"
                value={readingForm.indexValue}
                onChange={(e) => setReadingForm({ ...readingForm, indexValue: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                placeholder="Ex: 12345.67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Consommation ({meter.unit})
              </label>
              <input
                type="number"
                step="0.01"
                value={readingForm.consumption}
                onChange={(e) => setReadingForm({ ...readingForm, consumption: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                placeholder="Ex: 150"
              />
            </div>
          </div>

          {meter.conversionCoefficient && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              La consommation sera convertie automatiquement :
              <br />
              <span className="font-mono">
                × {meter.conversionCoefficient} ={" "}
                {meter.conversionUnit}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Notes</label>
            <textarea
              value={readingForm.notes}
              onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              placeholder="Observations éventuelles..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={savingReading}>
              {savingReading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
