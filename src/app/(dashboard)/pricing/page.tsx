"use client";

import { useState, useCallback } from "react";
import {
  Calculator,
  Upload,
  FileSpreadsheet,
  Wrench,
  Download,
  Loader2,
  Check,
  Plus,
  Trash2,
  Building2,
  Save,
  FolderPlus,
  X,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  calculateMarketDimensioning,
  EquipmentForPricing,
  EQUIPMENT_TYPE_LABELS,
  P2_HOURS_BY_TYPE,
  HOURLY_RATES,
} from "@/lib/pricing/equipment-pricing";
import { EquipmentType } from "@/generated/prisma/client";

const EQUIPMENT_TYPES = Object.keys(P2_HOURS_BY_TYPE).filter((t) => t !== "AUTRE");

interface EquipmentEntry extends EquipmentForPricing {
  siteName: string;
}

interface ImportedSite {
  name: string;
  type: string;
  address?: string;
  city?: string;
  postalCode?: string;
  equipmentCount: number;
}

interface ImportedEquipment {
  siteName: string;
  siteType?: string;
  equipmentType: string;
  equipmentTypeParsed: string;
  equipmentName?: string;
  domain?: string;
  power?: number;
  quantity?: number;
  year?: number;
  brand?: string;
  model?: string;
  location?: string;
  theoreticalLifespan?: number;
  status: "ok" | "warning" | "error";
  message?: string;
  rowNumber: number;
}

interface PricingResult {
  totalP2Annual: number;
  totalP3GEAnnual: number;
  totalP3RAnnual: number;
  totalP3Annual: number;
  totalAnnual: number;
  totalHoursP2: number;
  totalContract: number;
  margin: number;
  finalPrice: number;
}

