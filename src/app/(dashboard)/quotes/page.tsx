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

  const [formData, setFormData] = useState({
    reference: "",
    title: "",
    provider: "",
    client: "",
    description: "",
    amountHT: "",
    amountTVA: "",
    amountTTC: "",
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

  const pendingQuotes = quotes.filter((q) => q.status === "ENVOYE");
  const totalAmount = quotes.reduce((sum, q) => sum + (q.amountTTC || q.amountHT || 0), 0);
  const acceptedAmount = quotes
    .filter((q) => q.status === "ACCEPTE" || q.status === "COMMANDE" || q.status === "FACTURE")
    .reduce((sum, q) => sum + (q.amountTTC || q.amountHT || 0), 0);
  const acceptanceRate =
    quotes.length > 0
      ? Math.round(
          (quotes.filter((q) => ["ACCEPTE", "COMMANDE", "FACTURE"].includes(q.status)).length / quotes.length) *
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
      {quotes.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Calculator size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucun devis</p>
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
        <ChartCard title={`${quotes.length} devis`}>
          <div className="space-y-4">
            {quotes.map((quote) => {
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
                        {(quote.amountTTC || quote.amountHT || 0).toLocaleString("fr-FR")} € TTC
                      </p>
                      {quote.amountHT > 0 && quote.amountHT !== quote.amountTTC && (
                        <p className="text-xs text-text-secondary">
                          {quote.amountHT.toLocaleString("fr-FR")} € HT
                        </p>
                      )}
                      <p className="text-sm text-text-secondary">
                        Valide jusqu&apos;au{" "}
                        {new Date(quote.validUntil).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                      {quote.status === "ENVOYE" && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(quote.id, "ACCEPTE");
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Accepter"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(quote.id, "REFUSE");
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Refuser"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {quote.status === "ACCEPTE" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(quote.id, "COMMANDE");
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Passer en commande"
                        >
                          <FileText size={16} />
                        </button>
                      )}
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

              {/* Preview - 4 champs clés */}
              {importPreview && (
                <div className="bg-green-50 p-4 rounded-lg space-y-3">
                  <p className="font-medium text-green-800 flex items-center gap-2">
                    <Check size={18} />
                    Données extraites du PDF
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-green-200">
                      <span className="text-green-700">N° Devis:</span>
                      <span className="font-semibold text-green-900">{importPreview.reference || "-"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-green-200">
                      <span className="text-green-700">Site:</span>
                      <span className="font-semibold text-green-900">
                        {importPreview.siteName || "-"}
                        {importPreview.siteCity && ` (${importPreview.siteCity})`}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-green-200">
                      <span className="text-green-700">Objet:</span>
                      <span className="font-semibold text-green-900">{importPreview.objet || "-"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-green-700">Montant HT:</span>
                      <span className="font-bold text-green-900 text-base">
                        {importPreview.amountHT?.toLocaleString("fr-FR") || "-"} €
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Site correspondant */}
              {importPreview && matchedSiteId && (
                <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Site correspondant trouvé: <strong>{sites.find(s => s.id === matchedSiteId)?.name}</strong>
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                    setImportPreview(null);
                    setImportError(null);
                    setMatchedSiteId(null);
                  }}
                >
                  Fermer
                </Button>
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
                    Site
                  </label>
                  <select
                    value={formData.siteId}
                    onChange={(e) =>
                      setFormData({ ...formData, siteId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">-- Aucun site --</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
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
                  Contrat
                </label>
                <select
                  value={formData.contractId}
                  onChange={(e) =>
                    setFormData({ ...formData, contractId: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">-- Aucun contrat --</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.reference} - {contract.provider}
                    </option>
                  ))}
                </select>
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
