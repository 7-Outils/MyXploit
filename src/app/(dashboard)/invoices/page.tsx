"use client";

import { useState, useEffect, useRef } from "react";
import {
  Receipt,
  Plus,
  Check,
  X,
  Clock,
  Euro,
  Loader2,
  Upload,
  FileUp,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Site {
  id: string;
  name: string;
  city?: string;
}

interface Contract {
  id: string;
  reference: string;
  provider: string;
}

interface Invoice {
  id: string;
  reference: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  status: "BROUILLON" | "EN_ATTENTE" | "VALIDEE" | "REJETEE" | "PAYEE";
  amount: number;
  taxAmount: number | null;
  issueDate: string;
  dueDate: string;
  description: string | null;
  site: Site | null;
  contract: Contract | null;
}

const typeConfig = {
  P1: { label: "P1 - Énergie", color: "bg-orange-100 text-orange-700" },
  P2: { label: "P2 - Petit entretien", color: "bg-blue-100 text-blue-700" },
  P3: { label: "P3 - Gros entretien", color: "bg-purple-100 text-purple-700" },
  TRAVAUX: { label: "Travaux", color: "bg-green-100 text-green-700" },
  AUTRE: { label: "Autre", color: "bg-gray-100 text-gray-700" },
};

const statusConfig = {
  BROUILLON: {
    label: "Brouillon",
    color: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  EN_ATTENTE: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  VALIDEE: {
    label: "Validée",
    color: "bg-green-100 text-green-700",
    icon: Check,
  },
  REJETEE: {
    label: "Rejetée",
    color: "bg-red-100 text-red-700",
    icon: X,
  },
  PAYEE: {
    label: "Payée",
    color: "bg-blue-100 text-blue-700",
    icon: Check,
  },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedContractFilter, setSelectedContractFilter] = useState<string>("");
  const [contractSites, setContractSites] = useState<Site[]>([]);
  const [loadingContractSites, setLoadingContractSites] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import form data
  const [importPreview, setImportPreview] = useState<{
    reference: string | null;
    siteName: string | null;
    siteCity: string | null;
    objet: string | null;
    amountHT: number | null;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matchedSiteId, setMatchedSiteId] = useState<string | null>(null);

  const [importFormData, setImportFormData] = useState({
    reference: "",
    type: "P1" as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
    amount: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    description: "",
    siteId: "",
    contractId: "",
  });

  const [formData, setFormData] = useState({
    reference: "",
    type: "P1" as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE",
    amount: "",
    issueDate: "",
    dueDate: "",
    description: "",
    siteId: "",
    contractId: "",
  });

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, contractsRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/contracts"),
      ]);
      const [invoicesData, contractsData] = await Promise.all([
        invoicesRes.json(),
        contractsRes.json(),
      ]);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
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
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) || 0,
          siteId: formData.siteId || null,
          contractId: formData.contractId || null,
        }),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          reference: "",
          type: "P1",
          amount: "",
          issueDate: "",
          dueDate: "",
          description: "",
          siteId: "",
          contractId: "",
        });
        setContractSites([]);
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
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

      // Show preview
      setImportPreview({
        reference: result.parsed.reference,
        siteName: result.parsed.siteName,
        siteCity: result.parsed.siteCity,
        objet: result.parsed.objet,
        amountHT: result.parsed.amountHT,
      });

      // Calculate due date (30 days from issue date)
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      // Pre-fill import form
      const matchedSite = result.matchedSite?.id || "";
      setImportFormData({
        reference: result.parsed.reference || "",
        type: "P1",
        amount: result.parsed.amountHT?.toString() || "",
        issueDate: issueDate.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        description: result.parsed.objet || "",
        siteId: matchedSite,
        contractId: "",
      });

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

  const handleImportSubmit = async () => {
    if (!importFormData.reference) {
      setImportError("Veuillez remplir la référence");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: importFormData.reference,
          type: importFormData.type,
          amount: parseFloat(importFormData.amount) || 0,
          issueDate: importFormData.issueDate,
          dueDate: importFormData.dueDate,
          description: importFormData.description || null,
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
        type: "P1",
        amount: "",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        description: "",
        siteId: "",
        contractId: "",
      });
      setContractSites([]);
      fetchData();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // Filter invoices by selected contract
  const filteredInvoices = selectedContractFilter
    ? invoices.filter((i) => i.contract?.id === selectedContractFilter)
    : invoices;

  const pendingCount = filteredInvoices.filter((i) => i.status === "EN_ATTENTE").length;
  const pendingAmount = filteredInvoices
    .filter((i) => i.status === "EN_ATTENTE")
    .reduce((sum, i) => sum + i.amount, 0);
  const validatedAmount = filteredInvoices
    .filter((i) => i.status === "VALIDEE" || i.status === "PAYEE")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalAmount = filteredInvoices.reduce((sum, i) => sum + i.amount, 0);

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
          <h1 className="text-2xl font-bold text-primary-dark">Facturation</h1>
          <p className="text-text-secondary">
            Gérez le workflow de validation des factures
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
            Saisir facture
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="En attente"
          value={pendingCount.toString()}
          change={`${(pendingAmount / 1000).toFixed(0)}k€ à valider`}
          changeType="neutral"
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Validées"
          value={`${(validatedAmount / 1000).toFixed(0)}k€`}
          icon={Check}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Total factures"
          value={`${(totalAmount / 1000).toFixed(0)}k€`}
          icon={Euro}
          iconColor="text-accent"
        />
        <StatsCard
          title="Factures"
          value={filteredInvoices.length.toString()}
          icon={Receipt}
          iconColor="text-blue-600"
        />
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <ChartCard title="" className="flex flex-col items-center justify-center py-12">
          <Receipt size={48} className="text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">
            {selectedContractFilter ? "Aucune facture pour ce contrat" : "Aucune facture"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload size={18} className="mr-2" />
              Importer PDF
            </Button>
            <Button onClick={() => setShowModal(true)}>
              <Plus size={18} className="mr-2" />
              Saisir facture
            </Button>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title={`${filteredInvoices.length} facture${filteredInvoices.length > 1 ? "s" : ""}${selectedContractFilter ? " pour ce contrat" : ""}`}>
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => {
              const status = statusConfig[invoice.status];
              const type = typeConfig[invoice.type];
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <Receipt size={18} className="text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-primary-dark">
                        {invoice.reference}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {invoice.contract?.provider || "Sans contrat"} • {new Date(invoice.issueDate).toLocaleDateString("fr-FR")}
                      </p>
                      {invoice.site && (
                        <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {invoice.site.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-primary-dark">
                        {invoice.amount.toLocaleString("fr-FR")} € HT
                      </p>
                      <p className="text-sm text-text-secondary">
                        Échéance: {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}>
                        {invoice.type}
                      </span>
                      <select
                        value={invoice.status}
                        onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${status.color}`}
                      >
                        <option value="BROUILLON">Brouillon</option>
                        <option value="EN_ATTENTE">En attente</option>
                        <option value="VALIDEE">Validée</option>
                        <option value="REJETEE">Rejetée</option>
                        <option value="PAYEE">Payée</option>
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
                Importer une facture PDF
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setImportPreview(null);
                  setImportError(null);
                  setMatchedSiteId(null);
                  setContractSites([]);
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
                      N° Facture *
                    </label>
                    <input
                      type="text"
                      required
                      value={importFormData.reference}
                      onChange={(e) => setImportFormData({ ...importFormData, reference: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="FAC-2024-001"
                    />
                  </div>

                  {/* Type et Montant */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Type *
                      </label>
                      <select
                        value={importFormData.type}
                        onChange={(e) => setImportFormData({ ...importFormData, type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE" })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      >
                        <option value="P1">P1 - Énergie</option>
                        <option value="P2">P2 - Petit entretien</option>
                        <option value="P3">P3 - Gros entretien & Renouvellement</option>
                        <option value="TRAVAUX">Travaux hors contrat</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Montant HT (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={importFormData.amount}
                        onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                        placeholder="15000.00"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-dark mb-1">
                        Date d&apos;émission
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
                        Date d&apos;échéance
                      </label>
                      <input
                        type="date"
                        value={importFormData.dueDate}
                        onChange={(e) => setImportFormData({ ...importFormData, dueDate: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
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
                          {site.name} {site.city && `(${site.city})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">
                      Description
                    </label>
                    <textarea
                      value={importFormData.description}
                      onChange={(e) => setImportFormData({ ...importFormData, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      rows={2}
                      placeholder="Description..."
                    />
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
                    setContractSites([]);
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
                      "Importer la facture"
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
                Nouvelle facture
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setContractSites([]);
                }}
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
                    placeholder="FAC-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE" })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="P1">P1 - Énergie</option>
                    <option value="P2">P2 - Petit entretien</option>
                    <option value="P3">P3 - Gros entretien & Renouvellement</option>
                    <option value="TRAVAUX">Travaux hors contrat</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Montant HT (€) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="15000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date d&apos;émission *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.issueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, issueDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Date d&apos;échéance *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Contrat first */}
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

              {/* Site (filtered by contract) */}
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
                      {site.name} {site.city && `(${site.city})`}
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
                  placeholder="Description de la facture..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setContractSites([]);
                  }}
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
                    "Créer la facture"
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
