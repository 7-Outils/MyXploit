"use client";

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Site } from "@/components/energy/types";

interface CreateConsumptionFormData {
  siteId: string;
  energyType: string;
  usage: string;
  period: string;
  quantity: string;
  unit: string;
  cost: string;
  djuReel: string;
}

interface Props {
  formData: CreateConsumptionFormData;
  setFormData: (data: CreateConsumptionFormData) => void;
  sites: Site[];
  creating: boolean;
  handleCreate: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateConsumptionModal({
  formData,
  setFormData,
  sites,
  creating,
  handleCreate,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full border border-ink/15 bg-white shadow-large max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">Saisir un relevé</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 px-5 py-4">
          <div>
            <label className="label-tech mb-1.5 block">Site *</label>
            <select
              required
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Sélectionner un site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">Type d&apos;énergie *</label>
              <select
                required
                value={formData.energyType}
                onChange={(e) => {
                  const type = e.target.value;
                  let unit = "kWh";
                  if (type === "EAU") unit = "m³";
                  if (type === "FIOUL") unit = "L";
                  setFormData({ ...formData, energyType: type, unit });
                }}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="GAZ">Gaz</option>
                <option value="ELECTRICITE">Électricité</option>
                <option value="RESEAU_CHALEUR">Réseau de chaleur</option>
                <option value="FIOUL">Fioul</option>
                <option value="BOIS">Bois</option>
                <option value="EAU">Eau</option>
              </select>
            </div>
            <div>
              <label className="label-tech mb-1.5 block">Usage *</label>
              <select
                required
                value={formData.usage}
                onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="CHAUFFAGE">Chauffage</option>
                <option value="ECS">ECS (Eau chaude)</option>
                <option value="MIXTE">Mixte (Chauff + ECS)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-tech mb-1.5 block">Période *</label>
            <input
              type="month"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">Quantité *</label>
              <div className="flex">
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="flex-1 border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                  placeholder="12500"
                />
                <span className="border border-l-0 border-ink/20 bg-white px-3 py-2 text-sm text-ink/50">
                  {formData.unit}
                </span>
              </div>
            </div>
            <div>
              <label className="label-tech mb-1.5 block">DJU Réels</label>
              <input
                type="number"
                step="0.1"
                value={formData.djuReel}
                onChange={(e) => setFormData({ ...formData, djuReel: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                placeholder="350"
              />
            </div>
          </div>

          <div>
            <label className="label-tech mb-1.5 block">Coût (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
              placeholder="1250.50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={creating}>
              {creating ? (
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
