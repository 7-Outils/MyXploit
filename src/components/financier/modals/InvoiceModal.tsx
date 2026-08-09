"use client";

import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
const P1_SUBTYPES = ["Combustible", "ECS", "Location compteur", "Abonnement", "Décompte", "Intéressement", "Autre"];

interface InvoiceFormData {
  reference: string;
  type: "P1" | "P2" | "P3";
  p1SubType: string;
  amount: string;
  issueDate: string;
  description: string;
}

interface InvoiceModalProps {
  onClose: () => void;
  formData: InvoiceFormData;
  setFormData: (data: InvoiceFormData) => void;
  creating: boolean;
  handleCreate: (e: React.FormEvent) => void;
}

export function InvoiceModal({
  onClose,
  formData,
  setFormData,
  creating,
  handleCreate,
}: InvoiceModalProps) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/15 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ink/10">
          <h2 className="text-base font-semibold text-ink">Nouvelle facture</h2>
          <button onClick={onClose} className="p-2 hover:bg-ink/5">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-4 space-y-4">
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
                onChange={(e) => setFormData({ ...formData, type: e.target.value as "P1" | "P2" | "P3", p1SubType: "" })}
                className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
              >
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </div>
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
              </select>
            </div>
          )}

          <div>
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
            <label className="label-tech mb-1.5 block">Date émission *</label>
            <input
              type="date"
              required
              value={formData.issueDate}
              onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="label-tech mb-1.5 block">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
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
