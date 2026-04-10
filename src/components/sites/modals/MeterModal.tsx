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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">
            {editingMeter ? "Modifier le compteur" : "Nouveau compteur"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveMeter} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Nom du compteur *
            </label>
            <input
              type="text"
              required
              value={meterForm.name}
              onChange={(e) => setMeterForm({ ...meterForm, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              placeholder="Ex: Compteur gaz principal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Type de compteur *
              </label>
              <select
                required
                value={meterForm.type}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, type: e.target.value as MeterType })
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              >
                {Object.entries(meterTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Fluide *
              </label>
              <select
                required
                value={meterForm.fluid}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, fluid: e.target.value as MeterFluid })
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
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
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Source des données *
              </label>
              <select
                required
                value={meterForm.dataSource}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, dataSource: e.target.value as MeterDataSource })
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              >
                {Object.entries(dataSourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Unité *</label>
              <select
                required
                value={meterForm.unit}
                onChange={(e) => setMeterForm({ ...meterForm, unit: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
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
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Référence (PCE, PDL, n° série)
            </label>
            <input
              type="text"
              value={meterForm.reference}
              onChange={(e) => setMeterForm({ ...meterForm, reference: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              placeholder="Ex: GI123456"
            />
          </div>

          {meterForm.type === "DIVISIONNAIRE" && principalMeters.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Rattaché au compteur principal
                </label>
                <select
                  value={meterForm.parentId}
                  onChange={(e) => setMeterForm({ ...meterForm, parentId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
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
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="isDeducted"
                    checked={meterForm.isDeductedFromParent}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, isDeductedFromParent: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-accent focus:ring-accent"
                  />
                  <label htmlFor="isDeducted" className="text-sm text-orange-800">
                    <span className="font-medium">Déduit du principal</span>
                    <br />
                    <span className="text-orange-600">
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
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Coefficient Q (MWh/m³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={meterForm.conversionCoefficient}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, conversionCoefficient: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  placeholder="Ex: 0.12"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Entre 0.10 et 0.14 selon le contrat
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Unité convertie
                </label>
                <select
                  value={meterForm.conversionUnit}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, conversionUnit: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                >
                  <option value="">-</option>
                  <option value="MWh">MWh</option>
                  <option value="kWh">kWh</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={savingMeter}>
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
