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
}

export default function AEImportModal({ onClose, contractId }: AEImportModalProps) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">
              {isUpdate ? "Compléter le contrat depuis l'AE" : "Créer un contrat depuis l'AE"}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {isUpdate ? "Mise à jour des sites, NB et montants P2/P3" : "Import des sites, types de contrat, NB et montants P2/P3"}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-medium text-primary-dark mb-3">1. Sélectionner le fichier AE</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"}`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" disabled={importing} />
              {importing ? (
                <><Loader2 size={32} className="mx-auto text-accent animate-spin mb-2" /><p className="text-text-secondary">Analyse du fichier en cours...</p></>
              ) : file ? (
                <><FileSpreadsheet size={32} className="mx-auto text-accent mb-2" /><p className="font-medium text-primary-dark">{file.name}</p><p className="text-xs text-text-secondary mt-1">Cliquez pour changer de fichier</p></>
              ) : (
                <><FileSpreadsheet size={32} className="mx-auto text-gray-400 mb-2" /><p className="font-medium text-primary-dark">Cliquez pour sélectionner le fichier AE (Excel)</p><p className="text-sm text-text-secondary mt-1">Feuilles supportées : &quot;Contrat&quot; (métadonnées) + &quot;P2P3&quot;/&quot;Sites&quot; (données)</p></>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" /><p>{error}</p>
            </div>
          )}

          {preview && (
            <>
              {!isUpdate && <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-primary-dark">2. Informations du contrat</h3>
                  {preview.detectedMetadata && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1"><Check size={12} />Pré-rempli depuis feuille &quot;Contrat&quot;</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">Référence *</label>
                    <input type="text" value={contractForm.reference} onChange={(e) => setContractForm({ ...contractForm, reference: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="MC-2024-001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">Titre *</label>
                    <input type="text" value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Marché exploitation CVC" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">Titulaire *</label>
                    <input type="text" value={contractForm.provider} onChange={(e) => setContractForm({ ...contractForm, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="ENGIE, Dalkia..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">Date début *</label>
                      <input type="text" value={contractForm.startDate} onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="01/01/2024" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">Date fin *</label>
                      <input type="text" value={contractForm.endDate} onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="31/12/2035" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">Type année</label>
                    <select value={contractForm.yearType} onChange={(e) => setContractForm({ ...contractForm, yearType: e.target.value as YearType })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                      <option value="HEATING_SEASON">Saison de chauffe</option>
                      <option value="CIVIL">Année civile</option>
                      <option value="CONTRACTUAL">Année contractuelle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">Facturation</label>
                    <select value={contractForm.billingFrequency} onChange={(e) => setContractForm({ ...contractForm, billingFrequency: e.target.value as BillingFrequency })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                      <option value="MENSUEL">Mensuel</option>
                      <option value="TRIMESTRIEL">Trimestriel</option>
                      <option value="SEMESTRIEL">Semestriel</option>
                      <option value="ANNUEL">Annuel</option>
                    </select>
                  </div>
                </div>
              </div>}

              <div>
                <h3 className="font-medium text-primary-dark mb-3">{isUpdate ? "2" : "3"}. Sites détectés dans l&apos;AE</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-dark">{preview.total}</p>
                    <p className="text-xs text-text-secondary">Sites total</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{preview.newSites}</p>
                    <p className="text-xs text-green-700">Nouveaux sites</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{preview.existingSites}</p>
                    <p className="text-xs text-blue-700">Sites existants</p>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">#</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">Site</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">NB</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">P1</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">P2</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">P3</th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.results.map((result) => (
                        <tr key={result.row} className={result.isNew ? "" : "bg-blue-50/50"}>
                          <td className="px-3 py-2">{result.row}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={result.siteName}>{result.siteName}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{result.contractType}</span></td>
                          <td className="px-3 py-2 text-xs" title={result.nbValues ? Object.entries(result.nbValues).map(([y, v]) => `A${y}: ${v?.toLocaleString("fr-FR")}`).join(", ") : ""}>
                            {result.nbValues && Object.keys(result.nbValues).length > 0 ? `${Object.values(result.nbValues).reduce((sum, v) => sum + (v || 0), 0).toLocaleString("fr-FR")} MWh` : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs">{result.p1Total ? `${result.p1Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2 text-xs">{result.p2Total ? `${result.p2Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2 text-xs">{result.p3Total ? `${result.p3Total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "-"}</td>
                          <td className="px-3 py-2">
                            {result.isNew ? (
                              <span className="text-xs text-green-600 flex items-center gap-1"><Plus size={12} /> Nouveau</span>
                            ) : (
                              <span className="text-xs text-blue-600 flex items-center gap-1"><Check size={12} /> Existant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <h4 className="font-medium text-blue-800 mb-2">
                    {isUpdate ? "Le contrat sera mis à jour avec :" : "Le contrat sera créé avec :"}
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
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

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Annuler</Button>
            {preview && preview.total > 0 && (
              <Button className="flex-1" onClick={handleSubmit} disabled={importing}>
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
