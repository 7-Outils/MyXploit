"use client";

import { useState, useRef } from "react";
import { Loader2, X, FileSpreadsheet, AlertCircle, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseFrenchDate } from "@/components/administratif/constants";
import type { YearType, BillingFrequency } from "@/components/administratif/types";

interface AEImportPreview {
  total: number;
  newSites: number;
  existingSites: number;
  dataSheetName?: string;
  detectedMetadata?: {
    reference?: string; title?: string; provider?: string;
    startDate?: string; endDate?: string;
    yearType?: YearType;
    billingFrequency?: BillingFrequency;
  };
  results: Array<{
    row: number; siteName: string; contractType: string; isNew: boolean;
    existingSiteId?: string; nbValues?: Record<string, number>;
    p1Total?: number; p2Total?: number; p3Total?: number;
  }>;
}

interface AEImportModalProps {
  onClose: () => void;
  contractId?: string;
  clientId?: string;
}

export default function AEImportModal({ onClose, contractId, clientId }: AEImportModalProps) {
  const isUpdate = !!contractId;
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AEImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contractForm, setContractForm] = useState({
    reference: "", title: "", provider: "", startDate: "", endDate: "",
    yearType: "HEATING_SEASON" as YearType,
    billingFrequency: "TRIMESTRIEL" as BillingFrequency,
  });

  const handleClose = () => {
    onClose();
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setPreview(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("preview", "true");
      if (isUpdate && contractId) formData.append("contractId", contractId);
      const url = isUpdate ? "/api/contracts/import-ae" : "/api/contracts/create-from-ae";
      const response = await fetch(url, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Erreur lors de l'analyse"); return; }
      setPreview(result);
      if (result.detectedMetadata) {
        const meta = result.detectedMetadata;
        setContractForm((prev) => ({
          ...prev,
          reference: meta.reference || prev.reference, title: meta.title || prev.title,
          provider: meta.provider || prev.provider, startDate: meta.startDate || prev.startDate,
          endDate: meta.endDate || prev.endDate, yearType: meta.yearType || prev.yearType,
          billingFrequency: meta.billingFrequency || prev.billingFrequency,
        }));
      }
    } catch (err) {
      console.error("Error parsing AE file:", err);
      setError("Erreur lors de la lecture du fichier");
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !preview) return;
    if (!isUpdate && (!contractForm.reference || !contractForm.title || !contractForm.provider || !contractForm.startDate || !contractForm.endDate)) {
      setError("Veuillez remplir tous les champs obligatoires du contrat");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "false");
      if (isUpdate && contractId) {
        formData.append("contractId", contractId);
      } else {
        formData.append("reference", contractForm.reference);
        formData.append("title", contractForm.title);
        formData.append("provider", contractForm.provider);
        formData.append("startDate", parseFrenchDate(contractForm.startDate));
        formData.append("endDate", parseFrenchDate(contractForm.endDate));
        formData.append("yearType", contractForm.yearType);
        formData.append("billingFrequency", contractForm.billingFrequency);
        if (clientId) formData.append("clientId", clientId);
      }
      const url = isUpdate ? "/api/contracts/import-ae" : "/api/contracts/create-from-ae";
      const response = await fetch(url, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) { setError(result.error || (isUpdate ? "Erreur lors de la mise à jour" : "Erreur lors de la création")); return; }
      if (!isUpdate && result?.contract?.id && typeof window !== "undefined") {
        localStorage.setItem("myxploit-selected-contract-id", result.contract.id);
      }
      handleClose();
      window.location.reload();
    } catch (err) {
      console.error("Error creating contract from AE:", err);
      setError("Erreur lors de la création du contrat");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/10 shadow-large w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">
              {isUpdate ? "Compléter le contrat depuis l'AE" : "Créer un contrat depuis l'AE"}
            </h2>
            <p className="mt-0.5 text-xs text-ink/50">
              {isUpdate ? "Mise à jour des sites, NB et montants P2/P3" : "Import des sites, types de contrat, NB et montants P2/P3"}
            </p>
          </div>
          <button onClick={handleClose} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h3 className="label-tech mb-2">1. Sélectionner le fichier AE</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-4 text-center cursor-pointer transition-colors ${importing ? "border-ink/10 bg-ink/[0.02]" : "border-ink/20 hover:border-accent hover:bg-accent/5"}`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" disabled={importing} />
              {importing ? (
                <><Loader2 size={28} className="mx-auto text-accent animate-spin mb-2" /><p className="text-sm text-ink/60">Analyse du fichier en cours...</p></>
              ) : file ? (
                <><FileSpreadsheet size={28} className="mx-auto text-accent mb-2" /><p className="text-sm font-semibold text-ink">{file.name}</p><p className="text-xs text-ink/50 mt-1">Cliquez pour changer de fichier</p></>
              ) : (
                <><FileSpreadsheet size={28} className="mx-auto text-ink/40 mb-2" /><p className="text-sm font-semibold text-ink">Cliquez pour sélectionner le fichier AE (Excel)</p><p className="text-xs text-ink/50 mt-1">Feuilles supportées : &quot;Contrat&quot; (métadonnées) + &quot;P2P3&quot;/&quot;Sites&quot; (données)</p></>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><p>{error}</p>
            </div>
          )}

          {preview && (
            <>
              {!isUpdate && <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="label-tech">2. Informations du contrat</h3>
                  {preview.detectedMetadata && (
                    <span className="flex items-center gap-1 border border-green-600/20 bg-green-50 px-2 py-0.5 text-xs text-green-700"><Check size={12} />Pré-rempli depuis feuille &quot;Contrat&quot;</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-tech mb-1 block">Référence *</label>
                    <input type="text" value={contractForm.reference} onChange={(e) => setContractForm({ ...contractForm, reference: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="MC-2024-001" />
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Titre *</label>
                    <input type="text" value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Marché exploitation CVC" />
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Titulaire *</label>
                    <input type="text" value={contractForm.provider} onChange={(e) => setContractForm({ ...contractForm, provider: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="ENGIE, Dalkia..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-tech mb-1 block">Date début *</label>
                      <input type="text" value={contractForm.startDate} onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="01/01/2024" />
                    </div>
                    <div>
                      <label className="label-tech mb-1 block">Date fin *</label>
                      <input type="text" value={contractForm.endDate} onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="31/12/2035" />
                    </div>
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Type année</label>
                    <select value={contractForm.yearType} onChange={(e) => setContractForm({ ...contractForm, yearType: e.target.value as YearType })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                      <option value="HEATING_SEASON">Saison de chauffe</option>
                      <option value="CIVIL">Année civile</option>
                      <option value="CONTRACTUAL">Année contractuelle</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Facturation</label>
                    <select value={contractForm.billingFrequency} onChange={(e) => setContractForm({ ...contractForm, billingFrequency: e.target.value as BillingFrequency })} className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none">
                      <option value="MENSUEL">Mensuel</option>
                      <option value="TRIMESTRIEL">Trimestriel</option>
                      <option value="SEMESTRIEL">Semestriel</option>
                      <option value="ANNUEL">Annuel</option>
                    </select>
                  </div>
                </div>
              </div>}

              <div>
                <h3 className="label-tech mb-2">{isUpdate ? "2" : "3"}. Sites détectés dans l&apos;AE</h3>
                <div className="mb-3 grid grid-cols-3 divide-x divide-ink/10 border border-ink/10">
                  <div className="px-3 py-2">
                    <p className="label-tech">Sites total</p>
                    <p className="font-mono text-xl tabular-nums text-ink">{preview.total}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="label-tech">Nouveaux sites</p>
                    <p className="font-mono text-xl tabular-nums text-ink">{preview.newSites}</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="label-tech">Sites existants</p>
                    <p className="font-mono text-xl tabular-nums text-ink">{preview.existingSites}</p>
                  </div>
                </div>
                <div className="border border-ink/10 overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white sticky top-0 border-b border-ink/10">
                      <tr>
                        <th className="label-tech px-3 py-2 text-left">#</th>
                        <th className="label-tech px-3 py-2 text-left">Site</th>
                        <th className="label-tech px-3 py-2 text-left">Type</th>
                        <th className="label-tech px-3 py-2 text-left">NB</th>
                        <th className="label-tech px-3 py-2 text-left">P1</th>
                        <th className="label-tech px-3 py-2 text-left">P2</th>
                        <th className="label-tech px-3 py-2 text-left">P3</th>
                        <th className="label-tech px-3 py-2 text-left">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.results.map((result) => (
                        <tr key={result.row} className={result.isNew ? "border-t border-ink/10" : "border-t border-ink/10 bg-ink/[0.02]"}>
                          <td className="px-3 py-2 font-mono tabular-nums text-ink/50">{result.row}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate text-ink/80" title={result.siteName}>{result.siteName}</td>
                          <td className="px-3 py-2"><span className="border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">{result.contractType}</span></td>
                          <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink/80" title={result.nbValues ? Object.entries(result.nbValues).map(([y, v]) => `A${y}: ${v?.toLocaleString("fr-FR")}`).join(", ") : ""}>
                            {result.nbValues && Object.keys(result.nbValues).length > 0 ? `${Object.values(result.nbValues).reduce((sum, v) => sum + (v || 0), 0).toLocaleString("fr-FR")} MWh` : "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink/80">{result.p1Total ? `${result.p1Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink/80">{result.p2Total ? `${result.p2Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink/80">{result.p3Total ? `${result.p3Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2">
                            {result.isNew ? (
                              <span className="flex items-center gap-1 border border-green-600/20 bg-green-50 px-2 py-0.5 text-xs text-green-700"><Plus size={12} /> Nouveau</span>
                            ) : (
                              <span className="flex items-center gap-1 border border-ink/15 bg-ink/[0.03] px-2 py-0.5 text-xs text-ink/60"><Check size={12} /> Existant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel mt-3 p-4">
                  <h4 className="label-tech mb-2">
                    {isUpdate ? "Le contrat sera mis à jour avec :" : "Le contrat sera créé avec :"}
                  </h4>
                  <ul className="text-sm text-ink/70 space-y-1">
                    {isUpdate ? (
                      <li>• {preview.total} site(s) du fichier AE — valeurs NB, P1/P2/P3, qECS mises à jour si présentes</li>
                    ) : (
                      <>
                        <li>• {preview.newSites} nouveau(x) site(s) créé(s)</li>
                        <li>• {preview.existingSites} site(s) existant(s) lié(s)</li>
                      </>
                    )}
                    <li>• Types de contrat par site (PFI, PF, MTI, etc.) déterminant les prestations P1/P2/P3</li>
                    <li>• NB (Niveau de Base) par année de contrat</li>
                    <li>• Montants P1 HT (calculés à l&apos;instant T de l&apos;AE)</li>
                    <li>• Montants P2/P3 détaillés par catégorie (10 sous-composantes)</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
            <Button variant="outline" size="sm" onClick={handleClose}>Annuler</Button>
            {preview && preview.total > 0 && (
              <Button size="sm" onClick={handleSubmit} disabled={importing}>
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isUpdate ? (
                  `Mettre à jour le contrat (${preview.total} site${preview.total > 1 ? "s" : ""})`
                ) : (
                  `Créer le contrat avec ${preview.total} site${preview.total > 1 ? "s" : ""}`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
