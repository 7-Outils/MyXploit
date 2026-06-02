"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  File,
  FileSpreadsheet,
  Flame,
  Loader2,
  Plus,
  Save,
  Snowflake,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Devine le type de site à partir de son nom (le reste est complété plus tard dans la fiche)
function guessSiteType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("lycée") || n.includes("lycee")) return "LYCEE";
  if (n.includes("collège") || n.includes("college")) return "COLLEGE";
  if (n.includes("école") || n.includes("ecole") || n.startsWith("g.s") || n.includes("groupe scolaire") || n.includes("maternelle") || n.includes("primaire")) return "ECOLE";
  if (n.includes("mairie") || n.includes("hôtel de ville") || n.includes("hotel de ville")) return "MAIRIE";
  if (n.includes("hôpital") || n.includes("hopital") || n.includes("ehpad")) return "HOPITAL";
  if (n.includes("gymnase") || n.includes("salle de sport")) return "GYMNASE";
  if (n.includes("piscine")) return "PISCINE";
  if (n.includes("médiathèque") || n.includes("mediatheque") || n.includes("bibliothèque") || n.includes("bibliotheque")) return "MEDIATHEQUE";
  return "AUTRE";
}

export function IdexImportModal({
  importing,
  importResult,
  contractId,
  onImport,
  onConfirmImport,
  onClose,
}: {
  importing: boolean;
  contractId: string;
  importResult: {
    mode: "preview" | "import";
    imported?: number;
    updated?: number;
    skipped: number;
    errors: { row: number; site: string; error: string }[];
    totalErrors?: number;
    siteMatches: Record<string, {
      matched: boolean;
      siteId?: string;
      siteName?: string;
      confidence?: number;
      suggestions?: Array<{ id: string; name: string; score: number }>;
      rowCount?: number;
    }>;
    unmatchedSites?: Array<{
      excelName: string;
      rowCount: number;
      suggestions: Array<{ id: string; name: string; score: number }>;
    }>;
    availableSites?: Array<{ id: string; name: string }>;
    preview?: Array<{
      siteId: string;
      siteName: string;
      meters: Array<{
        meterName: string;
        energyType: string;
        usage: string;
        periods: Array<{ period: string; quantity: number; unit: string }>;
        totalQuantity: number;
      }>;
    }>;
  } | null;
  onImport: (file: File, importType: "ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET") => void;
  onConfirmImport: (userMappings: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"ALLUMAGE" | "RELEVE_MENSUEL" | "ARRET">("RELEVE_MENSUEL");
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [mappingsSaved, setMappingsSaved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Sites créés à la volée depuis le mapping (nom seul, rattachés au contrat)
  const [createdSites, setCreatedSites] = useState<Array<{ id: string; name: string }>>([]);
  const [creatingSite, setCreatingSite] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Sans preventDefault, le navigateur ouvre/télécharge le fichier dropé.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /\.(xlsx|xls)$/i.test(file.name)) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onImport(selectedFile, importType);
    }
  };

  const handleMappingChange = (excelName: string, siteId: string) => {
    setManualMappings(prev => ({
      ...prev,
      [excelName]: siteId
    }));
  };

  // Crée un site depuis le nom Excel (type deviné, énergie/adresse à compléter plus tard),
  // le rattache au contrat, puis le sélectionne automatiquement dans le mapping.
  const handleCreateSite = async (excelName: string) => {
    setCreatingSite(excelName);
    setCreateError(null);
    try {
      const siteRes = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: excelName,
          type: guessSiteType(excelName),
          energyType: "AUTRE",
          address: "",
          city: "",
          postalCode: "",
        }),
      });
      const site = await siteRes.json();
      if (!siteRes.ok) {
        setCreateError(site.error || "Erreur lors de la création du site");
        return;
      }

      // Rattachement au contrat courant (sinon le site n'est pas pris en compte à l'import)
      await fetch(`/api/contracts/${contractId}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id, contractType: "MC" }),
      });

      setCreatedSites(prev => [...prev, { id: site.id, name: site.name }]);
      setManualMappings(prev => ({ ...prev, [excelName]: site.id }));
    } catch (error) {
      console.error("Error creating site from mapping:", error);
      setCreateError("Erreur lors de la création du site");
    } finally {
      setCreatingSite(null);
    }
  };

  const handleSaveMappings = async () => {
    const mappingsToSave = Object.entries(manualMappings).filter(([, siteId]) => siteId);
    if (mappingsToSave.length === 0) return;

    setSavingMappings(true);
    try {
      const response = await fetch("/api/site-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mappingsToSave.map(([alias, siteId]) => ({
            alias,
            siteId,
            source: "EXPLOITANT"
          }))
        ),
      });

      if (response.ok) {
        setMappingsSaved(true);
      }
    } catch (error) {
      console.error("Error saving mappings:", error);
    } finally {
      setSavingMappings(false);
    }
  };

  const unmatchedSites = importResult?.unmatchedSites ||
    (importResult ? Object.entries(importResult.siteMatches)
      .filter(([, v]) => !v.matched)
      .map(([excelName, v]) => ({
        excelName,
        rowCount: v.rowCount || 0,
        suggestions: v.suggestions || []
      })) : []);
  const matchedSites = importResult
    ? Object.entries(importResult.siteMatches).filter(([, v]) => v.matched)
    : [];
  const availableSites = [
    ...(importResult?.availableSites || []),
    ...createdSites.filter(cs => !(importResult?.availableSites || []).some(a => a.id === cs.id)),
  ];
  const createdSiteIds = new Set(createdSites.map(s => s.id));
  const hasMappingsToSave = Object.values(manualMappings).some(v => v);

  // Debug
  console.log("Modal - importResult:", importResult);
  console.log("Modal - unmatchedSites:", unmatchedSites);
  console.log("Modal - matchedSites:", matchedSites);
  console.log("Modal - availableSites:", availableSites);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">Import Exploitant</h2>
            <p className="text-sm text-text-secondary mt-1">
              Importez les relevés de consommation de votre exploitant (IDEX, Engie, Dalkia...)
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type d'import selector */}
          {!importResult && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm font-semibold text-primary-dark mb-3">Type d'import</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setImportType("ALLUMAGE")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "ALLUMAGE"
                      ? "border-green-500 bg-green-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-green-300"
                  }`}
                >
                  <div className="text-center">
                    <Flame className={`mx-auto mb-1 ${importType === "ALLUMAGE" ? "text-green-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "ALLUMAGE" ? "text-green-700" : "text-gray-600"}`}>
                      Allumage
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Init. dates démarrage</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("RELEVE_MENSUEL")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "RELEVE_MENSUEL"
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="text-center">
                    <BarChart3 className={`mx-auto mb-1 ${importType === "RELEVE_MENSUEL" ? "text-blue-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "RELEVE_MENSUEL" ? "text-blue-700" : "text-gray-600"}`}>
                      Relevé mensuel
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Conso uniquement</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("ARRET")}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    importType === "ARRET"
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-red-300"
                  }`}
                >
                  <div className="text-center">
                    <Snowflake className={`mx-auto mb-1 ${importType === "ARRET" ? "text-red-600" : "text-gray-400"}`} size={20} />
                    <p className={`text-xs font-medium ${importType === "ARRET" ? "text-red-700" : "text-gray-600"}`}>
                      Arrêt chauffage
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Clôture saison</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Flame className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">Formats exploitants supportés</p>
                <p className="text-xs text-blue-600 mt-1">
                  Fichiers Excel avec colonnes : Date, Site/Installation, Compteur, Conso, Unité, Fluide...
                </p>
                <ul className="text-xs text-blue-600 mt-2 space-y-0.5">
                  <li>• <strong>Gaz</strong> (CPT GAZ, GRDF, Gaz naturel...) → Chauffage P1</li>
                  <li>• <strong>ECS</strong> (Eau chaude, Sanitaire...) → Eau chaude sanitaire</li>
                  <li>• <strong>Électricité</strong> (Enedis, kWh élec...) → Consommation électrique</li>
                  <li>• <strong>Eau appoint</strong> (Remplissage...) → Indicateur maintenance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upload */}
          {!importResult && (
            <label
              className="block cursor-pointer"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging ? "border-accent bg-accent/10"
                : selectedFile ? "border-accent bg-accent/5"
                : "border-gray-300 hover:border-accent"
              }`}>
                <FileSpreadsheet className={`w-12 h-12 mx-auto mb-4 ${selectedFile ? "text-accent" : "text-gray-400"}`} />
                {selectedFile ? (
                  <>
                    <p className="text-lg font-medium text-primary-dark mb-1">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Cliquez pour changer de fichier
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-primary-dark mb-2">
                      Sélectionnez le fichier Excel de l&apos;exploitant
                    </p>
                    <p className="text-sm text-text-secondary">
                      Formats: .xlsx, .xls (IDEX, Engie, Dalkia, etc.)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {/* Preview Mode */}
          {importResult?.mode === "preview" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-blue-600" size={24} />
                  <div>
                    <p className="font-semibold text-primary-dark">Prévisualisation</p>
                    <p className="text-sm text-text-secondary">
                      {importResult.preview?.length || 0} site(s) trouvé(s), {importResult.skipped} ligne(s) ignorée(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview by site with meters */}
              {importResult.preview && importResult.preview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-700 mb-2">
                    Compteurs par site :
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-80 overflow-y-auto space-y-4">
                    {importResult.preview.map((site) => (
                      <div key={site.siteId} className="border-b border-gray-200 pb-3 last:border-0">
                        <p className="font-medium text-primary-dark text-sm mb-2">{site.siteName}</p>
                        <div className="space-y-1 pl-3">
                          {site.meters.map((meter, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                              <div className="flex-1">
                                <span className="font-medium text-gray-700">{meter.meterName || "Sans nom"}</span>
                                <span className="text-gray-500 ml-2">({meter.energyType} - {meter.usage})</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-primary-dark">
                                  {meter.totalQuantity.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} {meter.periods[0]?.unit || "kWh"}
                                </span>
                                <span className="text-gray-500 ml-1">({meter.periods.length} période(s))</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched sites for manual mapping */}
              {unmatchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                    <AlertTriangle size={16} />
                    Sites non reconnus ({unmatchedSites.length})
                  </p>
                  <div className="bg-amber-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-3">
                      {unmatchedSites.map((site) => {
                        const mappedTo = manualMappings[site.excelName];
                        const isCreated = mappedTo ? createdSiteIds.has(mappedTo) : false;
                        return (
                        <div key={site.excelName} className="border-b border-amber-200 pb-2 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-amber-900 truncate">{site.excelName}</p>
                              <p className="text-xs text-amber-600">
                                {site.rowCount} ligne(s)
                                {isCreated && <span className="text-green-700 font-medium"> · site créé</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                className="text-xs border border-amber-300 rounded px-2 py-1 bg-white max-w-[180px]"
                                value={manualMappings[site.excelName] || ""}
                                onChange={(e) => handleMappingChange(site.excelName, e.target.value)}
                              >
                                <option value="">-- Sélectionner --</option>
                                {site.suggestions.length > 0 && (
                                  <optgroup label="Suggestions">
                                    {site.suggestions.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name} ({Math.round(s.score * 100)}%)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="Tous les sites">
                                  {availableSites.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </optgroup>
                              </select>
                              {!mappedTo && (
                                <button
                                  type="button"
                                  onClick={() => handleCreateSite(site.excelName)}
                                  disabled={creatingSite === site.excelName}
                                  title="Créer le site avec ce nom (le reste à compléter plus tard)"
                                  className="flex items-center gap-1 text-xs text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent/10 disabled:opacity-50"
                                >
                                  {creatingSite === site.excelName ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Plus size={12} />
                                  )}
                                  Créer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  {createError && (
                    <p className="mt-2 text-xs text-red-600">{createError}</p>
                  )}
                  {hasMappingsToSave && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveMappings}
                        disabled={savingMappings}
                        className="text-xs"
                      >
                        {savingMappings ? (
                          <><Loader2 size={14} className="mr-1 animate-spin" />Enregistrement...</>
                        ) : mappingsSaved ? (
                          <><Check size={14} className="mr-1" />Enregistré</>
                        ) : (
                          <><Save size={14} className="mr-1" />Enregistrer correspondances</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResult?.mode === "import" && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${
                (importResult.totalErrors || 0) === 0 ? "bg-green-50" : "bg-yellow-50"
              }`}>
                <div className="flex items-center gap-3">
                  {(importResult.totalErrors || 0) === 0 ? (
                    <Check className="text-green-600" size={24} />
                  ) : (
                    <AlertTriangle className="text-yellow-600" size={24} />
                  )}
                  <div>
                    <p className="font-semibold text-primary-dark">Import terminé</p>
                    <p className="text-sm text-text-secondary">
                      {importResult.imported || 0} créés, {importResult.updated || 0} mis à jour, {importResult.skipped} ignorés
                      {(importResult.totalErrors || 0) > 0 && `, ${importResult.totalErrors} erreurs`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched sites */}
              {matchedSites.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Check size={16} />
                    Sites importés ({matchedSites.length})
                  </p>
                  <div className="bg-green-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {matchedSites.map(([idexName, match]) => (
                        <div key={idexName} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate">{idexName}</span>
                          <span className="text-green-700 font-medium ml-2">→ {match.siteName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            {importResult?.mode === "import" ? (
              <Button className="flex-1" onClick={onClose}>Fermer</Button>
            ) : importResult?.mode === "preview" ? (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1 relative"
                  onClick={() => onConfirmImport(manualMappings)}
                  disabled={importing}
                >
                  <span className={`flex items-center justify-center gap-2 ${importing ? "invisible" : ""}`}>
                    <Check size={18} />
                    <span>Confirmer l&apos;import</span>
                  </span>
                  {importing && (
                    <span className="absolute inset-0 flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Import en cours...</span>
                    </span>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Annuler</Button>
                <Button
                  className="flex-1 relative"
                  onClick={handleSubmit}
                  disabled={importing || !selectedFile}
                >
                  <span className={`flex items-center justify-center gap-2 ${importing ? "invisible" : ""}`}>
                    <FileSpreadsheet size={18} />
                    <span>Analyser le fichier</span>
                  </span>
                  {importing && (
                    <span className="absolute inset-0 flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Analyse...</span>
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