export default function PricingPage() {
  const [equipments, setEquipments] = useState<EquipmentEntry[]>([]);
  const [duration, setDuration] = useState(8);
  const [marginPercent, setMarginPercent] = useState(15);
  const [result, setResult] = useState<PricingResult | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedSites, setImportedSites] = useState<ImportedSite[]>([]);
  const [importedEquipments, setImportedEquipments] = useState<ImportedEquipment[]>([]);
  const [importErrors, setImportErrors] = useState<ImportedEquipment[]>([]);

  // Save to DB state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedProject, setSavedProject] = useState<{ contractId: string; reference: string } | null>(null);

  // Manual entry form
  const [newEntry, setNewEntry] = useState({
    siteName: "",
    type: "CHAUDIERE" as EquipmentType,
    power: "",
    quantity: "1",
    year: new Date().getFullYear().toString(),
  });

  const calculatePricing = useCallback(() => {
    if (equipments.length === 0) return;

    const dimensioning = calculateMarketDimensioning(
      equipments,
      duration,
      new Date().getFullYear()
    );

    const totalContract = dimensioning.totalAnnual * duration;
    const margin = totalContract * (marginPercent / 100);
    const finalPrice = totalContract + margin;

    setResult({
      totalP2Annual: dimensioning.totalP2Annual,
      totalP3GEAnnual: dimensioning.totalP3GEAnnual,
      totalP3RAnnual: dimensioning.totalP3RAnnual,
      totalP3Annual: dimensioning.totalP3Annual,
      totalAnnual: dimensioning.totalAnnual,
      totalHoursP2: dimensioning.totalHoursP2,
      totalContract,
      margin,
      finalPrice,
    });
  }, [equipments, duration, marginPercent]);

  const addEquipment = () => {
    if (!newEntry.siteName || !newEntry.type) return;

    const entry: EquipmentEntry = {
      id: `manual-${Date.now()}`,
      type: newEntry.type,
      power: newEntry.power ? parseFloat(newEntry.power) : null,
      quantity: parseInt(newEntry.quantity) || 1,
      year: parseInt(newEntry.year) || new Date().getFullYear(),
      siteName: newEntry.siteName,
    };

    setEquipments((prev) => [...prev, entry]);
    setNewEntry({
      siteName: newEntry.siteName,
      type: "CHAUDIERE",
      power: "",
      quantity: "1",
      year: new Date().getFullYear().toString(),
    });
    setResult(null);
  };

  const removeEquipment = (id: string) => {
    setEquipments((prev) => prev.filter((e) => e.id !== id));
    setResult(null);
  };

  const clearAll = () => {
    setEquipments([]);
    setResult(null);
    setImportedSites([]);
    setImportedEquipments([]);
    setImportErrors([]);
    setSavedProject(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pricing/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erreur lors de l'import");
        return;
      }

      // Store imported data
      setImportedSites(data.sites || []);
      setImportedEquipments(data.equipments || []);
      setImportErrors(data.errors || []);

      // Convert to equipment entries for pricing
      const newEquipments: EquipmentEntry[] = (data.equipments || [])
        .filter((eq: ImportedEquipment) => eq.status !== "error")
        .map((eq: ImportedEquipment, index: number) => ({
          id: `import-${index}-${Date.now()}`,
          type: eq.equipmentType as EquipmentType,
          power: eq.power || null,
          quantity: eq.quantity || 1,
          year: eq.year || new Date().getFullYear() - 10,
          siteName: eq.siteName,
          domain: eq.domain,
          theoreticalLifespan: eq.theoreticalLifespan,
        }));

      setEquipments((prev) => [...prev, ...newEquipments]);
      setShowImport(false);
      setResult(null);
    } catch (error) {
      console.error("Import error:", error);
      alert("Erreur lors de l'import du fichier");
    } finally {
      setImporting(false);
    }
  };

  const saveProject = async () => {
    if (!projectName.trim()) return;

    setSaving(true);
    try {
      // Re-upload with save flag
      const equipmentData = equipments.map((eq) => ({
        siteName: eq.siteName,
        equipmentType: eq.type,
        power: eq.power,
        quantity: eq.quantity,
        year: eq.year,
        theoreticalLifespan: eq.theoreticalLifespan,
      }));

      // Group by site
      const siteMap = new Map<string, typeof equipmentData>();
      for (const eq of equipmentData) {
        const existing = siteMap.get(eq.siteName) || [];
        existing.push(eq);
        siteMap.set(eq.siteName, existing);
      }

      // Create JSON data for backend
      const sitesData = Array.from(siteMap.entries()).map(([name, eqs]) => ({
        name,
        equipments: eqs,
      }));

      const response = await fetch("/api/pricing/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          sites: sitesData,
          duration,
          marginPercent,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSavedProject({
          contractId: data.contractId,
          reference: data.contractReference,
        });
        setShowSaveDialog(false);
      } else {
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const exportQuote = () => {
    if (!result) return;

    let quote = `CHIFFRAGE APPEL D'OFFRES CVC\n`;
    quote += `${"=".repeat(50)}\n\n`;
    quote += `Date: ${new Date().toLocaleDateString("fr-FR")}\n`;
    quote += `Durée du marché: ${duration} ans\n`;
    quote += `Équipements: ${equipments.length}\n\n`;

    // Group by site
    const bySite = new Map<string, EquipmentEntry[]>();
    equipments.forEach((eq) => {
      const existing = bySite.get(eq.siteName) || [];
      existing.push(eq);
      bySite.set(eq.siteName, existing);
    });

    quote += `DÉTAIL PAR SITE (${bySite.size} sites)\n`;
    quote += `${"-".repeat(30)}\n`;
    bySite.forEach((eqs, siteName) => {
      quote += `\n${siteName}: ${eqs.length} équipements\n`;
      eqs.forEach((eq) => {
        quote += `  - ${EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}`;
        if (eq.quantity && eq.quantity > 1) quote += ` x${eq.quantity}`;
        if (eq.power) quote += ` (${eq.power} kW)`;
        if (eq.year) quote += ` [${eq.year}]`;
        quote += `\n`;
      });
    });

    quote += `\n\nCHIFFRAGE\n`;
    quote += `${"-".repeat(30)}\n`;
    quote += `P2 Annuel (Petit entretien): ${result.totalP2Annual.toLocaleString()} €\n`;
    quote += `P3 GE Annuel (Gros entretien): ${result.totalP3GEAnnual.toLocaleString()} €\n`;
    quote += `P3 R Annuel (Renouvellement): ${result.totalP3RAnnual.toLocaleString()} €\n`;
    quote += `Total Annuel: ${result.totalAnnual.toLocaleString()} €\n\n`;
    quote += `Total sur ${duration} ans: ${result.totalContract.toLocaleString()} €\n`;
    quote += `Marge (${marginPercent}%): ${result.margin.toLocaleString()} €\n`;
    quote += `\n${"=".repeat(30)}\n`;
    quote += `PRIX DE VENTE: ${result.finalPrice.toLocaleString()} € HT\n`;
    quote += `${"=".repeat(30)}\n`;
    quote += `\nHeures P2: ${result.totalHoursP2} h/an\n`;

    const blob = new Blob([quote], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chiffrage-ao-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
  };

  // Group equipments by site for display
  const equipmentsBySite = new Map<string, EquipmentEntry[]>();
  equipments.forEach((eq) => {
    const existing = equipmentsBySite.get(eq.siteName) || [];
    existing.push(eq);
    equipmentsBySite.set(eq.siteName, existing);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Chiffrage Appel d&apos;Offres</h1>
          <p className="text-text-secondary">
            Importez les équipements et obtenez un chiffrage instantané
          </p>
        </div>
        <div className="flex gap-2">
          {equipments.length > 0 && (
            <Button variant="outline" onClick={clearAll}>
              <Trash2 size={18} className="mr-2" />
              Tout effacer
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={18} className="mr-2" />
            Importer Excel
          </Button>
          {result && (
            <>
              <Button variant="outline" onClick={() => setShowSaveDialog(true)} disabled={!!savedProject}>
                <Save size={18} className="mr-2" />
                {savedProject ? "Sauvegardé" : "Sauvegarder"}
              </Button>
              <Button onClick={exportQuote}>
                <Download size={18} className="mr-2" />
                Exporter devis
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Saved project banner */}
      {savedProject && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Check className="text-green-600" size={20} />
            <div>
              <p className="font-medium text-green-800">Projet sauvegardé</p>
              <p className="text-sm text-green-600">Référence: {savedProject.reference}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `/contracts/${savedProject.contractId}`}
          >
            Voir le projet
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Equipment Entry */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manual entry */}
          <ChartCard title="Ajouter un équipement">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-primary-dark mb-1">Site</label>
                <input
                  type="text"
                  value={newEntry.siteName}
                  onChange={(e) => setNewEntry({ ...newEntry, siteName: e.target.value })}
                  placeholder="Nom du site"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Type</label>
                <select
                  value={newEntry.type}
                  onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value as EquipmentType })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {EQUIPMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EQUIPMENT_TYPE_LABELS[type] || type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Puissance (kW)</label>
                <input
                  type="number"
                  value={newEntry.power}
                  onChange={(e) => setNewEntry({ ...newEntry, power: e.target.value })}
                  placeholder="Ex: 300"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-primary-dark mb-1">Qté</label>
                  <input
                    type="number"
                    value={newEntry.quantity}
                    onChange={(e) => setNewEntry({ ...newEntry, quantity: e.target.value })}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <Button onClick={addEquipment} disabled={!newEntry.siteName}>
                  <Plus size={18} />
                </Button>
              </div>
            </div>
          </ChartCard>

          {/* Import summary */}
          {importedSites.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet size={18} className="text-blue-600" />
                <span className="font-medium text-blue-800">Import réussi</span>
              </div>
              <p className="text-sm text-blue-700">
                {importedSites.length} sites, {importedEquipments.length} équipements importés
                {importErrors.length > 0 && ` (${importErrors.length} erreurs ignorées)`}
              </p>
            </div>
          )}

          {/* Equipment list */}
          {equipments.length > 0 && (
            <ChartCard
              title={`Équipements (${equipments.length})`}
              subtitle={`${equipmentsBySite.size} site(s)`}
            >
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Array.from(equipmentsBySite.entries()).map(([siteName, siteEquipments]) => (
                  <div key={siteName} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                      <Building2 size={16} className="text-gray-500" />
                      <span className="font-medium text-primary-dark">{siteName}</span>
                      <span className="text-xs text-gray-500">({siteEquipments.length})</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {siteEquipments.map((eq) => (
                        <div key={eq.id} className="px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wrench size={16} className="text-orange-500" />
                            <div>
                              <p className="text-sm font-medium">{EQUIPMENT_TYPE_LABELS[eq.type] || eq.type}</p>
                              <p className="text-xs text-gray-500">
                                {eq.power && `${eq.power} kW`}
                                {eq.quantity && eq.quantity > 1 && ` × ${eq.quantity}`}
                                {eq.year && ` (${eq.year})`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeEquipment(eq.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>

        {/* Pricing config & results */}
        <div className="space-y-6">
          {/* Config */}
          <ChartCard title="Paramètres">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Durée du marché
                </label>
                <select
                  value={duration}
                  onChange={(e) => {
                    setDuration(parseInt(e.target.value));
                    setResult(null);
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {[4, 5, 6, 7, 8, 9, 10, 12, 15].map((y) => (
                    <option key={y} value={y}>{y} ans</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Marge (%)
                </label>
                <input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => {
                    setMarginPercent(parseInt(e.target.value) || 0);
                    setResult(null);
                  }}
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Taux horaire (€/h)
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <p>Technicien: {HOURLY_RATES.TECHNICIEN} €</p>
                  <p>Spécialisé: {HOURLY_RATES.TECHNICIEN_SPECIALISE} €</p>
                  <p>Ingénieur: {HOURLY_RATES.INGENIEUR} €</p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={calculatePricing}
                disabled={equipments.length === 0}
              >
                <Calculator size={18} className="mr-2" />
                Calculer
              </Button>
            </div>
          </ChartCard>

          {/* Results */}
          {result && (
            <ChartCard title="Chiffrage">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">P2 Annuel</p>
                    <p className="text-xs text-gray-400">{result.totalHoursP2}h/an</p>
                  </div>
                  <p className="font-bold text-blue-600">{result.totalP2Annual.toLocaleString()} €</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
                  <p className="text-sm text-gray-600">P3 GE Annuel</p>
                  <p className="font-bold text-accent">{result.totalP3GEAnnual.toLocaleString()} €</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">P3 R Annuel</p>
                  <p className="font-bold text-purple-600">{result.totalP3RAnnual.toLocaleString()} €</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Total annuel</p>
                    <p className="font-medium">{result.totalAnnual.toLocaleString()} €</p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">× {duration} ans</p>
                    <p className="font-medium">{result.totalContract.toLocaleString()} €</p>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">+ Marge {marginPercent}%</p>
                    <p className="font-medium text-green-600">+{result.margin.toLocaleString()} €</p>
                  </div>
                </div>

                <div className="bg-orange-100 p-4 rounded-lg">
                  <p className="text-sm text-orange-800 mb-1">Prix de vente</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {result.finalPrice.toLocaleString()} € HT
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    soit {Math.round(result.finalPrice / duration).toLocaleString()} €/an
                  </p>
                </div>
              </div>
            </ChartCard>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-primary-dark">Importer des équipements</h2>
                <p className="text-sm text-text-secondary">Format Excel (.xlsx) ou CSV</p>
              </div>
              <button onClick={() => setShowImport(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${importing ? "border-gray-300 bg-gray-50" : "border-gray-300 hover:border-accent"}`}>
                  {importing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                      <p className="font-medium">Import en cours...</p>
                    </div>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="font-medium mb-2">Glissez votre fichier Excel</p>
                      <p className="text-sm text-gray-500">ou cliquez pour sélectionner</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
              </label>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-primary-dark mb-2">Colonnes attendues</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <p className="font-medium text-xs text-gray-400 uppercase mb-1">Site</p>
                    <p>Site, Type Site, Adresse, Ville, CP</p>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-gray-400 uppercase mb-1">Équipement</p>
                    <p>Équipement/Type, Puissance, Quantité, Année</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileDown size={16} />
                <a href="/templates/import-equipements.xlsx" className="text-accent hover:underline">
                  Télécharger le modèle Excel
                </a>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowImport(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FolderPlus className="text-accent" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primary-dark">Sauvegarder le projet</h2>
                  <p className="text-sm text-text-secondary">Créer un projet avec ces données</p>
                </div>
              </div>
              <button onClick={() => setShowSaveDialog(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-2">
                  Nom du projet / Appel d&apos;offres
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: AO Chauffage Lycées Région Sud"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  autoFocus
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-primary-dark mb-2">Résumé</p>
                <div className="space-y-1 text-gray-600">
                  <p>{equipmentsBySite.size} sites</p>
                  <p>{equipments.length} équipements</p>
                  <p>Durée: {duration} ans</p>
                  {result && <p className="font-medium text-accent">Prix: {result.finalPrice.toLocaleString()} € HT</p>}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Les sites et équipements seront créés dans votre organisation et liés à un contrat &quot;En attente&quot;.
              </p>
            </div>

            <div className="p-6 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={saveProject} disabled={!projectName.trim() || saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Sauvegarder
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {equipments.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">
            Aucun équipement
          </h3>
          <p className="text-text-secondary max-w-md mx-auto mb-4">
            Importez un fichier Excel avec la liste des sites et équipements ou ajoutez-les manuellement.
          </p>
          <Button onClick={() => setShowImport(true)}>
            <Upload size={18} className="mr-2" />
            Importer un fichier
          </Button>
        </div>
      )}
    </div>
  );
}
