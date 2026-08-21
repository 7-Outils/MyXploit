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
    providerEmail: contractDetail.providerEmail || "",
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
          providerEmail: formData.providerEmail.trim() || null,
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
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/10 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">Modifier le contrat</h2>
          <button onClick={onClose} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="label-tech mb-1 block">Référence *</label>
            <input type="text" required value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="label-tech mb-1 block">Titre du contrat *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="label-tech mb-1 block">Titulaire (exploitant) *</label>
            <input type="text" required value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="label-tech mb-1 block">Email exploitant</label>
            <input type="email" value={formData.providerEmail} onChange={(e) => setFormData({ ...formData, providerEmail: e.target.value })} placeholder="contact@exploitant.fr" className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            <p className="mt-1 text-xs text-ink/40">Destinataire des devis acceptés envoyés par email</p>
          </div>
          <div>
            <label className="label-tech mb-1 block">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-tech mb-1 block">Date de début *</label>
              <input type="text" required placeholder="01/01/2024" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="label-tech mb-1 block">Date de fin *</label>
              <input type="text" required placeholder="31/12/2035" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-tech mb-1 block">Type d&apos;année</label>
              <select value={formData.yearType} onChange={(e) => setFormData({ ...formData, yearType: e.target.value as YearType })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                <option value="HEATING_SEASON">Saison de chauffe (juil. → juin)</option>
                <option value="CIVIL">Année civile (janv. → déc.)</option>
                <option value="CONTRACTUAL">Année contractuelle</option>
              </select>
            </div>
            <div>
              <label className="label-tech mb-1 block">Fréquence de facturation</label>
              <select value={formData.billingFrequency} onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                <option value="MENSUEL">Mensuel (12 éch./an)</option>
                <option value="TRIMESTRIEL">Trimestriel (4 éch./an)</option>
                <option value="SEMESTRIEL">Semestriel (2 éch./an)</option>
                <option value="ANNUEL">Annuel (1 éch./an)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label-tech mb-1 block">Statut</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
              <option value="ACTIF">Actif</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="EXPIRE">Expiré</option>
              <option value="RESILIE">Résilié</option>
            </select>
          </div>
          <div>
            <label className="label-tech mb-1 block">DJU Contractuels (DJC)</label>
            <input type="number" step="1" value={formData.djuContractuel} onChange={(e) => setFormData({ ...formData, djuContractuel: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none" placeholder="2350" />
          </div>
          <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Annuler</Button>
            <Button type="submit" size="sm" disabled={updating}>
              {updating ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
