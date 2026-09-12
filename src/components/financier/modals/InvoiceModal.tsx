"use client";

import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  P1_SUBTYPES,
  INVOICE_NATURES,
  natureLabels,
} from "@/components/financier/constants";
import { InvoiceLinesTable } from "@/components/financier/modals/InvoiceLinesTable";
import type {
  InvoiceFormData,
  InvoiceNature,
  InvoiceType,
  Site,
} from "@/components/financier/types";

const INVOICE_TYPES: InvoiceType[] = ["P1", "P2", "P3", "AUTRE"];

interface InvoiceModalProps {
  /** Édition quand true : même formulaire, autre verbe. */
  editing?: boolean;
  onClose: () => void;
  formData: InvoiceFormData;
  setFormData: (data: InvoiceFormData) => void;
  contractSites: Site[];
  saving: boolean;
  error?: string | null;
  handleSubmit: (e: React.FormEvent) => void;
}

export function InvoiceModal({
  editing = false,
  onClose,
  formData,
  setFormData,
  contractSites,
  saving,
  error,
  handleSubmit,
}: InvoiceModalProps) {
  const hasLines = formData.lines.length > 0;
  const parsedAmount = Number.parseFloat(formData.amount);
  const amountHT = Number.isFinite(parsedAmount) ? parsedAmount : null;

  const setLineSite = (index: number, siteId: string) => {
    setFormData({
      ...formData,
      lines: formData.lines.map((line, i) => (i === index ? { ...line, siteId } : line)),
    });
  };

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white border border-ink/15 shadow-large w-full max-h-[90vh] overflow-y-auto ${
          hasLines ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-ink/10">
          <h2 className="text-base font-semibold text-ink">
            {editing ? "Modifier la facture" : "Nouvelle facture"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-ink/5">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">Référence *</label>
              <input
                type="text"
                required
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tech mb-1.5 block">Type *</label>
              <select
                required
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as InvoiceType | "",
                    p1SubType: e.target.value === "P1" ? formData.p1SubType : "",
                  })
                }
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              >
                <option value="">— Sélectionner —</option>
                {INVOICE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nature à côté du type : ce que le document EST (acompte,
              décompte, avoir, intéressement), indépendamment du poste. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">Nature</label>
              <select
                value={formData.nature}
                onChange={(e) =>
                  setFormData({ ...formData, nature: e.target.value as InvoiceNature | "" })
                }
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              >
                <option value="">—</option>
                {INVOICE_NATURES.map((n) => (
                  <option key={n} value={n}>{natureLabels[n]}</option>
                ))}
              </select>
            </div>
            {formData.type === "P1" && (
              <div>
                <label className="label-tech mb-1.5 block">Sous-type P1</label>
                <select
                  value={formData.p1SubType}
                  onChange={(e) => setFormData({ ...formData, p1SubType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {P1_SUBTYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {/* Ancienne valeur (« Décompte », « Intéressement ») retirée
                      de la liste : on la garde affichée plutôt que de la
                      remplacer silencieusement par « — ». */}
                  {formData.p1SubType &&
                    !P1_SUBTYPES.includes(formData.p1SubType as (typeof P1_SUBTYPES)[number]) && (
                      <option value={formData.p1SubType}>{formData.p1SubType}</option>
                    )}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* Tout est HT dans l'application : pas de TVA, pas de TTC. */}
              <label className="label-tech mb-1.5 block">Montant HT (€) *</label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tech mb-1.5 block">Date d&apos;émission *</label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-tech mb-1.5 block">Période facturée — début</label>
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="label-tech mb-1.5 block">Période facturée — fin</label>
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {hasLines ? (
            <InvoiceLinesTable
              lines={formData.lines}
              contractSites={contractSites}
              onChangeSite={setLineSite}
              amountHT={amountHT}
            />
          ) : (
          <div>
            <label className="label-tech mb-1.5 block">
              Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
              className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
            >
              <option value="">Tous les sites</option>
              {contractSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}{site.city ? ` (${site.city})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              Laisser vide si la facture couvre l&apos;ensemble des sites du contrat
            </p>
          </div>
          )}

          <div>
            <label className="label-tech mb-1.5 block">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} type="button">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || !formData.type}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : editing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
