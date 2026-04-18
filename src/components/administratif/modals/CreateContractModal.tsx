"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseFrenchDate } from "@/components/administratif/constants";
import type { YearType, BillingFrequency } from "@/components/administratif/types";

interface CreateContractModalProps {
  onClose: () => void;
}

export default function CreateContractModal({ onClose }: CreateContractModalProps) {
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
        }),
      });
      if (response.ok) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Nouveau contrat</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
            <input type="text" required value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="MC-2024-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Titre *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Marché exploitation CVC" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire *</label>
            <input type="text" required value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="ENGIE, Dalkia..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date début *</label>
              <input type="text" required placeholder="01/01/2024" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date fin *</label>
              <input type="text" required placeholder="31/12/2035" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type année</label>
              <select value={formData.yearType} onChange={(e) => setFormData({ ...formData, yearType: e.target.value as YearType })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                <option value="HEATING_SEASON">Saison de chauffe</option>
                <option value="CIVIL">Année civile</option>
                <option value="CONTRACTUAL">Année contractuelle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Facturation</label>
              <select value={formData.billingFrequency} onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                <option value="MENSUEL">Mensuel</option>
                <option value="TRIMESTRIEL">Trimestriel</option>
                <option value="SEMESTRIEL">Semestriel</option>
                <option value="ANNUEL">Annuel</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">DJU Contractuels (DJC)</label>
            <input type="number" step="1" value={formData.djuContractuel} onChange={(e) => setFormData({ ...formData, djuContractuel: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="2350" />
            <p className="text-xs text-text-secondary mt-1">Base de référence pour le calcul N&apos;B (importé depuis l&apos;AE si disponible)</p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" disabled={creating}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
