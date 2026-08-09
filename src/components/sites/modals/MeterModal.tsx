"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meter, MeterType, MeterFluid, MeterDataSource } from "../types";
import {
  meterTypeLabels,
  meterFluidLabels,
  dataSourceLabels,
  unitOptions,
} from "../constants";

interface MeterModalProps {
  editingMeter: Meter | null;
  principalMeters: Meter[];
  siteId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function MeterModal({
  editingMeter,
  principalMeters,
  siteId,
  onClose,
  onSaved,
}: MeterModalProps) {
  const [savingMeter, setSavingMeter] = useState(false);
  const [meterForm, setMeterForm] = useState({
    name: editingMeter?.name || "",
    reference: editingMeter?.reference || "",
    type: (editingMeter?.type || "DIVISIONNAIRE") as MeterType,
    fluid: (editingMeter?.fluid || "GAZ") as MeterFluid,
    dataSource: (editingMeter?.dataSource || "MANUEL") as MeterDataSource,
    unit: editingMeter?.unit || "m3",
    parentId: editingMeter?.parentId || "",
    isDeductedFromParent: editingMeter?.isDeductedFromParent || false,
    conversionCoefficient: editingMeter?.conversionCoefficient?.toString() || "",
    conversionUnit: editingMeter?.conversionUnit || "",
  });

  const handleSaveMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeter(true);

    try {
      const payload = {
        name: meterForm.name,
        reference: meterForm.reference || null,
        type: meterForm.type,
        fluid: meterForm.fluid,
        dataSource: meterForm.dataSource,
        unit: meterForm.unit,
        parentId: meterForm.parentId || null,
        isDeductedFromParent: meterForm.isDeductedFromParent,
        conversionCoefficient: meterForm.conversionCoefficient
          ? parseFloat(meterForm.conversionCoefficient)
          : null,
        conversionUnit: meterForm.conversionUnit || null,
      };

      const url = editingMeter
        ? `/api/sites/${siteId}/meters/${editingMeter.id}`
        : `/api/sites/${siteId}/meters`;

      const response = await fetch(url, {
        method: editingMeter ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingMeter(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-ink/15 bg-white shadow-large">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">
            {editingMeter ? "Modifier le compteur" : "Nouveau compteur"}
          </h2>
          <button
            onClick={onClose}
            title="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveMeter} className="space-y-4 px-5 py-4">
          <div>
            <label className="label-tech mb-1.5 block">
              Nom du compteur *
            </label>
            <input
              type="text"
              required
              value={meterForm.name}
              onChange={(e) => setMeterForm({ ...meterForm, name: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Ex: Compteur gaz principal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">
                Type de compteur *
              </label>
              <select
                required
                value={meterForm.type}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, type: e.target.value as MeterType })
                }
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {Object.entries(meterTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-tech mb-1.5 block">
                Fluide *
              </label>
              <select
                required
                value={meterForm.fluid}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, fluid: e.target.value as MeterFluid })
                }
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {Object.entries(meterFluidLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">
                Source des données *
              </label>
              <select
                required
                value={meterForm.dataSource}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, dataSource: e.target.value as MeterDataSource })
                }
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {Object.entries(dataSourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-tech mb-1.5 block">Unité *</label>
              <select
                required
                value={meterForm.unit}
                onChange={(e) => setMeterForm({ ...meterForm, unit: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {unitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label-tech mb-1.5 block">
              Référence (PCE, PDL, n° série)
            </label>
            <input
              type="text"
              value={meterForm.reference}
              onChange={(e) => setMeterForm({ ...meterForm, reference: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Ex: GI123456"
            />
          </div>

          {meterForm.type === "DIVISIONNAIRE" && principalMeters.length > 0 && (
            <>
              <div>
                <label className="label-tech mb-1.5 block">
                  Rattaché au compteur principal
                </label>
                <select
                  value={meterForm.parentId}
                  onChange={(e) => setMeterForm({ ...meterForm, parentId: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Aucun (indépendant)</option>
                  {principalMeters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {meterForm.parentId && (
                <div className="flex items-center gap-3 border border-orange-600/20 bg-orange-50 p-3">
                  <input
                    type="checkbox"
                    id="isDeducted"
                    checked={meterForm.isDeductedFromParent}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, isDeductedFromParent: e.target.checked })
                    }
                    className="h-4 w-4 accent-orange-600"
                  />
                  <label htmlFor="isDeducted" className="text-sm text-orange-800">
                    <span className="font-medium">Déduit du principal</span>
                    <br />
                    <span className="text-orange-700/80">
                      Ce compteur sera soustrait pour calculer le chauffage
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* Conversion coefficient (for ECS) */}
          {meterForm.fluid === "EAU_CHAUDE" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-tech mb-1.5 block">
                  Coefficient Q (MWh/m³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={meterForm.conversionCoefficient}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, conversionCoefficient: e.target.value })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Ex: 0.12"
                />
                <p className="mt-1 font-mono text-[11px] tabular-nums text-ink/50">
                  Entre 0.10 et 0.14 selon le contrat
                </p>
              </div>
              <div>
                <label className="label-tech mb-1.5 block">
                  Unité convertie
                </label>
                <select
                  value={meterForm.conversionUnit}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, conversionUnit: e.target.value })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">-</option>
                  <option value="MWh">MWh</option>
                  <option value="kWh">kWh</option>
                </select>
              </div>
            </div>
          )}

          <div className="-mx-5 flex items-center justify-end gap-2 border-t border-ink/10 px-5 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={savingMeter}>
              {savingMeter ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : editingMeter ? (
                "Modifier"
              ) : (
                "Créer"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
