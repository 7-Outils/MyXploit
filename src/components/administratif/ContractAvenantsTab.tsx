"use client";

import { useState } from "react";
import {
  Plus,
  Loader2,
  X,
  FileText,
  Euro,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface AvenantItem {
  id: string;
  type: string;
  effectiveDate: string;
  description: string | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
  newAmountP1: number | null;
  newAmountP2: number | null;
  newAmountP3: number | null;
  contractSite: {
    id: string;
    site: { id: string; name: string; type: string };
  } | null;
  equipment: {
    id: string;
    name: string;
    type: string;
  } | null;
}

interface Avenant {
  id: string;
  reference: string;
  signatureDate: string | null;
  description: string | null;
  items: AvenantItem[];
  _totals: {
    deltaP1: number;
    deltaP2: number;
    deltaP3: number;
    total: number;
  };
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP2: number | null;
  amountP3: number | null;
  exitDate: string | null;
  site: { id: string; name: string; type: string };
}

interface Contract {
  id: string;
  reference: string;
  status: string;
  contractSites: ContractSite[];
  avenants: Avenant[];
}

const contractTypes = [
  { value: "MC", label: "MC - Marché Comptage" },
  { value: "MCI", label: "MCI - Marché Comptage avec Intéressement" },
  { value: "MT", label: "MT - Marché à Température" },
  { value: "MTI", label: "MTI - Marché à Température avec Intéressement" },
  { value: "CP", label: "CP - Combustible et Prestations" },
  { value: "CPI", label: "CPI - Combustible et Prestations avec Intéressement" },
  { value: "PF", label: "PF - Prestation et Forfait" },
  { value: "PFI", label: "PFI - Prestation et Forfait avec Intéressement" },
  { value: "MF", label: "MF - Marché Forfaitaire" },
  { value: "AUTRE", label: "Autre" },
];

const avenantItemTypeLabels: Record<string, string> = {
  AJOUT_SITE: "Ajout de site",
  RETRAIT_SITE: "Retrait de site",
  AJOUT_EQUIPEMENT: "Ajout d'équipement",
  RETRAIT_EQUIPEMENT: "Retrait d'équipement",
  MODIFICATION_PRIX_P1: "Modification P1",
  MODIFICATION_PRIX_P2: "Modification P2",
  MODIFICATION_PRIX_P3: "Modification P3",
  AJOUT_PRESTATION: "Ajout de prestation",
  RETRAIT_PRESTATION: "Retrait de prestation",
  AUTRE: "Autre",
};

interface PriceChangeItem {
  contractSiteId: string;
  siteName: string;
  deltaP2: string;
  deltaP3: string;
  reason: string;
  effectiveDate: string;
}
interface NewSiteItem {
  siteId: string;
  siteName: string;
  contractType: string;
  amountP2: string;
  amountP3: string;
  effectiveDate: string;
}
interface RemovedSiteItem {
  contractSiteId: string;
  siteName: string;
  effectiveDate: string;
}

interface ContractAvenantsTabProps {
  contractId: string;
  contract: Contract;
  onContractUpdate: () => void;
}

export default function ContractAvenantsTab({ contractId, contract, onContractUpdate }: ContractAvenantsTabProps) {
  const [showAvenantModal, setShowAvenantModal] = useState(false);
  const [creatingAvenant, setCreatingAvenant] = useState(false);
  const [availableSites, setAvailableSites] = useState<{ id: string; name: string; type: string }[]>([]);
  const [deletingAvenantId, setDeletingAvenantId] = useState<string | null>(null);

  const [avenantFormData, setAvenantFormData] = useState({
    reference: "", signatureDate: "", description: "",
  });
  const [priceChanges, setPriceChanges] = useState<PriceChangeItem[]>([]);
  const [newSites, setNewSites] = useState<NewSiteItem[]>([]);
  const [removedSites, setRemovedSites] = useState<RemovedSiteItem[]>([]);

  const [tempPriceChange, setTempPriceChange] = useState({
    contractSiteId: "", deltaP2: "", deltaP3: "", reason: "", effectiveDate: "",
  });
  const [tempNewSite, setTempNewSite] = useState({
    siteId: "", contractType: "MC", amountP2: "", amountP3: "", effectiveDate: "",
  });
  const [tempRemovedSite, setTempRemovedSite] = useState({
    contractSiteId: "", effectiveDate: "",
  });

  const fetchAvailableSites = async () => {
    try {
      const response = await fetch("/api/sites");
      if (response.ok) {
        const allSites = await response.json();
        const contractSiteIds = contract?.contractSites.map((cs) => cs.site.id) || [];
        const available = allSites.filter((s: { id: string }) => !contractSiteIds.includes(s.id));
        setAvailableSites(available);
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    }
  };

  const handleDeleteAvenant = async (avenantId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet avenant ? Cette action est irréversible et annulera toutes les modifications apportées par cet avenant.")) {
      return;
    }
    setDeletingAvenantId(avenantId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/avenants/${avenantId}`, { method: "DELETE" });
      if (response.ok) {
        onContractUpdate();
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la suppression de l'avenant");
      }
    } catch (error) {
      console.error("Error deleting avenant:", error);
      alert("Erreur lors de la suppression de l'avenant");
    } finally {
      setDeletingAvenantId(null);
    }
  };

  const handleCreateAvenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (priceChanges.length === 0 && newSites.length === 0 && removedSites.length === 0) {
      alert("Veuillez ajouter au moins une modification (prix, ajout ou retrait de site)");
      return;
    }
    setCreatingAvenant(true);
    try {
      const items: Array<{
        type: string; effectiveDate: string; description?: string;
        contractSiteId?: string; siteId?: string; contractType?: string;
        hasP1?: boolean; hasP2?: boolean; hasP3?: boolean;
        amountP1?: string; amountP2?: string; amountP3?: string;
        deltaP1?: string; deltaP2?: string; deltaP3?: string;
      }> = [];

      for (const pc of priceChanges) {
        if (pc.deltaP2) {
          items.push({ type: "MODIFICATION_PRIX_P2", effectiveDate: pc.effectiveDate, description: pc.reason || undefined, contractSiteId: pc.contractSiteId, deltaP2: pc.deltaP2 });
        }
        if (pc.deltaP3) {
          items.push({ type: "MODIFICATION_PRIX_P3", effectiveDate: pc.effectiveDate, description: pc.reason || undefined, contractSiteId: pc.contractSiteId, deltaP3: pc.deltaP3 });
        }
      }
      for (const ns of newSites) {
        items.push({ type: "AJOUT_SITE", effectiveDate: ns.effectiveDate, siteId: ns.siteId, contractType: ns.contractType, hasP2: true, hasP3: true, amountP2: ns.amountP2 || undefined, amountP3: ns.amountP3 || undefined });
      }
      for (const rs of removedSites) {
        items.push({ type: "RETRAIT_SITE", effectiveDate: rs.effectiveDate, contractSiteId: rs.contractSiteId });
      }

      const response = await fetch(`/api/contracts/${contractId}/avenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: avenantFormData.reference,
          signatureDate: avenantFormData.signatureDate || null,
          description: avenantFormData.description,
          items,
        }),
      });

      if (response.ok) {
        onContractUpdate();
        setShowAvenantModal(false);
        setAvenantFormData({ reference: "", signatureDate: "", description: "" });
        setPriceChanges([]);
        setNewSites([]);
        setRemovedSites([]);
        setTempPriceChange({ contractSiteId: "", deltaP2: "", deltaP3: "", reason: "", effectiveDate: "" });
        setTempNewSite({ siteId: "", contractType: "MC", amountP2: "", amountP3: "", effectiveDate: "" });
        setTempRemovedSite({ contractSiteId: "", effectiveDate: "" });
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la création de l'avenant");
      }
    } catch (error) {
      console.error("Error creating avenant:", error);
      alert("Erreur lors de la création de l'avenant");
    } finally {
      setCreatingAvenant(false);
    }
  };

  const addPriceChange = () => {
    if (!tempPriceChange.contractSiteId || !tempPriceChange.effectiveDate) return;
    const site = contract?.contractSites.find(cs => cs.id === tempPriceChange.contractSiteId);
    if (!site) return;
    setPriceChanges([...priceChanges, { ...tempPriceChange, siteName: site.site.name }]);
    setTempPriceChange({ contractSiteId: "", deltaP2: "", deltaP3: "", reason: "", effectiveDate: "" });
  };

  const addNewSite = () => {
    if (!tempNewSite.siteId || !tempNewSite.effectiveDate) return;
    const site = availableSites.find(s => s.id === tempNewSite.siteId);
    if (!site) return;
    if (newSites.some(ns => ns.siteId === tempNewSite.siteId)) return;
    setNewSites([...newSites, { ...tempNewSite, siteName: site.name }]);
    setTempNewSite({ siteId: "", contractType: "MC", amountP2: "", amountP3: "", effectiveDate: "" });
  };

  const addRemovedSite = () => {
    if (!tempRemovedSite.contractSiteId || !tempRemovedSite.effectiveDate) return;
    const site = contract?.contractSites.find(cs => cs.id === tempRemovedSite.contractSiteId);
    if (!site) return;
    if (removedSites.some(rs => rs.contractSiteId === tempRemovedSite.contractSiteId)) return;
    setRemovedSites([...removedSites, { contractSiteId: tempRemovedSite.contractSiteId, siteName: site.site.name, effectiveDate: tempRemovedSite.effectiveDate }]);
    setTempRemovedSite({ contractSiteId: "", effectiveDate: "" });
  };

  const removePriceChange = (index: number) => setPriceChanges(priceChanges.filter((_, i) => i !== index));
  const removeNewSite = (index: number) => setNewSites(newSites.filter((_, i) => i !== index));
  const removeRemovedSite = (index: number) => setRemovedSites(removedSites.filter((_, i) => i !== index));

  return (
    <>
      <ChartCard
        title={`Avenants (${contract.avenants?.length || 0})`}
        action={
          contract.status !== "RESILIE" && contract.status !== "EXPIRE" ? (
            <Button variant="outline" size="sm" onClick={() => setShowAvenantModal(true)}>
              <Plus size={16} className="mr-1" />
              Nouvel avenant
            </Button>
          ) : null
        }
      >
        {(!contract.avenants || contract.avenants.length === 0) ? (
          <div className="text-center py-10">
            <FileText size={32} className="mx-auto text-ink/25 mb-3" />
            <p className="text-sm text-ink/50 mb-4">Aucun avenant pour ce contrat</p>
            {contract.status !== "RESILIE" && contract.status !== "EXPIRE" && (
              <Button onClick={() => setShowAvenantModal(true)}>
                <Plus size={18} className="mr-2" />
                Créer un avenant
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {contract.avenants.map((avenant) => (
              <div key={avenant.id} className="border border-ink/10 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-ink">{avenant.reference}</h4>
                      <span className="border border-ink/15 bg-ink/[0.03] px-2 py-0.5 text-xs text-ink/60">
                        {avenant.items.length} modification{avenant.items.length > 1 ? "s" : ""}
                      </span>
                      {avenant._totals.total !== 0 && (
                        <span className={`border px-2 py-0.5 font-mono text-xs tabular-nums ${avenant._totals.total > 0 ? "border-red-600/20 bg-red-50 text-red-700" : "border-green-600/20 bg-green-50 text-green-700"}`}>
                          {avenant._totals.total > 0 ? "+" : ""}{avenant._totals.total.toLocaleString("fr-FR")} €/an
                        </span>
                      )}
                    </div>
                    {avenant.signatureDate && (
                      <p className="text-sm text-ink/50 mt-1">Signé le : {new Date(avenant.signatureDate).toLocaleDateString("fr-FR")}</p>
                    )}
                    {avenant.description && (
                      <p className="text-sm text-ink/50 mt-1">{avenant.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteAvenant(avenant.id)}
                      disabled={deletingAvenantId === avenant.id}
                      className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-red-600 disabled:opacity-50"
                      title="Supprimer l'avenant"
                    >
                      {deletingAvenantId === avenant.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>

                {avenant.items && avenant.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ink/10">
                    <p className="label-tech mb-2">Modifications :</p>
                    <div className="border border-ink/10">
                      {avenant.items.map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink/10 px-3 py-2 text-sm last:border-b-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">
                              {avenantItemTypeLabels[item.type] || item.type}
                            </span>
                            <span className="text-ink">{item.contractSite?.site?.name || item.equipment?.name || ""}</span>
                            <span className="text-xs text-ink/50">(effet: {new Date(item.effectiveDate).toLocaleDateString("fr-FR")})</span>
                          </div>
                          <div className="flex gap-3 font-mono text-xs tabular-nums">
                            {item.deltaP1 !== null && item.deltaP1 !== 0 && (
                              <span className={`${item.deltaP1 > 0 ? "text-red-600" : "text-green-600"}`}>P1: {item.deltaP1 > 0 ? "+" : ""}{item.deltaP1.toLocaleString("fr-FR")} €</span>
                            )}
                            {item.deltaP2 !== null && item.deltaP2 !== 0 && (
                              <span className={`${item.deltaP2 > 0 ? "text-red-600" : "text-green-600"}`}>P2: {item.deltaP2 > 0 ? "+" : ""}{item.deltaP2.toLocaleString("fr-FR")} €</span>
                            )}
                            {item.deltaP3 !== null && item.deltaP3 !== 0 && (
                              <span className={`${item.deltaP3 > 0 ? "text-red-600" : "text-green-600"}`}>P3: {item.deltaP3 > 0 ? "+" : ""}{item.deltaP3.toLocaleString("fr-FR")} €</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Create Avenant Modal */}
      {showAvenantModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Nouvel avenant</h2>
              <button onClick={() => { setShowAvenantModal(false); setPriceChanges([]); setNewSites([]); setRemovedSites([]); }} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateAvenant} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Référence *</label>
                  <input type="text" required value={avenantFormData.reference} onChange={(e) => setAvenantFormData({ ...avenantFormData, reference: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Avenant n°1" />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Date de signature</label>
                  <input type="date" value={avenantFormData.signatureDate} onChange={(e) => setAvenantFormData({ ...avenantFormData, signatureDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="label-tech mb-1 block">Description</label>
                <textarea value={avenantFormData.description} onChange={(e) => setAvenantFormData({ ...avenantFormData, description: e.target.value })} rows={2} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Ex: Ajout équipements et modifications tarifaires" />
              </div>

              {/* Modifications de prix */}
              <div className="border border-ink/10 p-4">
                <h3 className="label-tech mb-2 flex items-center gap-2">
                  <Euro size={14} className="text-ink/40" />
                  Modifications de prix ({priceChanges.length})
                </h3>
                {priceChanges.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {priceChanges.map((pc, index) => (
                      <div key={index} className="flex items-center justify-between border border-ink/10 bg-ink/[0.02] px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{pc.siteName}</span>
                          <span className="ml-2 font-mono text-xs tabular-nums text-accent">{new Date(pc.effectiveDate).toLocaleDateString("fr-FR")}</span>
                          <span className="ml-2 font-mono text-xs tabular-nums text-ink/60">
                            {pc.deltaP2 && `P2: ${Number(pc.deltaP2) > 0 ? '+' : ''}${pc.deltaP2}€`}
                            {pc.deltaP2 && pc.deltaP3 && ' | '}
                            {pc.deltaP3 && `P3: ${Number(pc.deltaP3) > 0 ? '+' : ''}${pc.deltaP3}€`}
                          </span>
                        </div>
                        <button type="button" onClick={() => removePriceChange(index)} className="text-ink/40 transition-colors hover:text-red-600"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-ink/10 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select value={tempPriceChange.contractSiteId} onChange={(e) => setTempPriceChange({ ...tempPriceChange, contractSiteId: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                        <option value="">Sélectionner un site</option>
                        {contract.contractSites.filter(cs => !cs.exitDate).map((cs) => (
                          <option key={cs.id} value={cs.id}>{cs.site.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input type="date" value={tempPriceChange.effectiveDate} onChange={(e) => setTempPriceChange({ ...tempPriceChange, effectiveDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <input type="number" step="0.01" placeholder="Delta P2 (€)" value={tempPriceChange.deltaP2} onChange={(e) => setTempPriceChange({ ...tempPriceChange, deltaP2: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <input type="number" step="0.01" placeholder="Delta P3 (€)" value={tempPriceChange.deltaP3} onChange={(e) => setTempPriceChange({ ...tempPriceChange, deltaP3: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                      <input type="text" placeholder="Raison (optionnel)" value={tempPriceChange.reason} onChange={(e) => setTempPriceChange({ ...tempPriceChange, reason: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addPriceChange} disabled={!tempPriceChange.contractSiteId || !tempPriceChange.effectiveDate || (!tempPriceChange.deltaP2 && !tempPriceChange.deltaP3)} className="w-full">
                    <Plus size={16} className="mr-1" />
                    Ajouter modification
                  </Button>
                </div>
              </div>

              {/* Ajout de sites */}
              <div className="border border-ink/10 p-4">
                <h3 className="label-tech mb-2 flex items-center gap-2">
                  <Plus size={14} className="text-ink/40" />
                  Ajout de sites ({newSites.length})
                </h3>
                {newSites.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newSites.map((ns, index) => (
                      <div key={index} className="flex items-center justify-between border border-green-600/20 bg-green-50 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{ns.siteName}</span>
                          <span className="ml-2 font-mono text-xs tabular-nums text-green-700">{new Date(ns.effectiveDate).toLocaleDateString("fr-FR")}</span>
                          <span className="ml-2 font-mono text-xs tabular-nums text-ink/60">
                            {ns.amountP2 && `P2: ${ns.amountP2}€`}
                            {ns.amountP2 && ns.amountP3 && ' | '}
                            {ns.amountP3 && `P3: ${ns.amountP3}€`}
                          </span>
                        </div>
                        <button type="button" onClick={() => removeNewSite(index)} className="text-ink/40 transition-colors hover:text-red-600"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-ink/10 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select value={tempNewSite.siteId} onChange={(e) => setTempNewSite({ ...tempNewSite, siteId: e.target.value })} onFocus={fetchAvailableSites} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                        <option value="">Sélectionner un site à ajouter</option>
                        {availableSites
                          .filter(s => !contract.contractSites.some(cs => cs.site.id === s.id))
                          .filter(s => !newSites.some(ns => ns.siteId === s.id))
                          .map((site) => (<option key={site.id} value={site.id}>{site.name} ({site.type})</option>))}
                      </select>
                    </div>
                    <div>
                      <input type="date" value={tempNewSite.effectiveDate} onChange={(e) => setTempNewSite({ ...tempNewSite, effectiveDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                    <div>
                      <select value={tempNewSite.contractType} onChange={(e) => setTempNewSite({ ...tempNewSite, contractType: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                        {contractTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="0.01" placeholder="P2 (€)" value={tempNewSite.amountP2} onChange={(e) => setTempNewSite({ ...tempNewSite, amountP2: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                      <input type="number" step="0.01" placeholder="P3 (€)" value={tempNewSite.amountP3} onChange={(e) => setTempNewSite({ ...tempNewSite, amountP3: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addNewSite} disabled={!tempNewSite.siteId || !tempNewSite.effectiveDate} className="w-full">
                    <Plus size={16} className="mr-1" />
                    Ajouter site
                  </Button>
                </div>
              </div>

              {/* Retrait de sites */}
              <div className="border border-ink/10 p-4">
                <h3 className="label-tech mb-2 flex items-center gap-2">
                  <X size={14} className="text-ink/40" />
                  Retrait de sites ({removedSites.length})
                </h3>
                {removedSites.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {removedSites.map((rs, index) => (
                      <div key={index} className="flex items-center justify-between border border-red-600/20 bg-red-50 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{rs.siteName}</span>
                          <span className="ml-2 font-mono text-xs tabular-nums text-red-700">{new Date(rs.effectiveDate).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <button type="button" onClick={() => removeRemovedSite(index)} className="text-ink/40 transition-colors hover:text-red-600"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-ink/10 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select value={tempRemovedSite.contractSiteId} onChange={(e) => setTempRemovedSite({ ...tempRemovedSite, contractSiteId: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                      <option value="">Sélectionner un site à retirer</option>
                      {contract.contractSites
                        .filter(cs => !cs.exitDate)
                        .filter(cs => !removedSites.some(rs => rs.contractSiteId === cs.id))
                        .map((cs) => (<option key={cs.id} value={cs.id}>{cs.site.name}</option>))}
                    </select>
                    <input type="date" value={tempRemovedSite.effectiveDate} onChange={(e) => setTempRemovedSite({ ...tempRemovedSite, effectiveDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addRemovedSite} disabled={!tempRemovedSite.contractSiteId || !tempRemovedSite.effectiveDate} className="w-full">
                    <Plus size={16} className="mr-1" />
                    Ajouter au retrait
                  </Button>
                </div>
              </div>

              {(priceChanges.length > 0 || newSites.length > 0 || removedSites.length > 0) && (
                <div className="bg-accent/5 border border-accent/20 p-3">
                  <p className="label-tech mb-1">Résumé de l&apos;avenant :</p>
                  <ul className="text-sm text-ink/70 space-y-1">
                    {priceChanges.length > 0 && <li>• {priceChanges.length} modification(s) de prix</li>}
                    {newSites.length > 0 && <li>• {newSites.length} site(s) à ajouter</li>}
                    {removedSites.length > 0 && <li>• {removedSites.length} site(s) à retirer</li>}
                  </ul>
                </div>
              )}

              <p className="border border-ink/10 p-3 text-xs text-ink/50">
                Le prix sera calculé au prorata selon la date d&apos;effet. Vous pouvez combiner plusieurs types de modifications dans un même avenant.
              </p>

              <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowAvenantModal(false); setPriceChanges([]); setNewSites([]); setRemovedSites([]); }}>Annuler</Button>
                <Button type="submit" size="sm" disabled={creatingAvenant || (priceChanges.length === 0 && newSites.length === 0 && removedSites.length === 0)}>
                  {creatingAvenant ? (<><Loader2 size={18} className="mr-2 animate-spin" />Création...</>) : "Créer l'avenant"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
