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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full border border-ink/15 bg-white shadow-large max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Période de chauffe</h2>
            <p className="text-sm text-text-secondary mt-1">
              {form.siteName} - Saison {form.season}
            </p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 px-5 py-4">
          <div className="border border-ink/10 p-3">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 text-ink/40" size={16} />
              <div>
                <p className="text-sm font-medium text-ink">
                  Dates d&apos;allumage et d&apos;arrêt
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  Ces dates sont transmises par l&apos;exploitant au début de chaque saison.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="label-tech mb-1.5 block">
              Date d&apos;allumage *
            </label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="label-tech mb-1.5 block">
              Date d&apos;arrêt
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink/50">Laissez vide si la saison est en cours</p>
          </div>

          {/* Engagement énergétique (NB) */}
          <div className="mt-4 border-t border-ink/10 pt-4">
            <div className="mb-3 border border-ink/10 p-3">
              <div className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 text-ink/40" size={16} />
                <div>
                  <p className="text-sm font-medium text-ink">
                    Engagement énergétique (NB)
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
                    Niveau de Base de la saison (peut varier avec l&apos;APE)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-tech mb-1.5 block">
                  NB (MWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.nb}
                  onChange={(e) => setForm({ ...form, nb: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                  placeholder="Ex: 150"
                />
              </div>
              <div>
                <label className="label-tech mb-1.5 block">
                  Unité
                </label>
                <select
                  value={form.nbUnit}
                  onChange={(e) => setForm({ ...form, nbUnit: e.target.value as "PCS" | "UTILE" })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="PCS">PCS</option>
                  <option value="UTILE">Utile</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="label-tech mb-1.5 block">
                DJU Contractuels
              </label>
              <input
                type="number"
                step="1"
                value={form.djuContractuel}
                onChange={(e) => setForm({ ...form, djuContractuel: e.target.value })}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                placeholder="Ex: 2450"
              />
              <p className="mt-1 text-xs text-ink/50">Laissez vide pour utiliser les DJU du site</p>
            </div>
          </div>

          <div>
            <label className="label-tech mb-1.5 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none resize-none"
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
