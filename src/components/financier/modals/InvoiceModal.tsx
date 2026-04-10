"use client";

import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Site } from "@/components/financier/types";

interface InvoiceFormData {
  reference: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  amount: string;
  issueDate: string;
  dueDate: string;
  description: string;
  siteId: string;
}

interface InvoiceModalProps {
  onClose: () => void;
  formData: InvoiceFormData;
  setFormData: (data: InvoiceFormData) => void;
  contractSites: Site[];
  loadingContractSites: boolean;
  creating: boolean;
  handleCreate: (e: React.FormEvent) => void;
}

export function InvoiceModal({
  onClose,
  formData,
  setFormData,
  contractSites,
  loadingContractSites,
  creating,
  handleCreate,
}: InvoiceModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Nouvelle facture</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
              <input
                type="text"
                required
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE" })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="P1">P1 - Énergie</option>
                <option value="P2">P2 - Petit entretien</option>
                <option value="P3">P3 - Gros entretien</option>
                <option value="TRAVAUX">Travaux</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Montant HT (€) *</label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date émission *</label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date échéance *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value } as typeof formData)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              disabled={loadingContractSites}
            >
              <option value="">{loadingContractSites ? "Chargement..." : "Tous les sites"}</option>
              {contractSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} {site.city && `(${site.city})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">Laisser vide si la facture concerne tous les sites</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value } as typeof formData)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              rows={2}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} type="button">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={creating}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
