"use client";

import { useState, useEffect, useRef } from "react";
import {
  Calculator,
  Plus,
  FileText,
  TrendingUp,
  Loader2,
  X,
  Check,
  Upload,
  MapPin,
  FileUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface QuoteSite {
  id: string;
  name: string;
  city?: string;
}

interface QuoteContract {
  id: string;
  reference: string;
  provider?: string;
}

interface QuoteItem {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalHT: number;
  tvaRate: number | null;
}

interface Quote {
  id: string;
  reference: string;
  title: string;
  provider: string;
  client: string | null;
  description: string | null;
  quoteType: "P3" | "P5" | "ASTREINTE" | null;
  status: "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE" | "EXPIRE" | "COMMANDE" | "FACTURE";
  amountHT: number;
  amountTVA: number | null;
  amountTTC: number;
  issueDate: string;
  validUntil: string;
  createdAt: string;
  site: QuoteSite | null;
  contract: QuoteContract | null;
  items: QuoteItem[];
}

const quoteTypeConfig = {
  P3: { label: "P3", color: "bg-blue-100 text-blue-700" },
  P5: { label: "P5", color: "bg-purple-100 text-purple-700" },
  ASTREINTE: { label: "Astreinte", color: "bg-orange-100 text-orange-700" },
};

interface Site {
  id: string;
  name: string;
  city: string;
}

interface Contract {
  id: string;
  reference: string;
  provider: string;
}

const statusConfig = {
  BROUILLON: {
    label: "Brouillon",
    color: "bg-gray-100 text-gray-700",
  },
  ENVOYE: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
  },
  ACCEPTE: {
    label: "Accepté",
    color: "bg-green-100 text-green-700",
  },
  REFUSE: {
    label: "Refusé",
    color: "bg-red-100 text-red-700",
  },
  EXPIRE: {
    label: "Expiré",
    color: "bg-gray-100 text-gray-700",
  },
  COMMANDE: {
    label: "Commandé",
    color: "bg-blue-100 text-blue-700",
  },
  FACTURE: {
    label: "Facturé",
    color: "bg-purple-100 text-purple-700",
  },
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedContractFilter, setSelectedContractFilter] = useState<string>("");
  const [importPreview, setImportPreview] = useState<{
    reference: string | null;
    siteName: string | null;
    siteCity: string | null;
    objet: string | null;
    amountHT: number | null;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchedSiteId, setMatchedSiteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contractSites, setContractSites] = useState<Site[]>([]);
  const [loadingContractSites, setLoadingContractSites] = useState(false);

  // Fetch sites for a specific contract
  const fetchContractSites = async (contractId: string) => {
    if (!contractId) {
      setContractSites([]);
      return;
    }
    setLoadingContractSites(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sites`);
      if (res.ok) {
        const data = await res.json();
        setContractSites(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching contract sites:", error);
      setContractSites([]);
    } finally {
      setLoadingContractSites(false);
    }
  };

  // Import form data (editable)
  const [importFormData, setImportFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    issueDate: new Date().toISOString().split("T")[0],
    amountHT: "",
    quoteType: "" as "" | "P3" | "P5" | "ASTREINTE",
    siteId: "",
    contractId: "",
  });

  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    client: "",
    description: "",
    amountHT: "",
    amountTVA: "",
    amountTTC: "",
    quoteType: "" as "" | "P3" | "P5" | "ASTREINTE",
    validUntil: "",
    siteId: "",
    contractId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [quotesRes, sitesRes, contractsRes] = await Promise.all([
        fetch("/api/quotes"),
        fetch("/api/sites"),
        fetch("/api/contracts"),
      ]);
      const [quotesData, sitesData, contractsData] = await Promise.all([
        quotesRes.json(),
        sitesRes.json(),
        contractsRes.json(),
      ]);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setContracts(Array.isArray(contractsData) ? contractsData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amountHT: parseFloat(formData.amountHT) || 0,
          amountTVA: formData.amountTVA ? parseFloat(formData.amountTVA) : null,
          amountTTC: parseFloat(formData.amountTTC || formData.amountHT) || 0,
          quoteType: formData.quoteType || null,
          siteId: formData.siteId || null,
          contractId: formData.contractId || null,
        }),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          reference: "",
          title: "",
          provider: "",
          client: "",
          description: "",
          amountHT: "",
          amountTVA: "",
          amountTTC: "",
          quoteType: "",
          validUntil: "",
          siteId: "",
          contractId: "",
        });
      }
    } catch (error) {
      console.error("Error creating quote:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error updating quote:", error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportError(null);
    setImportPreview(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/quotes/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || "Erreur lors de l'import";
        setImportError(errorMsg);
        return;
      }

      // Show preview with 4 key fields
      setImportPreview({
        reference: result.parsed.reference,
        siteName: result.parsed.siteName,
        siteCity: result.parsed.siteCity,
        objet: result.parsed.objet,
        amountHT: result.parsed.amountHT,
      });

      // Pre-fill import form with parsed data
      const matchedSite = result.matchedSite?.id || "";
      setImportFormData({
        reference: result.parsed.reference || "",
        title: result.parsed.objet || "",
        provider: "",
        issueDate: new Date().toISOString().split("T")[0],
        amountHT: result.parsed.amountHT?.toString() || "",
        quoteType: "",
        siteId: matchedSite,
        contractId: "",
      });

      // Set matched site if found
      if (result.matchedSite) {
        setMatchedSiteId(result.matchedSite.id);
      }
    } catch (error) {
      console.error("Error importing:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur réseau";
      setImportError(`Erreur lors de l'analyse du PDF: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  // Handle import form submit
  const handleImportSubmit = async () => {
    if (!importFormData.reference || !importFormData.title) {
      setImportError("Veuillez remplir la référence et l'objet");
      return;
    }

    setCreating(true);
    try {
      const validUntil = new Date(importFormData.issueDate);
      validUntil.setMonth(validUntil.getMonth() + 3);

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: importFormData.reference,
          title: importFormData.title,
          provider: importFormData.provider || "À définir",
          quoteType: importFormData.quoteType || null,
          amountHT: parseFloat(importFormData.amountHT) || 0,
          amountTTC: parseFloat(importFormData.amountHT) * 1.2 || 0,
          issueDate: importFormData.issueDate,
          validUntil: validUntil.toISOString(),
          siteId: importFormData.siteId || null,
          contractId: importFormData.contractId || null,
          status: "BROUILLON",
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la création");
      }

      // Reset and close
      setShowImportModal(false);
      setSelectedFile(null);
      setImportPreview(null);
      setImportError(null);
      setMatchedSiteId(null);
      setImportFormData({
        reference: "",
        title: "",
        provider: "",
        issueDate: new Date().toISOString().split("T")[0],
        amountHT: "",
        quoteType: "",
        siteId: "",
        contractId: "",
      });
      fetchData();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // Filter quotes by selected contract
  const filteredQuotes = selectedContractFilter
    ? quotes.filter((q) => q.contract?.id === selectedContractFilter)
    : quotes;

  // Stats based on filtered quotes
  const pendingQuotes = filteredQuotes.filter((q) => q.status === "ENVOYE" || q.status === "BROUILLON");
  const totalAmount = filteredQuotes.reduce((sum, q) => sum + (q.amountHT || 0), 0);
  const acceptedAmount = filteredQuotes
    .filter((q) => q.status === "ACCEPTE" || q.status === "COMMANDE" || q.status === "FACTURE")
    .reduce((sum, q) => sum + (q.amountHT || 0), 0);
  const acceptanceRate =
    filteredQuotes.length > 0
      ? Math.round(
          (filteredQuotes.filter((q) => ["ACCEPTE", "COMMANDE", "FACTURE"].includes(q.status)).length / filteredQuotes.length) *
            100
        )
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Devis & Chiffrage
          </h1>
          <p className="text-text-secondary">
            Analysez et comparez les devis de vos prestataires
          </p>
        </div>
        <div className="flex gap-2">
          {/* Contract filter */}
          <select
            value={selectedContractFilter}
            onChange={(e) => setSelectedContractFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
          >
            <option value="">Tous les contrats</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.reference}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload size={18} className="mr-2" />
            Importer PDF
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Nouveau devis
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Devis en cours"
          value={pendingQuotes.length.toString()}
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Montant total"
          value={`${(totalAmount / 1000).toFixed(0)}k€`}
          icon={Calculator}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Devis acceptés"
          value={`${(acceptedAmount / 1000).toFixed(0)}k€`}
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Taux d'acceptation"
          value={`${acceptanceRate}%`}
          icon={FileText}
          iconColor="text-yellow-600"
        />
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Calculator size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">
            {selectedContractFilter ? "Aucun devis pour ce contrat" : "Aucun devis"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload size={18} className="mr-2" />
              Importer PDF
            </Button>
            <Button onClick={() => setShowModal(true)}>
              <Plus size={18} className="mr-2" />
              Créer un devis
            </Button>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title={`${filteredQuotes.length} devis${selectedContractFilter ? " pour ce contrat" : ""}`}>
          <div className="space-y-4">
            {filteredQuotes.map((quote) => {
              const status = statusConfig[quote.status];
              return (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <Calculator size={18} className="text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-primary-dark">
                        {quote.title}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {quote.reference} • {quote.provider}
                        {quote.client && ` → ${quote.client}`}
                      </p>
                      {quote.site && (
                        <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {quote.site.name}
                          {quote.site.city && ` (${quote.site.city})`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-primary-dark">
                        {(quote.amountHT || 0).toLocaleString("fr-FR")} € HT
                      </p>
                      <p className="text-sm text-text-secondary">
                        Valide jusqu&apos;au{" "}
                        {new Date(quote.validUntil).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {quote.quoteType && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${quoteTypeConfig[quote.quoteType].color}`}>
                          {quoteTypeConfig[quote.quoteType].label}
                        </span>
                      )}
                      <select
                        value={quote.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(quote.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${status.color}`}
                      >
                        <option value="BROUILLON">Brouillon</option>
                        <option value="ENVOYE">En attente</option>
                        <option value="ACCEPTE">Accepté</option>
                        <option value="REFUSE">Refusé</option>
                        <option value="COMMANDE">Commandé</option>
                        <option value="FACTURE">Facturé</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Importer un devis PDF
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setImportPreview(null);
                  setImportError(null);
                  setMatchedSiteId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-accent hover:bg-accent/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={importing}
                />
                {importing ? (
                  <>
                    <Loader2 size={40} className="mx-auto text-accent animate-spin mb-3" />
                    <p className="text-text-secondary">Analyse du PDF en cours...</p>
                  </>
                ) : selectedFile ? (
                  <>
                    <FileUp size={40} className="mx-auto text-accent mb-3" />
                    <p className="font-medium text-primary-dark">{selectedFile.name}</p>
                    <p className="text-sm text-text-secondary mt-1">
                      Cliquez pour changer de fichier
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                    <p className="font-medium text-primary-dark">
                      Cliquez pour sélectionner un PDF
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      ou glissez-déposez le fichier ici
                    </p>
                  </>
                )}
              </div>

              {/* Error */}
              {importError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <p>{importError}</p>
                </div>
              )}

              {/* Formulaire éditable après parsing */}
              {importPreview && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-3 rounded-lg flex items-center gap-2">
                    <Check size={18} className="text-green-600" />
                    <span className="text-sm text-green-800">
                      PDF analysé - Vérifiez et complétez les informations
                    </span>
                  </div>

                  {/* Référence */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      N° Devis *
                    </label>
                    <input
                      type="text"
                      required
                      value={importFormData.reference}
                      onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="DE21003489"
                    />
                  </div>

                  {/* Objet des travaux */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Objet des travaux *
                    </label>
                    <input
                      type="text"
                      required
                      value={importFormData.title}
                      onChange={(e) => setImportFormData({ ...importFormData, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="Remplacement des pompes"
                    />
                  </div>

                  {/* Date et Montant */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Date du devis
                      </label>
                      <input
                        type="date"
                        value={importFormData.issueDate}
                        onChange={(e) => setImportFormData({ ...importFormData, issueDate: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Montant HT (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={importFormData.amountHT}
                        onChange={(e) => setImportFormData({ ...importFormData, amountHT: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="57551.00"
                      />
                    </div>
                  </div>

                  {/* Fournisseur et Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Fournisseur
                      </label>
                      <input
                        type="text"
                        value={importFormData.provider}
                        onChange={(e) => setImportFormData({ ...importFormData, provider: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="T.É.P.I."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Type de devis *
                      </label>
                      <select
                        value={importFormData.quoteType}
                        onChange={(e) => setImportFormData({ ...importFormData, quoteType: e.target.value as "" | "P3" | "P5" | "ASTREINTE" })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      >
                        <option value="">Sélectionner</option>
                        <option value="P3">P3 - Gros entretien & Renouvellement</option>
                        <option value="P5">P5 - Hors marché</option>
                        <option value="ASTREINTE">Astreinte</option>
                      </select>
                    </div>
                  </div>

                  {/* Contrat */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Contrat *
                    </label>
                    <select
                      value={importFormData.contractId}
                      onChange={(e) => {
                        const contractId = e.target.value;
                        setImportFormData({ ...importFormData, contractId, siteId: "" });
                        fetchContractSites(contractId);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="">Sélectionner un contrat</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.reference} - {contract.provider}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Site (filtré par contrat) */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Site {matchedSiteId && <span className="text-green-600 text-xs">(détecté automatiquement)</span>}
                    </label>
                    <select
                      value={importFormData.siteId}
                      onChange={(e) => setImportFormData({ ...importFormData, siteId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      disabled={!importFormData.contractId || loadingContractSites}
                    >
                      <option value="">
                        {!importFormData.contractId
                          ? "Sélectionnez d'abord un contrat"
                          : loadingContractSites
                          ? "Chargement..."
                          : contractSites.length === 0
                          ? "Aucun site pour ce contrat"
                          : "Sélectionner un site"}
                      </option>
                      {contractSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} ({site.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                    setImportPreview(null);
                    setImportError(null);
                    setMatchedSiteId(null);
                  }}
                >
                  Annuler
                </Button>
                {importPreview && (
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleImportSubmit}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Création...
                      </>
                    ) : (
                      "Importer le devis"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Nouveau devis
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Référence *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="DEV-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Fournisseur *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.provider}
                    onChange={(e) =>
                      setFormData({ ...formData, provider: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="ENGIE, Dalkia..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Remplacement chaudière"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Client facturé
                </label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) =>
                    setFormData({ ...formData, client: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="IDEX ENERGIES"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Montant HT (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amountHT}
                    onChange={(e) =>
                      setFormData({ ...formData, amountHT: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    TVA (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amountTVA}
                    onChange={(e) =>
                      setFormData({ ...formData, amountTVA: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="9000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    TTC (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amountTTC}
                    onChange={(e) =>
                      setFormData({ ...formData, amountTTC: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="54000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Contrat *
                  </label>
                  <select
                    value={formData.contractId}
                    onChange={(e) => {
                      const contractId = e.target.value;
                      setFormData({ ...formData, contractId, siteId: "" });
                      fetchContractSites(contractId);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner un contrat</option>
                    {contracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.reference} - {contract.provider}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type de devis
                  </label>
                  <select
                    value={formData.quoteType}
                    onChange={(e) =>
                      setFormData({ ...formData, quoteType: e.target.value as "" | "P3" | "P5" | "ASTREINTE" })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Sélectionner</option>
                    <option value="P3">P3 - Gros entretien & Renouvellement</option>
                    <option value="P5">P5 - Hors marché</option>
                    <option value="ASTREINTE">Astreinte</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Site
                  </label>
                  <select
                    value={formData.siteId}
                    onChange={(e) =>
                      setFormData({ ...formData, siteId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    disabled={!formData.contractId || loadingContractSites}
                  >
                    <option value="">
                      {!formData.contractId
                        ? "Sélectionnez d'abord un contrat"
                        : loadingContractSites
                        ? "Chargement..."
                        : contractSites.length === 0
                        ? "Aucun site pour ce contrat"
                        : "Sélectionner un site"}
                    </option>
                    {contractSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Valide jusqu&apos;au *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) =>
                      setFormData({ ...formData, validUntil: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  rows={3}
                  placeholder="Description du devis..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer le devis"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
