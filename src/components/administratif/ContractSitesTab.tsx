"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
  Settings,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  GitBranch,
  MapPin,
  Flame,
  Zap,
  ArrowRight,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  surfaceChauffee: number | null;
  energyType: string;
  nb: number | null;
  nbUnit: string | null;
  pce: string | null;
  pdl: string | null;
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  amountP21: number | null;
  amountP22: number | null;
  amountP23: number | null;
  amountP24: number | null;
  amountP25: number | null;
  amountP26: number | null;
  amountP31: number | null;
  amountP32: number | null;
  amountP33: number | null;
  amountP34: number | null;
  amountP35: number | null;
  amountP36: number | null;
  coefficientPCS: number | null;
  integrationDate: string | null;
  exitDate: string | null;
  site: Site;
}

interface Contract {
  id: string;
  reference: string;
  status: string;
  contractSites: ContractSite[];
}

const contractTypes = [
  { value: "MC", label: "MC - Marché Comptage" },
  { value: "MCI", label: "MCI - Marché Comptage avec Intéressement" },
  { value: "MT", label: "MT - Marché à Température" },
  { value: "MTI", label: "MTI - Marché à Température avec Intéressement" },
  { value: "CP", label: "CP - Combustible et Prestations" },
  { value: "CPI", label: "CPI - Combustible et Prestations avec Intéressement" },
  { value: "PF", label: "PF - Prestation et Forfait" },
  { value: "PFI", label: "PFI - Prestation et Forfait avec Intéressement" },
  { value: "MF", label: "MF - Marché Forfaitaire" },
  { value: "AUTRE", label: "Autre" },
];

const siteTypes = [
  { value: "LYCEE", label: "Lycée" },
  { value: "COLLEGE", label: "Collège" },
  { value: "ECOLE", label: "École" },
  { value: "MAIRIE", label: "Mairie" },
  { value: "HOPITAL", label: "Hôpital" },
  { value: "GYMNASE", label: "Gymnase" },
  { value: "PISCINE", label: "Piscine" },
  { value: "MEDIATHEQUE", label: "Médiathèque" },
  { value: "AUTRE", label: "Autre" },
];

const energyTypes = [
  { value: "GAZ", label: "Gaz" },
  { value: "ELECTRICITE", label: "Électricité" },
  { value: "FIOUL", label: "Fioul" },
  { value: "BOIS", label: "Bois" },
  { value: "RESEAU_CHALEUR", label: "Réseau de chaleur" },
  { value: "AUTRE", label: "Autre" },
];

const energyTypeLabels: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  AUTRE: "Autre",
};

const contractTypeLabels: Record<string, string> = {
  MTI: "MTI", MCI: "MCI", PFI: "PFI", CPI: "CPI",
  MT: "MT", CP: "CP", PF: "PF", MC: "MC", MF: "MF", AUTRE: "Autre",
};

interface ContractSitesTabProps {
  contractId: string;
  contract: Contract;
  onContractUpdate: () => void;
}

