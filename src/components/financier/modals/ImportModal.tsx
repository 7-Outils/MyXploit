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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Importer une facture PDF</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"}`}
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
                <p className="font-medium text-primary-dark">{selectedFile.name}</p>
              </>
            ) : (
              <>
                <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="font-medium text-primary-dark">Cliquez pour sélectionner un PDF</p>
              </>
            )}
          </div>
          {importError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}
          {importPreview && (
            <div className="space-y-4">
              <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
                <Check size={18} className="text-green-600" />
                <span className="text-sm text-green-800">PDF analysé</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">N° Facture *</label>
                <input
                  type="text"
                  value={importFormData.reference}
                  onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value } as typeof importFormData)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type</label>
                  <select
                    value={importFormData.type}
                    onChange={(e) => setImportFormData({ ...importFormData, type: e.target.value as "P1" | "P2" | "P3" })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Montant HT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importFormData.amount}
                    onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date émission</label>
                  <input
                    type="date"
                    value={importFormData.issueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, issueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Date échéance</label>
                  <input
                    type="date"
                    value={importFormData.dueDate}
                    onChange={(e) => setImportFormData({ ...importFormData, dueDate: e.target.value } as typeof importFormData)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
                  {matchedSiteId && <span className="text-green-600 text-xs ml-1">(détecté)</span>}
                </label>
                <select
                  value={importFormData.siteId}
                  onChange={(e) => setImportFormData({ ...importFormData, siteId: e.target.value } as typeof importFormData)}
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
