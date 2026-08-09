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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full max-w-md border border-ink/15 bg-white shadow-large">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Nouveau relevé</h2>
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

        <form onSubmit={handleSaveReading} className="space-y-4 px-5 py-4">
          <div>
            <label className="label-tech mb-1.5 block">
              Date du relevé *
            </label>
            <input
              type="date"
              required
              value={readingForm.readingDate}
              onChange={(e) => setReadingForm({ ...readingForm, readingDate: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">
                Index compteur
              </label>
              <input
                type="number"
                step="0.01"
                value={readingForm.indexValue}
                onChange={(e) => setReadingForm({ ...readingForm, indexValue: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
                placeholder="Ex: 12345.67"
              />
            </div>
            <div>
              <label className="label-tech mb-1.5 block">
                Consommation ({meter.unit})
              </label>
              <input
                type="number"
                step="0.01"
                value={readingForm.consumption}
                onChange={(e) => setReadingForm({ ...readingForm, consumption: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
                placeholder="Ex: 150"
              />
            </div>
          </div>

          {meter.conversionCoefficient && (
            <div className="border border-ink/15 bg-ink/[0.02] p-3 text-sm text-ink/70">
              La consommation sera convertie automatiquement :
              <br />
              <span className="font-mono tabular-nums text-ink">
                × {meter.conversionCoefficient} ={" "}
                {meter.conversionUnit}
              </span>
            </div>
          )}

          <div>
            <label className="label-tech mb-1.5 block">Notes</label>
            <textarea
              value={readingForm.notes}
              onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })}
              rows={2}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Observations éventuelles..."
            />
          </div>

          <div className="-mx-5 flex items-center justify-end gap-2 border-t border-ink/10 px-5 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={savingReading}>
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
