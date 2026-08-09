"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseFrenchDate } from "@/components/administratif/constants";
import type { YearType, BillingFrequency } from "@/components/administratif/types";

interface CreateContractModalProps {
  onClose: () => void;
  clientId?: string;
}

export default function CreateContractModal({ onClose, clientId }: CreateContractModalProps) {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    startDate: "",
    endDate: "",
    yearType: "HEATING_SEASON" as YearType,
    billingFrequency: "TRIMESTRIEL" as BillingFrequency,
    djuContractuel: "",
    isPublic: true, // Secteur public par défaut (collectivités) — P4 alors interdit
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          startDate: parseFrenchDate(formData.startDate),
          endDate: parseFrenchDate(formData.endDate),
          djuContractuel: formData.djuContractuel ? parseFloat(formData.djuContractuel) : null,
          clientId: clientId || null,
        }),
      });
      if (response.ok) {
        const created = await response.json();
        if (created?.id && typeof window !== "undefined") {
          localStorage.setItem("myxploit-selected-contract-id", created.id);
        }
        onClose();
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/10 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">Nouveau contrat</h2>
          <button onClick={onClose} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="label-tech mb-1 block">Référence *</label>
            <input type="text" required value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="MC-2024-001" />
          </div>
          <div>
            <label className="label-tech mb-1 block">Titre *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Marché exploitation CVC" />
          </div>
          <div>
            <label className="label-tech mb-1 block">Titulaire *</label>
            <input type="text" required value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="ENGIE, Dalkia..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-tech mb-1 block">Date début *</label>
              <input type="text" required placeholder="01/01/2024" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="label-tech mb-1 block">Date fin *</label>
              <input type="text" required placeholder="31/12/2035" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="label-tech mb-1 block">Secteur</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPublic: true })}
                className={`border px-3 py-2 text-sm font-medium transition-colors ${
                  formData.isPublic ? "border-accent bg-accent/5 text-accent" : "border-ink/20 bg-white text-ink/60 hover:border-accent/40"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPublic: false })}
                className={`border px-3 py-2 text-sm font-medium transition-colors ${
                  !formData.isPublic ? "border-accent bg-accent/5 text-accent" : "border-ink/20 bg-white text-ink/60 hover:border-accent/40"
                }`}
              >
                Privé
              </button>
            </div>
            <p className="text-xs text-ink/50 mt-1">
              {formData.isPublic ? "Marché public — P4 (financement) interdit." : "Marché privé — P4 autorisé."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-tech mb-1 block">Type année</label>
              <select value={formData.yearType} onChange={(e) => setFormData({ ...formData, yearType: e.target.value as YearType })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                <option value="HEATING_SEASON">Saison de chauffe</option>
                <option value="CIVIL">Année civile</option>
                <option value="CONTRACTUAL">Année contractuelle</option>
              </select>
            </div>
            <div>
              <label className="label-tech mb-1 block">Facturation</label>
              <select value={formData.billingFrequency} onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                <option value="MENSUEL">Mensuel</option>
                <option value="TRIMESTRIEL">Trimestriel</option>
                <option value="SEMESTRIEL">Semestriel</option>
                <option value="ANNUEL">Annuel</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-tech mb-1 block">DJU Contractuels (DJC)</label>
            <input type="number" step="1" value={formData.djuContractuel} onChange={(e) => setFormData({ ...formData, djuContractuel: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none" placeholder="2350" />
            <p className="text-xs text-ink/50 mt-1">Base de référence pour le calcul N&apos;B (importé depuis l&apos;AE si disponible)</p>
          </div>
          <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Annuler</Button>
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
