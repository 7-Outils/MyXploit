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
  djuContractuel: number | null;
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
  coefficientQ: number | null;
  p1Peg0: number | null;
  p1Ticgn0: number | null;
  p1Tvd0: number | null;
  p1Cee0: number | null;
  p1P0Unit: number | null;
  p1TvdTarif: string | null;
  integrationDate: string | null;
  exitDate: string | null;
  site: Site;
}

interface Contract {
  id: string;
  reference: string;
  status: string;
  isPublic?: boolean; // Secteur public -> P4 (financement) interdit
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
    amountP2: "", amountP3: "", coefficientPCS: "", coefficientQ: "",
    p1Peg0: "", p1Ticgn0: "", p1Tvd0: "", p1Cee0: "", p1P0Unit: "", p1TvdTarif: "",
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
      coefficientQ: contractSite.coefficientQ?.toString() || "0.13",
      p1Peg0: contractSite.p1Peg0?.toString() || "",
      p1Ticgn0: contractSite.p1Ticgn0?.toString() || "",
      p1Tvd0: contractSite.p1Tvd0?.toString() || "",
      p1Cee0: contractSite.p1Cee0?.toString() || "",
      p1P0Unit: contractSite.p1P0Unit?.toString() || "",
      p1TvdTarif: contractSite.p1TvdTarif || "",
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
          coefficientQ: editContractSiteFormData.coefficientQ || null,
          p1Peg0: editContractSiteFormData.p1Peg0,
          p1Ticgn0: editContractSiteFormData.p1Ticgn0,
          p1Tvd0: editContractSiteFormData.p1Tvd0,
          p1Cee0: editContractSiteFormData.p1Cee0,
          p1P0Unit: editContractSiteFormData.p1P0Unit,
          p1TvdTarif: editContractSiteFormData.p1TvdTarif,
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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            placeholder="Rechercher un site..."
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink/20 focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex items-center border border-ink/10 overflow-hidden">
          <button onClick={() => setSiteViewMode("grid")} className={`p-2 transition-colors ${siteViewMode === "grid" ? "bg-ink text-paper" : "text-ink/50 hover:bg-ink/[0.02]"}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setSiteViewMode("list")} className={`p-2 transition-colors ${siteViewMode === "list" ? "bg-ink text-paper" : "text-ink/50 hover:bg-ink/[0.02]"}`}>
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
        <div className="text-center py-10">
          <Building2 size={32} className="mx-auto text-ink/25 mb-3" />
          <p className="text-sm text-ink/50 mb-4">Aucun site rattaché à ce contrat</p>
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
              <div key={site.id} className="panel p-4 transition-colors hover:border-accent/40 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/buildings/${site.id}`}>
                      <h3 className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors cursor-pointer">
                        {site.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={12} className="text-ink/40 flex-shrink-0" />
                      <span className="text-xs text-ink/50 truncate">{site.city} ({site.postalCode})</span>
                    </div>
                  </div>
                  {contractSite.contractType && (
                    <span className="ml-2 border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">{contractSite.contractType}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Flame size={14} className="text-ink/40" />
                    <span className="text-xs text-ink/60">{site.energyType || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-ink/40" />
                    <span className="text-xs text-ink/60">{site.surfaceChauffee || site.surface ? `${(site.surfaceChauffee || site.surface)?.toLocaleString()} m²` : "—"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                  {contractSite.coefficientPCS != null && (
                    <span className="border border-ink/15 px-2 py-0.5 font-mono tabular-nums text-ink/60" title="Coefficient PCS (kWh/m³) — conversion gaz">
                      PCS {contractSite.coefficientPCS}
                    </span>
                  )}
                  {contractSite.coefficientQ != null && (
                    <span className="border border-accent/20 px-2 py-0.5 font-mono tabular-nums text-accent" title="Coefficient Q (MWh/m³) — conversion ECS">
                      qECS {contractSite.coefficientQ}
                    </span>
                  )}
                  {site.djuContractuel != null && (
                    <span className="border border-ink/15 px-2 py-0.5 font-mono tabular-nums text-ink/60" title="DJU contractuel">
                      DJC {site.djuContractuel}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-ink/10">
                  <div className="flex gap-1">
                    {contractSite.hasP1 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P1</span>}
                    {contractSite.hasP2 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P2</span>}
                    {contractSite.hasP3 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P3</span>}
                    {contractSite.hasP4 && <span className="border border-accent/20 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-accent">P4</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditContractSiteModal(contractSite)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title="Prestations">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => openEditSiteModal(site)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <Link href={`/buildings/${site.id}`}>
                      <ArrowRight size={14} className="text-ink/25 group-hover:text-accent transition-colors" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="label-tech px-4 py-2.5 text-left">Site</th>
                <th className="label-tech px-4 py-2.5 text-left">Ville</th>
                <th className="label-tech px-4 py-2.5 text-left">Type</th>
                <th className="label-tech px-4 py-2.5 text-left">Prestations</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {filteredContractSites.map((contractSite: ContractSite) => {
                const site = contractSite.site;
                return (
                  <tr key={site.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-2.5">
                      <Link href={`/buildings/${site.id}`} className="text-sm font-medium text-ink hover:text-accent">
                        {site.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink/60">{site.city}</td>
                    <td className="px-4 py-2.5">
                      {contractSite.contractType && <span className="border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">{contractSite.contractType}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {contractSite.hasP1 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P1</span>}
                        {contractSite.hasP2 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P2</span>}
                        {contractSite.hasP3 && <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-ink/60">P3</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEditContractSiteModal(contractSite)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title="Prestations">
                          <Settings size={14} />
                        </button>
                        <button onClick={() => openEditSiteModal(site)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <Link href={`/buildings/${site.id}`}>
                          <ArrowRight size={14} className="text-ink/25" />
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
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Nouveau site</h2>
              <button onClick={() => setShowSiteModal(false)} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSite} className="p-4 space-y-3">
              <div>
                <label className="label-tech mb-1 block">Nom du site *</label>
                <input type="text" required value={siteFormData.name} onChange={(e) => setSiteFormData({ ...siteFormData, name: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="Lycée Jean Moulin" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Type *</label>
                  <select required value={siteFormData.type} onChange={(e) => setSiteFormData({ ...siteFormData, type: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                    {siteTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label-tech mb-1 block">Énergie principale *</label>
                  <select required value={siteFormData.energyType} onChange={(e) => setSiteFormData({ ...siteFormData, energyType: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                    {energyTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-tech mb-1 block">Adresse *</label>
                <input type="text" required value={siteFormData.address} onChange={(e) => setSiteFormData({ ...siteFormData, address: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="12 rue de la République" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Code postal *</label>
                  <input type="text" required value={siteFormData.postalCode} onChange={(e) => setSiteFormData({ ...siteFormData, postalCode: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="75001" />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Ville *</label>
                  <input type="text" required value={siteFormData.city} onChange={(e) => setSiteFormData({ ...siteFormData, city: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="Paris" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Surface totale (m²)</label>
                  <input type="number" value={siteFormData.surface} onChange={(e) => setSiteFormData({ ...siteFormData, surface: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="5000" />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Surface chauffée (m²)</label>
                  <input type="number" value={siteFormData.surfaceChauffee} onChange={(e) => setSiteFormData({ ...siteFormData, surfaceChauffee: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="4500" />
                </div>
              </div>
              <div className="border-t border-ink/10 pt-4 mt-4">
                <p className="label-tech mb-2">Compteurs</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-tech mb-1 block">PCE (compteur gaz)</label>
                    <input type="text" value={siteFormData.pce} onChange={(e) => setSiteFormData({ ...siteFormData, pce: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="GI123456" />
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">PDL (compteur élec)</label>
                    <input type="text" value={siteFormData.pdl} onChange={(e) => setSiteFormData({ ...siteFormData, pdl: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="12345678901234" />
                  </div>
                </div>
              </div>
              <div className="border-t border-ink/10 pt-4 mt-4">
                <p className="label-tech mb-2">Paramètres du contrat pour ce site</p>
                <div className="mb-4">
                  <label className="label-tech mb-1 block">Type de contrat *</label>
                  <select required value={siteFormData.contractType} onChange={(e) => {
                    const v = e.target.value;
                    // MTI (Marché Tout Inclus) = P1+P2+P3 cochés par défaut
                    setSiteFormData((prev) => ({ ...prev, contractType: v, ...(v === "MTI" ? { hasP1: true, hasP2: true, hasP3: true } : {}) }));
                  }} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                    {contractTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label-tech mb-2 block">Prestations incluses</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                      <input type="checkbox" checked={siteFormData.hasP1} onChange={(e) => setSiteFormData({ ...siteFormData, hasP1: e.target.checked })} className="w-4 h-4 text-accent accent-accent" />
                      <span className="text-sm text-ink">P1 - Énergie</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                      <input type="checkbox" checked={siteFormData.hasP2} onChange={(e) => setSiteFormData({ ...siteFormData, hasP2: e.target.checked })} className="w-4 h-4 text-accent accent-accent" />
                      <span className="text-sm text-ink">P2 - Maintenance</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                      <input type="checkbox" checked={siteFormData.hasP3} onChange={(e) => setSiteFormData({ ...siteFormData, hasP3: e.target.checked })} className="w-4 h-4 text-accent accent-accent" />
                      <span className="text-sm text-ink">P3 - Travaux</span>
                    </label>
                    {!contract.isPublic && (
                      <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                        <input type="checkbox" checked={siteFormData.hasP4} onChange={(e) => setSiteFormData({ ...siteFormData, hasP4: e.target.checked })} className="w-4 h-4 text-accent accent-accent" />
                        <span className="text-sm text-ink">P4 - Financement</span>
                      </label>
                    )}
                  </div>
                </div>
                {(siteFormData.hasP2 || siteFormData.hasP3) && (
                  <div className="mt-4 border border-ink/10 p-4">
                    <p className="label-tech mb-2">Montants de base (révisés annuellement)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {siteFormData.hasP2 && (
                        <div>
                          <label className="label-tech mb-1 block">Prix P2 de base (€ HT/an)</label>
                          <input type="number" step="0.01" value={siteFormData.amountP2} onChange={(e) => setSiteFormData({ ...siteFormData, amountP2: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="5000" />
                        </div>
                      )}
                      {siteFormData.hasP3 && (
                        <div>
                          <label className="label-tech mb-1 block">Prix P3 de base (€ HT/an)</label>
                          <input type="number" step="0.01" value={siteFormData.amountP3} onChange={(e) => setSiteFormData({ ...siteFormData, amountP3: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="3000" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-ink/60 mt-2">Ces montants sont révisés à la date anniversaire du contrat.</p>
                  </div>
                )}
              </div>
              <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSiteModal(false)}>Annuler</Button>
                <Button type="submit" size="sm" disabled={creatingSite}>
                  {creatingSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Création...</>) : "Créer le site"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {showEditSiteModal && editingSiteId && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Modifier le site</h2>
              <button onClick={() => { setShowEditSiteModal(false); setEditingSiteId(null); }} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateSite} className="p-4 space-y-3">
              <div>
                <label className="label-tech mb-1 block">Nom du site *</label>
                <input type="text" required value={editSiteFormData.name} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, name: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Type *</label>
                  <select required value={editSiteFormData.type} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, type: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                    {siteTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label-tech mb-1 block">Énergie principale *</label>
                  <select required value={editSiteFormData.energyType} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, energyType: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                    {energyTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-tech mb-1 block">Adresse *</label>
                <input type="text" required value={editSiteFormData.address} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, address: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Code postal *</label>
                  <input type="text" required value={editSiteFormData.postalCode} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, postalCode: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Ville *</label>
                  <input type="text" required value={editSiteFormData.city} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, city: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Surface totale (m²)</label>
                  <input type="number" value={editSiteFormData.surface} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, surface: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Surface chauffée (m²)</label>
                  <input type="number" value={editSiteFormData.surfaceChauffee} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, surfaceChauffee: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                </div>
              </div>
              <div className="border-t border-ink/10 pt-4 mt-4">
                <p className="label-tech mb-2">Compteurs</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-tech mb-1 block">PCE (compteur gaz)</label>
                    <input type="text" value={editSiteFormData.pce} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, pce: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">PDL (compteur élec)</label>
                    <input type="text" value={editSiteFormData.pdl} onChange={(e) => setEditSiteFormData({ ...editSiteFormData, pdl: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" />
                  </div>
                </div>
              </div>
              <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowEditSiteModal(false); setEditingSiteId(null); }}>Annuler</Button>
                <Button type="submit" size="sm" disabled={updatingSite}>
                  {updatingSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit ContractSite Modal */}
      {showEditContractSiteModal && editingContractSiteId && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Modifier les prestations</h2>
              <button onClick={() => { setShowEditContractSiteModal(false); setEditingContractSiteId(null); }} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdateContractSite} className="p-4 space-y-3">
              <div>
                <label className="label-tech mb-1 block">Type de contrat</label>
                <select value={editContractSiteFormData.contractType} onChange={(e) => {
                  const v = e.target.value;
                  // MTI (Marché Tout Inclus) = P1+P2+P3 cochés par défaut
                  setEditContractSiteFormData((prev) => ({ ...prev, contractType: v, ...(v === "MTI" ? { hasP1: true, hasP2: true, hasP3: true } : {}) }));
                }} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                  {contractTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                </select>
              </div>
              <div className="border-t border-ink/10 pt-4">
                <p className="label-tech mb-2">Prestations incluses</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                    <input type="checkbox" checked={editContractSiteFormData.hasP1} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP1: e.target.checked })} className="w-4 h-4 border-ink/20 text-accent accent-accent" />
                    <span className="text-sm">P1 - Combustible</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                    <input type="checkbox" checked={editContractSiteFormData.hasP2} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP2: e.target.checked })} className="w-4 h-4 border-ink/20 text-accent accent-accent" />
                    <span className="text-sm">P2 - Petit entretien</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                    <input type="checkbox" checked={editContractSiteFormData.hasP3} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP3: e.target.checked })} className="w-4 h-4 border-ink/20 text-accent accent-accent" />
                    <span className="text-sm">P3 - Gros entretien</span>
                  </label>
                  {!contract.isPublic && (
                    <label className="flex items-center gap-2 p-3 border border-ink/10 cursor-pointer hover:bg-ink/[0.02]">
                      <input type="checkbox" checked={editContractSiteFormData.hasP4} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, hasP4: e.target.checked })} className="w-4 h-4 border-ink/20 text-accent accent-accent" />
                      <span className="text-sm">P4 - Financement</span>
                    </label>
                  )}
                </div>
              </div>
              <div className="border-t border-ink/10 pt-4">
                <p className="label-tech mb-2">Montants annuels</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-tech mb-1 block">Montant P2 (€/an)</label>
                    <input type="number" step="0.01" value={editContractSiteFormData.amountP2} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, amountP2: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Montant P3 (€/an)</label>
                    <input type="number" step="0.01" value={editContractSiteFormData.amountP3} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, amountP3: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div className="border-t border-ink/10 pt-4">
                <p className="label-tech mb-2">Coefficients de conversion énergétique</p>
                <div className="space-y-4">
                  <div>
                    <label className="label-tech mb-1 block">Coefficient PCS — gaz (kWh/m³)</label>
                    <div className="flex gap-2 items-center">
                      <input type="number" step="0.1" value={editContractSiteFormData.coefficientPCS} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: e.target.value })} className="w-32 px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="10.5" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: "10.5" })} className={`px-3 py-1.5 text-xs border transition-colors ${editContractSiteFormData.coefficientPCS === "10.5" ? "bg-ink text-paper border-ink" : "bg-white text-ink/60 border-ink/20 hover:border-accent hover:text-accent"}`}>20 mbar</button>
                        <button type="button" onClick={() => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientPCS: "14.5" })} className={`px-3 py-1.5 text-xs border transition-colors ${editContractSiteFormData.coefficientPCS === "14.5" ? "bg-ink text-paper border-ink" : "bg-white text-ink/60 border-ink/20 hover:border-accent hover:text-accent"}`}>300 mbar</button>
                      </div>
                    </div>
                    <p className="text-xs text-ink/50 mt-1">20 mbar (basse pression) : ~10.5 | 300 mbar (moyenne pression) : ~14.5</p>
                  </div>
                  <div>
                    <label className="label-tech mb-1 block">Coefficient Q — ECS (MWh/m³)</label>
                    <input type="number" step="0.01" value={editContractSiteFormData.coefficientQ} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, coefficientQ: e.target.value })} className="w-32 px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="0.13" />
                    <p className="text-xs text-ink/50 mt-1">Énergie pour produire 1 m³ d&apos;ECS — typiquement 0.10 à 0.14 selon le contrat</p>
                  </div>
                </div>
                {editContractSiteFormData.hasP1 && (
                  <div className="mt-4 pt-4 border-t border-ink/10">
                    <p className="label-tech mb-1">Barème P1 — décompte (€HT/MWh PCS)</p>
                    <p className="text-xs text-ink/50 mb-3">Valeurs de base pour la révision indicielle. Normalement importées de la DPGF ; à compléter ici si besoin. P0 = marge exploitant (non révisée).</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {([
                        ["p1Peg0", "PEG"],
                        ["p1Ticgn0", "TICGN"],
                        ["p1Tvd0", "TVD"],
                        ["p1Cee0", "CEE"],
                        ["p1P0Unit", "P0 (marge)"],
                      ] as const).map(([field, label]) => (
                        <div key={field}>
                          <label className="label-tech mb-1 block">{label}</label>
                          <input type="number" step="0.001" value={editContractSiteFormData[field]} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, [field]: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm" placeholder="0.000" />
                        </div>
                      ))}
                      <div>
                        <label className="label-tech mb-1 block">Tarif TVD (GRDF)</label>
                        <select value={editContractSiteFormData.p1TvdTarif} onChange={(e) => setEditContractSiteFormData({ ...editContractSiteFormData, p1TvdTarif: e.target.value })} className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none text-sm">
                          <option value="">—</option>
                          <option value="T1">T1</option>
                          <option value="T2">T2</option>
                          <option value="T3">T3</option>
                          <option value="T4">T4</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowEditContractSiteModal(false); setEditingContractSiteId(null); }}>Annuler</Button>
                <Button type="submit" size="sm" disabled={updatingContractSite}>
                  {updatingContractSite ? (<><Loader2 size={18} className="mr-2 animate-spin" />Mise à jour...</>) : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Sites Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className={`bg-white border border-ink/10 shadow-large w-full max-h-[90vh] overflow-y-auto ${importStep === "preview" ? "max-w-4xl" : "max-w-lg"}`}>
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-ink">Importer des sites</h2>
              <button onClick={() => setShowImportModal(false)} title="Fermer" className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={18} /></button>
            </div>
            <div className="p-4">
              {importStep === "upload" && (
                <div className="space-y-4">
                  <p className="text-sm text-ink/60">
                    Importez un fichier Excel (.xlsx) contenant vos sites. Le fichier doit contenir les colonnes : Nom, Type, Adresse, Ville, Code postal, Surface, Énergie.
                  </p>
                  <div className={`border border-dashed p-4 text-center transition-colors ${importFile ? "border-accent bg-accent/5" : "border-ink/20 hover:border-accent/40"}`}>
                    {importFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet size={24} className="text-accent" />
                        <div className="text-left">
                          <p className="font-medium text-ink">{importFile.name}</p>
                          <p className="text-sm text-ink/60">{(importFile.size / 1024).toFixed(1)} Ko</p>
                        </div>
                        <button onClick={() => setImportFile(null)} title="Retirer le fichier" className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"><X size={16} /></button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload size={28} className="mx-auto text-ink/40 mb-2" />
                        <p className="text-ink font-medium">Cliquez pour sélectionner un fichier</p>
                        <p className="text-sm text-ink/60">ou glissez-déposez ici</p>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setImportFile(file); }} />
                      </label>
                    )}
                  </div>
                  <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                    <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>Annuler</Button>
                    <Button size="sm" disabled={!importFile || importing} onClick={handleImportPreview}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Analyse...</>) : "Suivant →"}
                    </Button>
                  </div>
                </div>
              )}
              {importStep === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-ink/60">
                    <strong>{previewSites.length} site{previewSites.length > 1 ? "s" : ""}</strong> à importer pour le contrat <strong>{contract?.reference}</strong>. Vous pouvez modifier les données avant l&apos;import.
                  </p>
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-sm">
                      <thead className="border-y border-ink/10">
                        <tr>
                          <th className="label-tech px-3 py-2 text-left">Nom</th>
                          <th className="label-tech px-3 py-2 text-left">Adresse</th>
                          <th className="label-tech px-3 py-2 text-left">CP</th>
                          <th className="label-tech px-3 py-2 text-left">Ville</th>
                          <th className="label-tech px-3 py-2 text-left">Énergie</th>
                          <th className="label-tech px-3 py-2 text-left">Surface</th>
                          <th className="label-tech px-2 py-2 text-center">P1</th>
                          <th className="label-tech px-2 py-2 text-center">P2</th>
                          <th className="label-tech px-2 py-2 text-center">P3</th>
                          <th className="label-tech px-2 py-2 text-center">P4</th>
                          <th className="label-tech px-3 py-2 text-left">Type contrat</th>
                          <th className="label-tech px-3 py-2 text-left">Montant P2</th>
                          <th className="label-tech px-3 py-2 text-left">Montant P3</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {previewSites.map((site, index) => (
                          <tr key={index} className="hover:bg-ink/[0.02]">
                            <td className="px-3 py-2"><input type="text" value={site.name} onChange={(e) => updatePreviewSite(index, "name", e.target.value)} className="w-full min-w-[120px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.address || ""} onChange={(e) => updatePreviewSite(index, "address", e.target.value)} className="w-full min-w-[150px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.postalCode || ""} onChange={(e) => updatePreviewSite(index, "postalCode", e.target.value)} className="w-[70px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" /></td>
                            <td className="px-3 py-2"><input type="text" value={site.city || ""} onChange={(e) => updatePreviewSite(index, "city", e.target.value)} className="w-full min-w-[100px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" /></td>
                            <td className="px-3 py-2">
                              <select value={site._energyType} onChange={(e) => updatePreviewSite(index, "_energyType", e.target.value)} className="w-full min-w-[90px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none">
                                {Object.entries(energyTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="number" value={site.surface || ""} onChange={(e) => updatePreviewSite(index, "surface", e.target.value ? Number(e.target.value) : undefined)} className="w-[80px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" placeholder="m²" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP1 || false} onChange={(e) => updatePreviewSite(index, "hasP1", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP2 || false} onChange={(e) => updatePreviewSite(index, "hasP2", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP3 || false} onChange={(e) => updatePreviewSite(index, "hasP3", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-2 py-2 text-center"><input type="checkbox" checked={site.hasP4 || false} onChange={(e) => updatePreviewSite(index, "hasP4", e.target.checked)} className="w-4 h-4" /></td>
                            <td className="px-3 py-2">
                              <select value={site._contractType} onChange={(e) => updatePreviewSite(index, "_contractType", e.target.value)} className="w-full min-w-[70px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none">
                                {Object.entries(contractTypeLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="number" value={site.amountP2 || ""} onChange={(e) => updatePreviewSite(index, "amountP2", e.target.value ? Number(e.target.value) : undefined)} className="w-[90px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" placeholder="€" /></td>
                            <td className="px-3 py-2"><input type="number" value={site.amountP3 || ""} onChange={(e) => updatePreviewSite(index, "amountP3", e.target.value ? Number(e.target.value) : undefined)} className="w-[90px] px-2 py-1 border border-ink/20 bg-white text-sm focus:border-accent focus:outline-none" placeholder="€" /></td>
                            <td className="px-2 py-2"><button onClick={() => removePreviewSite(index)} title="Supprimer" className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"><X size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                    <Button variant="outline" size="sm" onClick={() => setImportStep("upload")}>← Retour</Button>
                    <Button size="sm" disabled={previewSites.length === 0 || importing} onClick={handleImport}>
                      {importing ? (<><Loader2 size={18} className="mr-2 animate-spin" />Import...</>) : (<><CheckCircle size={18} className="mr-2" />Importer ({previewSites.length})</>)}
                    </Button>
                  </div>
                </div>
              )}
              {importStep === "result" && importResult && (
                <div className="text-center py-4">
                  {importResult.success ? (
                    <>
                      <CheckCircle size={32} className="mx-auto text-green-600 mb-3" />
                      <h3 className="text-sm font-semibold text-ink mb-2">Import réussi !</h3>
                      <p className="text-sm text-ink/60 mb-4">{importResult.imported} site{importResult.imported > 1 ? "s" : ""} importé{importResult.imported > 1 ? "s" : ""}</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={32} className="mx-auto text-red-600 mb-3" />
                      <h3 className="text-sm font-semibold text-red-700 mb-2">Erreur</h3>
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
