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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Saisir un relevé</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Site *</label>
            <select
              required
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Sélectionner un site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;énergie *</label>
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
              <label className="block text-sm font-medium text-primary-dark mb-1">Usage *</label>
              <select
                required
                value={formData.usage}
                onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="CHAUFFAGE">Chauffage</option>
                <option value="ECS">ECS (Eau chaude)</option>
                <option value="MIXTE">Mixte (Chauff + ECS)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Période *</label>
            <input
              type="month"
              required
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Quantité *</label>
              <div className="flex">
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="12500"
                />
                <span className="px-4 py-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-gray-600">
                  {formData.unit}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">DJU Réels</label>
              <input
                type="number"
                step="0.1"
                value={formData.djuReel}
                onChange={(e) => setFormData({ ...formData, djuReel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="350"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Coût (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
