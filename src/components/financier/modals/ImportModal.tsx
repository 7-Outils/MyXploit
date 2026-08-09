"use client";

import {
  Check,
  X,
  Loader2,
  Upload,
  FileUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Site } from "@/components/financier/types";

interface ImportFormData {
  reference: string;
  type: "P1" | "P2" | "P3";
  amount: string;
  issueDate: string;
  dueDate: string;
  description: string;
  siteId: string;
  contractId: string;
}

interface ImportPreview {
  reference: string | null;
  siteName: string | null;
  siteCity: string | null;
  objet: string | null;
  amountHT: number | null;
}

interface ImportModalProps {
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importing: boolean;
  selectedFile: File | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  importPreview: ImportPreview | null;
  importFormData: ImportFormData;
  setImportFormData: (data: ImportFormData) => void;
  matchedSiteId: string | null;
  contractSites: Site[];
  loadingContractSites: boolean;
  creating: boolean;
  handleImportSubmit: () => void;
}

export function ImportModal({
  onClose,
  fileInputRef,
  importing,
  selectedFile,
  handleFileSelect,
  importError,
  importPreview,
  importFormData,
  setImportFormData,
  matchedSiteId,
  contractSites,
  loadingContractSites,
  creating,
  handleImportSubmit,
}: ImportModalProps) {
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/15 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ink/10">
          <h2 className="text-base font-semibold text-ink">Importer une facture PDF</h2>
          <button onClick={onClose} className="p-2 hover:bg-ink/5">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${importing ? "border-ink/10 bg-ink/[0.02]" : "border-ink/20 hover:border-accent hover:bg-accent/5"}`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" disabled={importing} />
            {importing ? (
              <>
                <Loader2 size={40} className="mx-auto text-accent animate-spin mb-3" />
                <p className="text-text-secondary">Analyse du PDF en cours...</p>
              </>
            ) : selectedFile ? (
              <>
                <FileUp size={40} className="mx-auto text-accent mb-3" />
                <p className="font-medium text-ink">{selectedFile.name}</p>
              </>
            ) : (
              <>
                <Upload size={40} className="mx-auto text-ink/40 mb-3" />
                <p className="font-medium text-ink">Cliquez pour sélectionner un PDF</p>
              </>
            )}
          </div>
          {importError && (
            <div className="bg-red-50 text-red-700 p-4 flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}
          {importPreview && (
            <div className="space-y-4">
              <div className="bg-green-50 p-3 flex items-center gap-2">
                <Check size={18} className="text-green-600" />
                <span className="text-sm text-green-700">PDF analysé</span>
              </div>
              <div>
                <label className="label-tech mb-1.5 block">N° Facture *</label>
                <input
                  type="text"
                  value={importFormData.reference}
                  onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value } as typeof importFormData)}
                  className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-1.5 block">Type</label>
                  <select
                    value={importFormData.type}
                    onChange={(e) => setImportFormData({ ...importFormData, type: e.target.value as "P1" | "P2" | "P3" })}
                    className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  >
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
                <div>
                  <label className="label-tech mb-1.5 block">Montant HT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importFormData.amount}
                    onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-1.5 block">Date émission</label>
                  <input
                    type="date"
                    value={importFormData.issueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, issueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1.5 block">Date échéance</label>
                  <input
                    type="date"
                    value={importFormData.dueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, dueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="label-tech mb-1.5 block">
                  Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
                  {matchedSiteId && <span className="text-green-600 text-xs ml-1">(détecté)</span>}
                </label>
                <select
                  value={importFormData.siteId}
                  onChange={(e) => setImportFormData({ ...importFormData, siteId: e.target.value } as typeof importFormData)}
                  className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
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
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            {importPreview && (
              <Button className="flex-1" onClick={handleImportSubmit} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importer"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
