"use client";

import {
  Check,
  X,
  Loader2,
  Upload,
  FileUp,
  FileText,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { P1_SUBTYPES } from "@/components/financier/constants";
import type { InvoiceFormData, InvoiceType, Site } from "@/components/financier/types";

const INVOICE_TYPES: InvoiceType[] = ["P1", "P2", "P3", "TRAVAUX", "AUTRE"];

interface ImportModalProps {
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  importing: boolean;
  selectedFile: File | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importError: string | null;
  /** Le PDF a été traité : le formulaire est affiché, même si l'IA a échoué. */
  importReady: boolean;
  /** Origine du pré-remplissage : lecture IA, ou rien du tout. */
  importSource: "ia" | "degrade" | null;
  importAiError: string | null;
  /** URL R2 du PDF, joint à la facture créée. */
  importedPdfUrl: string | null;
  importFormData: InvoiceFormData;
  setImportFormData: (data: InvoiceFormData) => void;
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
  importReady,
  importSource,
  importAiError,
  importedPdfUrl,
  importFormData,
  setImportFormData,
  matchedSiteId,
  contractSites,
  loadingContractSites,
  creating,
  handleImportSubmit,
}: ImportModalProps) {
  const missingDate = !importFormData.issueDate;
  const missingType = !importFormData.type;

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
          {importReady && (
            <div className="space-y-4">
              {/* Confirmation de lecture : seulement quand l'IA a réellement
                  lu le document. Annoncer « PDF analysé » sur un formulaire
                  vide ferait croire à des valeurs vérifiées. */}
              {importSource === "ia" && (
                <div className="bg-green-50 p-3 flex items-center gap-2">
                  <Check size={18} className="text-green-600" />
                  <span className="text-sm text-green-700">PDF analysé</span>
                </div>
              )}
              {importSource === "degrade" && (
                <div className="flex items-start gap-2 border border-[#f0b429]/40 bg-[rgba(250,178,25,0.10)] px-3 py-2 text-xs text-[#8a6200]">
                  <AlertTriangle size={14} className="mt-px flex-shrink-0" />
                  <span>
                    Lecture IA indisponible
                    {importAiError ? ` (${importAiError})` : ""}. Le PDF est
                    joint : renseignez les champs à la main.
                  </span>
                </div>
              )}
              {importedPdfUrl && (
                <div className="flex items-center gap-2 px-3 py-2 bg-ink/[0.02] border border-ink/10 text-xs text-ink/60">
                  <FileText size={14} className="flex-shrink-0 text-accent" />
                  Le PDF original sera joint à la facture
                </div>
              )}
              <div>
                <label className="label-tech mb-1.5 block">N° Facture *</label>
                <input
                  type="text"
                  value={importFormData.reference}
                  onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value })}
                  className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-1.5 block">Type *</label>
                  <select
                    value={importFormData.type}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        type: e.target.value as InvoiceType | "",
                        p1SubType: e.target.value === "P1" ? importFormData.p1SubType : "",
                      })
                    }
                    className={`w-full px-4 py-2.5 border focus:border-accent focus:outline-none ${
                      missingType ? "border-[#f0b429] bg-[rgba(250,178,25,0.08)]" : "border-ink/20"
                    }`}
                  >
                    <option value="">— Sélectionner —</option>
                    {INVOICE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {missingType && (
                    <p className="mt-1 text-[11px] text-[#8a6200]">
                      Non détecté sur le PDF — à choisir
                    </p>
                  )}
                </div>
                <div>
                  <label className="label-tech mb-1.5 block">Montant HT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importFormData.amount}
                    onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value })}
                    className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              {importFormData.type === "P1" && (
                <div>
                  <label className="label-tech mb-1.5 block">Sous-type P1</label>
                  <select
                    value={importFormData.p1SubType}
                    onChange={(e) => setImportFormData({ ...importFormData, p1SubType: e.target.value })}
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
                <label className="label-tech mb-1.5 block">Date d&apos;émission *</label>
                <input
                  type="date"
                  value={importFormData.issueDate}
                  onChange={(e) => setImportFormData({ ...importFormData, issueDate: e.target.value })}
                  className={`w-full px-4 py-2.5 border focus:border-accent focus:outline-none ${
                    missingDate ? "border-[#f0b429] bg-[rgba(250,178,25,0.08)]" : "border-ink/20"
                  }`}
                />
                {missingDate && (
                  <p className="mt-1 text-[11px] text-[#8a6200]">
                    Non détectée sur le PDF — à saisir
                  </p>
                )}
              </div>
              <div>
                <label className="label-tech mb-1.5 block">
                  Site <span className="text-xs text-text-secondary font-normal">(optionnel)</span>
                  {matchedSiteId && <span className="text-green-600 text-xs ml-1">(détecté)</span>}
                </label>
                <select
                  value={importFormData.siteId}
                  onChange={(e) => setImportFormData({ ...importFormData, siteId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-ink/20 focus:border-accent focus:outline-none"
                  disabled={loadingContractSites}
                >
                  <option value="">{loadingContractSites ? "Chargement..." : "Tous les sites"}</option>
                  {contractSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}{site.city ? ` (${site.city})` : ""}
                    </option>
                  ))}
                  {/* Site rapproché pas encore dans la liste (chargement) : on
                      le garde affiché plutôt que de retomber sur « Tous ». */}
                  {importFormData.siteId &&
                    !contractSites.some((s) => s.id === importFormData.siteId) && (
                      <option value={importFormData.siteId}>…</option>
                    )}
                </select>
                <p className="text-xs text-text-secondary mt-1">Laisser vide si la facture concerne tous les sites</p>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            {importReady && (
              <Button
                className="flex-1"
                onClick={handleImportSubmit}
                disabled={creating || missingDate || missingType}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importer"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
