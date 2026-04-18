"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseFrenchDate, formatToFrench } from "@/components/administratif/constants";
import type { Contract, YearType, BillingFrequency } from "@/components/administratif/types";

interface EditContractModalProps {
  contractId: string;
  contractDetail: Contract;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export default function EditContractModal({ contractId, contractDetail, onClose, onUpdated }: EditContractModalProps) {
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    reference: contractDetail.reference,
    title: contractDetail.title,
    provider: contractDetail.provider,
    description: contractDetail.description || "",
    startDate: formatToFrench(contractDetail.startDate),
    endDate: formatToFrench(contractDetail.endDate),
    status: contractDetail.status as string,
    yearType: (contractDetail.yearType || "HEATING_SEASON") as YearType,
    billingFrequency: (contractDetail.billingFrequency || "TRIMESTRIEL") as BillingFrequency,
    djuContractuel: contractDetail.djuContractuel?.toString() || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: formData.reference,
          title: formData.title,
          provider: formData.provider,
          description: formData.description || null,
          startDate: parseFrenchDate(formData.startDate),
          endDate: parseFrenchDate(formData.endDate),
          status: formData.status,
          yearType: formData.yearType,
          billingFrequency: formData.billingFrequency,
          djuContractuel: formData.djuContractuel ? parseFloat(formData.djuContractuel) : null,
        }),
      });
      if (response.ok) {
        await onUpdated();
        onClose();
      }
    } catch (error) {
      console.error("Error updating contract:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Modifier le contrat</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
            <input type="text" required value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Titre du contrat *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire (exploitant) *</label>
            <input type="text" required value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date de début *</label>
              <input type="text" required placeholder="01/01/2024" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Date de fin *</label>
              <input type="text" required placeholder="31/12/2035" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Type d&apos;année</label>
              <select value={formData.yearType} onChange={(e) => setFormData({ ...formData, yearType: e.target.value as YearType })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                <option value="HEATING_SEASON">Saison de chauffe (juil. → juin)</option>
                <option value="CIVIL">Année civile (janv. → déc.)</option>
                <option value="CONTRACTUAL">Année contractuelle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">Fréquence de facturation</label>
              <select value={formData.billingFrequency} onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                <option value="MENSUEL">Mensuel (12 éch./an)</option>
                <option value="TRIMESTRIEL">Trimestriel (4 éch./an)</option>
                <option value="SEMESTRIEL">Semestriel (2 éch./an)</option>
                <option value="ANNUEL">Annuel (1 éch./an)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">Statut</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option value="ACTIF">Actif</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="EXPIRE">Expiré</option>
              <option value="RESILIE">Résilié</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">DJU Contractuels (DJC)</label>
            <input type="number" step="1" value={formData.djuContractuel} onChange={(e) => setFormData({ ...formData, djuContractuel: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="2350" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" disabled={updating}>
              {updating ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