export default function ContractSitesTab({ contractId, contract, onContractUpdate }: ContractSitesTabProps) {
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  // Site creation modal
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [siteFormData, setSiteFormData] = useState({
    name: "", type: "LYCEE", address: "", city: "", postalCode: "",
    surface: "", surfaceChauffee: "", energyType: "GAZ",
    pce: "", pdl: "",
    contractType: "MC", hasP1: false, hasP2: false, hasP3: false, hasP4: false,
    amountP1: "", amountP2: "", amountP3: "",
  });

  // Site edit modal
  const [showEditSiteModal, setShowEditSiteModal] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [updatingSite, setUpdatingSite] = useState(false);
  const [editSiteFormData, setEditSiteFormData] = useState({
    name: "", type: "LYCEE", address: "", city: "", postalCode: "",
    surface: "", surfaceChauffee: "", energyType: "GAZ",
    pce: "", pdl: "",
  });

  // ContractSite edit modal
  const [showEditContractSiteModal, setShowEditContractSiteModal] = useState(false);
  const [editingContractSiteId, setEditingContractSiteId] = useState<string | null>(null);
  const [updatingContractSite, setUpdatingContractSite] = useState(false);
  const [editContractSiteFormData, setEditContractSiteFormData] = useState({
    contractType: "MC", hasP1: false, hasP2: false, hasP3: false, hasP4: false,
    amountP2: "", amountP3: "", coefficientPCS: "",
  });

  // Import sites modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "result">("upload");
  const [previewSites, setPreviewSites] = useState<Array<{
    _index: number; name: string; type?: string; _type: string;
    address?: string; city?: string; postalCode?: string; surface?: number;
    energyType?: string; _energyType: string; contractType?: string; _contractType: string;
    hasP1?: boolean; hasP2?: boolean; hasP3?: boolean; hasP4?: boolean;
    amountP2?: number; amountP3?: number;
  }>>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean; imported: number; linkedToContract: number;
    sites: string[]; errors: string[];
  } | null>(null);

  const toggleSiteExpanded = (siteId: string) => {
    const newExpanded = new Set(expandedSites);
    if (newExpanded.has(siteId)) newExpanded.delete(siteId);
    else newExpanded.add(siteId);
    setExpandedSites(newExpanded);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSite(true);
    try {
      const siteResponse = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: siteFormData.name, type: siteFormData.type,
          address: siteFormData.address, city: siteFormData.city,
          postalCode: siteFormData.postalCode, energyType: siteFormData.energyType,
          surface: siteFormData.surface ? parseFloat(siteFormData.surface) : null,
          surfaceChauffee: siteFormData.surfaceChauffee ? parseFloat(siteFormData.surfaceChauffee) : null,
          pce: siteFormData.pce, pdl: siteFormData.pdl,
        }),
      });
      if (siteResponse.ok) {
        const newSite = await siteResponse.json();
        await fetch(`/api/contracts/${contractId}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: newSite.id, contractType: siteFormData.contractType,
            hasP1: siteFormData.hasP1, hasP2: siteFormData.hasP2,
            hasP3: siteFormData.hasP3, hasP4: siteFormData.hasP4,
            amountP1: siteFormData.amountP1, amountP2: siteFormData.amountP2,
            amountP3: siteFormData.amountP3,
          }),
        });
        onContractUpdate();
        setShowSiteModal(false);
        setSiteFormData({
          name: "", type: "LYCEE", address: "", city: "", postalCode: "",
          surface: "", surfaceChauffee: "", energyType: "GAZ",
          pce: "", pdl: "",
          contractType: "MC", hasP1: false, hasP2: false, hasP3: false, hasP4: false,
          amountP1: "", amountP2: "", amountP3: "",
        });
      }
    } catch (error) {
      console.error("Error creating site:", error);
    } finally {
      setCreatingSite(false);
    }
  };

  const openEditSiteModal = (site: Site) => {
    setEditingSiteId(site.id);
    setEditSiteFormData({
      name: site.name, type: site.type, address: site.address,
      city: site.city, postalCode: site.postalCode,
      surface: site.surface?.toString() || "", surfaceChauffee: site.surfaceChauffee?.toString() || "",
      energyType: site.energyType, pce: site.pce || "", pdl: site.pdl || "",
    });
    setShowEditSiteModal(true);
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSiteId) return;
    setUpdatingSite(true);
    try {
      const response = await fetch(`/api/sites/${editingSiteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editSiteFormData,
          surface: editSiteFormData.surface ? parseFloat(editSiteFormData.surface) : null,
          surfaceChauffee: editSiteFormData.surfaceChauffee ? parseFloat(editSiteFormData.surfaceChauffee) : null,
        }),
      });
      if (response.ok) {
        onContractUpdate();
        setShowEditSiteModal(false);
        setEditingSiteId(null);
      }
    } catch (error) {
      console.error("Error updating site:", error);
    } finally {
      setUpdatingSite(false);
    }
  };

  const openEditContractSiteModal = (contractSite: ContractSite) => {
    setEditingContractSiteId(contractSite.site.id);
    setEditContractSiteFormData({
      contractType: contractSite.contractType,
      hasP1: contractSite.hasP1, hasP2: contractSite.hasP2,
      hasP3: contractSite.hasP3, hasP4: contractSite.hasP4,
      amountP2: contractSite.amountP2?.toString() || "",
      amountP3: contractSite.amountP3?.toString() || "",
      coefficientPCS: contractSite.coefficientPCS?.toString() || "10.5",
    });
    setShowEditContractSiteModal(true);
  };

  const handleUpdateContractSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContractSiteId) return;
    setUpdatingContractSite(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/sites/${editingContractSiteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: editContractSiteFormData.contractType,
          hasP1: editContractSiteFormData.hasP1, hasP2: editContractSiteFormData.hasP2,
          hasP3: editContractSiteFormData.hasP3, hasP4: editContractSiteFormData.hasP4,
          amountP2: editContractSiteFormData.amountP2 || null,
          amountP3: editContractSiteFormData.amountP3 || null,
          coefficientPCS: editContractSiteFormData.coefficientPCS || null,
        }),
      });
      if (response.ok) {
        onContractUpdate();
        setShowEditContractSiteModal(false);
        setEditingContractSiteId(null);
      } else {
        const error = await response.json();
        alert(error.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Error updating contract site:", error);
    } finally {
      setUpdatingContractSite(false);
    }
  };

  // Import sites
  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setPreviewSites([]);
    setImportStep("upload");
    setShowImportModal(true);
  };

  const updatePreviewSite = (index: number, field: string, value: unknown) => {
    setPreviewSites((prev) => prev.map((site, i) => (i === index ? { ...site, [field]: value } : site)));
  };

  const removePreviewSite = (index: number) => {
    setPreviewSites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportPreview = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("contractId", contractId);
      formData.append("preview", "true");
      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        setImportResult({ success: false, imported: 0, linkedToContract: 0, sites: [], errors: [result.error || "Erreur lors de l'analyse du fichier"] });
        setImportStep("result");
      } else {
        setPreviewSites(result.sites || []);
        setImportStep("preview");
      }
    } catch {
      setImportResult({ success: false, imported: 0, linkedToContract: 0, sites: [], errors: ["Erreur lors de l'analyse du fichier"] });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (previewSites.length === 0) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile!);
      formData.append("contractId", contractId);
      formData.append("sitesData", JSON.stringify(previewSites));
      const response = await fetch("/api/sites/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        setImportResult({ success: false, imported: 0, linkedToContract: 0, sites: [], errors: [result.error || "Erreur lors de l'import"] });
      } else {
        setImportResult(result);
        onContractUpdate();
      }
      setImportStep("result");
    } catch {
      setImportResult({ success: false, imported: 0, linkedToContract: 0, sites: [], errors: ["Erreur lors de l'import"] });
      setImportStep("result");
    } finally {
      setImporting(false);
    }
  };

  const [siteSearch, setSiteSearch] = useState("");
  const [siteViewMode, setSiteViewMode] = useState<"grid" | "list">("grid");

  const filteredContractSites = contract.contractSites.filter((cs: ContractSite) => {
    if (!siteSearch) return true;
    const s = cs.site;
    return s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(siteSearch.toLowerCase()));
  });

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un site..."
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setSiteViewMode("grid")} className={`p-2 transition-colors ${siteViewMode === "grid" ? "bg-accent text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setSiteViewMode("list")} className={`p-2 transition-colors ${siteViewMode === "list" ? "bg-accent text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <List size={16} />
          </button>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={openImportModal}>
          <Upload size={16} className="mr-1" />
          Importer
        </Button>
        <Button size="sm" onClick={() => setShowSiteModal(true)}>
          <Plus size={16} className="mr-1" />
          Ajouter
        </Button>
      </div>

      {contract.contractSites.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary mb-4">Aucun site rattaché à ce contrat</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={openImportModal}>
              <Upload size={18} className="mr-2" />
              Importer des sites
            </Button>
            <Button onClick={() => setShowSiteModal(true)}>
              <Plus size={18} className="mr-2" />
              Créer un site
            </Button>
          </div>
        </div>
      ) : siteViewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContractSites.map((contractSite: ContractSite) => {
            const site = contractSite.site;
            return (
              <div key={site.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-accent/20 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/buildings/${site.id}`}>
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-accent transition-colors cursor-pointer">
                        {site.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{site.city} ({site.postalCode})</span>
                    </div>
                  </div>
                  {contractSite.contractType && (
                    <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium ml-2">{contractSite.contractType}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Flame size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-600">{site.energyType || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-600">{site.surfaceChauffee || site.surface ? `${(site.surfaceChauffee || site.surface)?.toLocaleString()} m²` : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex gap-1">
                    {contractSite.hasP1 && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 font-medium">P1</span>}
                    {contractSite.hasP2 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">P2</span>}
                    {contractSite.hasP3 && <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">P3</span>}
                    {contractSite.hasP4 && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">P4</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditContractSiteModal(contractSite)} className="p-1 text-gray-400 hover:text-accent rounded" title="Prestations">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => openEditSiteModal(site)} className="p-1 text-gray-400 hover:text-accent rounded" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <Link href={`/buildings/${site.id}`}>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-accent transition-colors" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Site</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Ville</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Prestations</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredContractSites.map((contractSite: ContractSite) => {
                const site = contractSite.site;
                return (
                  <tr key={site.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/buildings/${site.id}`} className="text-sm font-medium text-gray-900 hover:text-accent">
                        {site.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{site.city}</td>
                    <td className="px-4 py-3">
                      {contractSite.contractType && <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">{contractSite.contractType}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {contractSite.hasP1 && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 font-medium">P1</span>}
                        {contractSite.hasP2 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">P2</span>}
                        {contractSite.hasP3 && <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">P3</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEditContractSiteModal(contractSite)} className="p-1 text-gray-400 hover:text-accent rounded" title="Prestations">
                          <Settings size={14} />
                        </button>
                        <button onClick={() => openEditSiteModal(site)} className="p-1 text-gray-400 hover:text-accent rounded" title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <Link href={`/buildings/${site.id}`}>
                          <ArrowRight size={14} className="text-gray-300" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Site Modal */}
      {showSiteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Nouveau site</h2>
              <button onClick={() => setShowSiteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Nom du site *</label>
                <input type="text" required value={siteFormData.name} onChange={(e) => setSiteFormData({ ...siteFormData, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Lycée Jean Moulin" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
                  <select required value={siteFormData.type} onChange={(e) => setSiteFormData({ ...siteFormData, type: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {siteTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Énergie principale *</label>
                  <select required value={siteFormData.energyType} onChange={(e) => setSiteFormData({ ...siteFormData, energyType: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {energyTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Adresse *</label>
                <input type="text" required value={siteFormData.address} onChange={(e) => setSiteFormData({ ...siteFormData, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="12 rue de la République" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Code postal *</label>
                  <input type="text" required value={siteFormData.postalCode} onChange={(e) => setSiteFormData({ ...siteFormData, postalCode: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="75001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Ville *</label>
                  <input type="text" required value={siteFormData.city} onChange={(e) => setSiteFormData({ ...siteFormData, city: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Paris" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Surface totale (m²)</label>
                  <input type="number" value={siteFormData.surface} onChange={(e) => setSiteFormData({ ...siteFormData, surface: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="5000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Surface chauffée (m²)</label>
                  <input type="number" value={siteFormData.surfaceChauffee} onChange={(e) => setSiteFormData({ ...siteFormData, surfaceChauffee: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="4500" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Compteurs</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">PCE (compteur gaz)</label>
                    <input type="text" value={siteFormData.pce} onChange={(e) => setSiteFormData({ ...siteFormData, pce: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="GI123456" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">PDL (compteur élec)</label>
                    <input type="text" value={siteFormData.pdl} onChange={(e) => setSiteFormData({ ...siteFormData, pdl: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="12345678901234" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Paramètres du contrat pour ce site</p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type de contrat *</label>
                  <select required value={siteFormData.contractType} onChange={(e) => setSiteFormData({ ...siteFormData, contractType: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {contractTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-2">Prestations incluses</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={siteFormData.hasP1} onChange={(e) => setSiteFormData({ ...siteFormData, hasP1: e.target.checked })} className="w-4 h-4 text-accent rounded focus:ring-accent" />
                      <span className="text-sm text-primary-dark">P1 - Énergie</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={siteFormData.hasP2} onChange={(e) => setSiteFormData({ ...siteFormData, hasP2: e.target.checked })} className="w-4 h-4 text-accent rounded focus:ring-accent" />
                      <span className="text-sm text-primary-dark">P2 - Maintenance</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={siteFormData.hasP3} onChange={(e) => setSiteFormData({ ...siteFormData, hasP3: e.target.checked })} className="w-4 h-4 text-accent rounded focus:ring-accent" />
                      <span className="text-sm text-primary-dark">P3 - Travaux</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={siteFormData.hasP4} onChange={(e) => setSiteFormData({ ...siteFormData, hasP4: e.target.checked })} className="w-4 h-4 text-accent rounded focus:ring-accent" />
                      <span className="text-sm text-primary-dark">P4 - Financement</span>
                    </label>
                  </div>
                </div>
                {(siteFormData.hasP2 || siteFormData.hasP3) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-primary-dark mb-3">Montants de base (révisés annuellement)</p>
                    <div className="grid grid-cols-2 gap-4">
                      {siteFormData.hasP2 && (
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">Prix P2 de base (€ HT/an)</label>
                          <input type="number" step="0.01" value={siteFormData.amountP2} onChange={(e) => setSiteFormData({ ...siteFormData, amountP2: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="5000" />
                        </div>
                      )}
                      {siteFormData.hasP3 && (
                        <div>
                          <label className="block text-sm font-medium text-primary-dark mb-1">Prix P3 de base (€ HT/an)</label>
                          <input type="number" step="0.01" value={siteFormData.amountP3} onChange={(e) => setSiteFormData({ ...siteFormData, amountP3: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="3000" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-2">Ces montants sont révisés à la date anniversaire du contrat.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSiteModal(false)}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={creatingSite}>
                  {creatingSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Création...</>) : "Créer le site"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {showEditSiteModal && editingSiteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Modifier le site</h2>
              <button onClick={() => { setShowEditSiteModal(false); setEditingSiteId(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Nom du site *</label>
                <input type="text" required value={editSiteFormData.name} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Type *</label>
                  <select required value={editSiteFormData.type} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, type: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {siteTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Énergie principale *</label>
                  <select required value={editSiteFormData.energyType} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, energyType: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {energyTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Adresse *</label>
                <input type="text" required value={editSiteFormData.address} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Code postal *</label>
                  <input type="text" required value={editSiteFormData.postalCode} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, postalCode: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Ville *</label>
                  <input type="text" required value={editSiteFormData.city} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, city: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Surface totale (m²)</label>
                  <input type="number" value={editSiteFormData.surface} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, surface: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">Surface chauffée (m²)</label>
                  <input type="number" value={editSiteFormData.surfaceChauffee} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, surfaceChauffee: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Compteurs</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">PCE (compteur gaz)</label>
                    <input type="text" value={editSiteFormData.pce} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, pce: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-dark mb-1">PDL (compteur élec)</label>
                    <input type="text" value={editSiteFormData.pdl} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, pdl: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowEditSiteModal(false); setEditingSiteId(null); }}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={updatingSite}>
                  {updatingSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit ContractSite Modal */}
      {showEditContractSiteModal && editingContractSiteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">Modifier les prestations</h2>
              <button onClick={() => { setShowEditContractSiteModal(false); setEditingContractSiteId(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateContractSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">Type de contrat</label>
                <select value={editContractSiteFormData.contractType} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, contractType: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20">
                  {contractTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Prestations incluses</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editContractSiteFormData.hasP1} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP1: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent" />
                    <span className="text-sm">P1 - Combustible</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editContractSiteFormData.hasP2} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP2: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent" />
                    <span className="text-sm">P2 - Petit entretien</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editContractSiteFormData.hasP3} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP3: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent" />
                    <span className="text-sm">P3 - Gros entretien</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={editContractSiteFormData.hasP4} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP4: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent" />
                    <span className="text-sm">P4 - Financement</span>
                  </label>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Montants annuels</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Montant P2 (€/an)</label>
                    <input type="number" step="0.01" value={editContractSiteFormData.amountP2} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, amountP2: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Montant P3 (€/an)</label>
                    <input type="number" step="0.01" value={editContractSiteFormData.amountP3} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, amountP3: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-primary-dark mb-3">Coefficient de conversion gaz</p>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Coefficient PCS (kWh/m³)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" step="0.1" value={editContractSiteFormData.coefficientPCS} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: e.target.value })} className="w-32 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="10.5" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: "10.5" })} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${editContractSiteFormData.coefficientPCS === "10.5" ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"}`}>20 mbar</button>
                      <button type="button" onClick={() => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: "14.5" })} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${editContractSiteFormData.coefficientPCS === "14.5" ? "bg-accent text-white border-accent" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"}`}>300 mbar</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">20 mbar (basse pression) : ~10.5 | 300 mbar (moyenne pression) : ~14.5</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowEditContractSiteModal(false); setEditingContractSiteId(null); }}>Annuler</Button>
                <Button type="submit" className="flex-1" disabled={updatingContractSite}>
                  {updatingContractSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Sites Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto ${importStep === "preview" ? "max-w-4xl" : "max-w-lg"}`}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary-dark">Importer des sites</h2>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="p-6">
              {importStep === "upload" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Importez un fichier Excel (.xlsx) contenant vos sites. Le fichier doit contenir les colonnes : Nom, Type, Adresse, Ville, Code postal, Surface, Énergie.
                  </p>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${importFile ? "border-accent bg-accent/5" : "border-gray-200 hover:border-gray-300"}`}>
                    {importFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet size={24} className="text-accent" />
                        <div className="text-left">
                          <p className="font-medium text-primary-dark">{importFile.name}</p>
                          <p className="text-sm text-text-secondary">{(importFile.size / 1024).toFixed(1)} Ko</p>
                        </div>
                        <button onClick={() => setImportFile(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} className="text-gray-500" /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-primary-dark font-medium">Cliquez pour sélectionner un fichier</p>
                        <p className="text-sm text-text-secondary">ou glissez-déposez ici</p>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setImportFile(file); }} />
                      </label>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowImportModal(false)}>Annuler</Button>
                    <Button className="flex-1" disabled={!importFile || importing} onClick={handleImportPreview}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Analyse...</>) : "Suivant →"}
                    </Button>
                  </div>
                </div>
              )}
              {importStep === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    <strong>{previewSites.length} site{previewSites.length > 1 ? "s" : ""}</strong> à importer pour le contrat <strong>{contract?.reference}</strong>. Vous pouvez modifier les données avant l&apos;import.
                  </p>
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Nom</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Adresse</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">CP</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Ville</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Énergie</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Surface</th>
                          <th className="text-center px-2 py-2 font-medium text-text-secondary">P1</th>
                          <th className="text-center px-2 py-2 font-medium text-text-secondary">P2</th>
                          <th className="text-center px-2 py-2 font-medium text-text-secondary">P3</th>
                          <th className="text-center px-2 py-2 font-medium text-text-secondary">P4</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Type contrat</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Montant P2</th>
                          <th className="text-left px-3 py-2 font-medium text-text-secondary">Montant P3</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewSites.map((site, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2"><input type="text" value={site.name} onChange={(e) => updatePreviewSite(index, "name", e.target.value)} className="w-full min-w-[120px] px-2 py-1 border border-gray-200 rounded text-sm" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.address || ""} onChange={(e) => updatePreviewSite(index, "address", e.target.value)} className="w-full min-w-[150px] px-2 py-1 border border-gray-200 rounded text-sm" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.postalCode || ""} onChange={(e) => updatePreviewSite(index, "postalCode", e.target.value)} className="w-[70px] px-2 py-1 border border-gray-200 rounded text-sm" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.city || ""} onChange={(e) => updatePreviewSite(index, "city", e.target.value)} className="w-full min-w-[100px] px-2 py-1 border border-gray-200 rounded text-sm" /></td>
                            <td className="px-3 py-2">
                              <select value={site._energyType} onChange={(e) => updatePreviewSite(index, "_energyType", e.target.value)} className="w-full min-w-[90px] px-2 py-1 border border-gray-200 rounded text-sm">
                                {Object.entries(energyTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="number" value={site.surface || ""} onChange={(e) => updatePreviewSite(index, "surface", e.target.value ? Number(e.target.value) : undefined)} className="w-[80px] px-2 py-1 border border-gray-200 rounded text-sm" placeholder="m²" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP1 || false} onChange={(e) => updatePreviewSite(index, "hasP1", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP2 || false} onChange={(e) => updatePreviewSite(index, "hasP2", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP3 || false} onChange={(e) => updatePreviewSite(index, "hasP3", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP4 || false} onChange={(e) => updatePreviewSite(index, "hasP4", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-3 py-2">
                              <select value={site._contractType} onChange={(e) => updatePreviewSite(index, "_contractType", e.target.value)} className="w-full min-w-[70px] px-2 py-1 border border-gray-200 rounded text-sm">
                                {Object.entries(contractTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="number" value={site.amountP2 || ""} onChange={(e) => updatePreviewSite(index, "amountP2", e.target.value ? Number(e.target.value) : undefined)} className="w-[90px] px-2 py-1 border border-gray-200 rounded text-sm" placeholder="€" /></td>
                            <td className="px-3 py-2"><input type="number" value={site.amountP3 || ""} onChange={(e) => updatePreviewSite(index, "amountP3", e.target.value ? Number(e.target.value) : undefined)} className="w-[90px] px-2 py-1 border border-gray-200 rounded text-sm" placeholder="€" /></td>
                            <td className="px-2 py-2"><button onClick={() => removePreviewSite(index)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Supprimer"><X size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={() => setImportStep("upload")}>← Retour</Button>
                    <Button className="flex-1" disabled={previewSites.length === 0 || importing} onClick={handleImport}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Import...</>) : (<><CheckCircle size={18} className="mr-2" />Importer ({previewSites.length})</>)}
                    </Button>
                  </div>
                </div>
              )}
              {importStep === "result" && importResult && (
                <div className="text-center py-4">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold text-primary-dark mb-2">Import réussi !</h3>
                      <p className="text-text-secondary mb-4">{importResult.imported} site{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                      <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur</h3>
                      <div className="text-sm text-red-600 mb-4">
                        {importResult.errors?.map((err, i) => (<p key={i}>{err}</p>))}
                      </div>
                    </>
                  )}
                  <Button onClick={() => setShowImportModal(false)} className="w-full">Fermer</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
