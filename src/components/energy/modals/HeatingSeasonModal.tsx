"use client";

import { BarChart3, Calendar, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeatingSeasonModal({
  form,
  setForm,
  saving,
  handleSave,
  onClose,
}: {
  form: { siteId: string; siteName: string; season: string; startDate: string; endDate: string; notes: string; nb: string; nbUnit: "PCS" | "UTILE"; djuContractuel: string };
  setForm: (f: typeof form) => void;
  saving: boolean;
  handleSave: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Période de chauffe</h2>
            <p className="text-sm text-text-secondary mt-1">
              {form.siteName} - Saison {form.season}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Calendar className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Dates d&apos;allumage et d&apos;arrêt
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Ces dates sont transmises par l&apos;exploitant au début de chaque saison.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Date d&apos;allumage *
            </label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Date d&apos;arrêt
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="text-xs text-gray-500 mt-1">Laissez vide si la saison est en cours</p>
          </div>

          {/* Engagement énergétique (NB) */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <div className="bg-amber-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="text-amber-600 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Engagement énergétique (NB)
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Niveau de Base de la saison (peut varier avec l&apos;APE)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  NB (MWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.nb}
                  onChange={(e) => setForm({ ...form, nb: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Ex: 150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Unité
                </label>
                <select
                  value={form.nbUnit}
                  onChange={(e) => setForm({ ...form, nbUnit: e.target.value as "PCS" | "UTILE" })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="PCS">PCS</option>
                  <option value="UTILE">Utile</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-primary-dark mb-1">
                DJU Contractuels
              </label>
              <input
                type="number"
                step="1"
                value={form.djuContractuel}
                onChange={(e) => setForm({ ...form, djuContractuel: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Ex: 2450"
              />
              <p className="text-xs text-gray-500 mt-1">Laissez vide pour utiliser les DJU du site</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              placeholder="Observations, APE appliquée..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !form.startDate}>
              {saving ? (
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
