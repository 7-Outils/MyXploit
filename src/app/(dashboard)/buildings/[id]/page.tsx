"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Flame,
  Zap,
  Droplets,
  Thermometer,
  TreePine,
  Gauge,
  BarChart3,
  Loader2,
  ClipboardList,
  Plus,
  FileText,
  Wrench,
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import ThermalProfileSection from "@/components/energy/ThermalProfileSection";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionContext";

interface SiteDetail {
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
  djuContractuel: number | null;
  stationMeteo: string | null;
  pce: string | null;
  pdl: string | null;
  rae: string | null;
  constructionYear: number | null;
  numberOfFloors: number | null;
  buildingHeight: number | null;
  volumeChauffee: number | null;
  insulationLevel: string | null;
  glazingType: string | null;
  ventilationType: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  contractSites: Array<{
    id: string;
    contractType: string;
    hasP1: boolean;
    hasP2: boolean;
    hasP3: boolean;
    contract: {
      id: string;
      reference: string;
      title: string;
      provider: string;
    };
  }>;
}

const SITE_TYPE_LABELS: Record<string, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

const ENERGY_CONFIG: Record<
  string,
  { label: string; icon: typeof Flame; color: string }
> = {
  GAZ: { label: "Gaz", icon: Flame, color: "text-orange-500" },
  ELECTRICITE: { label: "Électricité", icon: Zap, color: "text-yellow-500" },
  FIOUL: { label: "Fioul", icon: Droplets, color: "text-gray-600" },
  BOIS: { label: "Bois", icon: TreePine, color: "text-green-600" },
  RESEAU_CHALEUR: { label: "Réseau de chaleur", icon: Thermometer, color: "text-red-500" },
  EAU: { label: "Eau", icon: Droplets, color: "text-blue-500" },
  AUTRE: { label: "Autre", icon: Flame, color: "text-gray-400" },
};

const INSULATION_LABELS: Record<string, string> = {
  AUCUNE: "Aucune isolation",
  PARTIELLE: "Isolation partielle",
  RT1974: "RT 1974",
  RT1988: "RT 1988",
  RT2000: "RT 2000",
  RT2005: "RT 2005",
  RT2012: "RT 2012",
  RE2020: "RE 2020",
};

const GLAZING_LABELS: Record<string, string> = {
  SIMPLE: "Simple vitrage",
  DOUBLE: "Double vitrage",
  DOUBLE_FE: "Double vitrage FE",
  TRIPLE: "Triple vitrage",
};

const VENTILATION_LABELS: Record<string, string> = {
  NATURELLE: "Ventilation naturelle",
  SIMPLE_FLUX: "Simple flux",
  HYGRO_B: "Hygro B",
  DOUBLE_FLUX: "Double flux",
};

type TabKey = "overview" | "general" | "energy" | "thermal" | "contract" | "exploitation" | "meters" | "journal";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: "general", label: "Identité & Bâti", icon: Building2 },
  { key: "energy", label: "Énergie & Compteurs", icon: BarChart3 },
  { key: "thermal", label: "Profil thermique", icon: Thermometer },
  { key: "contract", label: "Contrat & Finances", icon: FileText },
  { key: "exploitation", label: "Exploitation", icon: Wrench },
  { key: "meters", label: "Compteurs", icon: Gauge },
  { key: "journal", label: "Journal", icon: ClipboardList },
];

export default function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { canEdit: userCanEdit } = usePermissions();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSite = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSite(data);
      }
    } catch (error) {
      console.error("Error fetching site:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">
          Bâtiment non trouvé
        </h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/buildings")}
        >
          <ArrowLeft size={16} className="mr-2" />
          Retour aux bâtiments
        </Button>
      </div>
    );
  }

  const energy = ENERGY_CONFIG[site.energyType];
  const EnergyIcon = energy?.icon || Flame;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/buildings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Bâtiments
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-primary-dark">
                {site.name}
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                {SITE_TYPE_LABELS[site.type] || site.type}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-gray-400" />
                <span className="text-sm text-gray-500">
                  {site.address}, {site.city} {site.postalCode}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <EnergyIcon size={13} className={energy?.color || "text-gray-400"} />
                <span className="text-sm text-gray-500">
                  {energy?.label || site.energyType}
                </span>
              </div>
            </div>
          </div>

          {/* Contract badges */}
          <div className="flex flex-col items-end gap-1">
            {site.contractSites.map((cs) => (
              <div
                key={cs.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-gray-500">
                  {cs.contract.reference}
                </span>
                <div className="flex gap-1">
                  {cs.hasP1 && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                      P1
                    </span>
                  )}
                  {cs.hasP2 && (
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                      P2
                    </span>
                  )}
                  {cs.hasP3 && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
                      P3
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && (
          <OverviewTab site={site} onNavigate={setActiveTab} />
        )}
        {activeTab === "general" && (
          <GeneralTab site={site} onRefresh={fetchSite} />
        )}
        {activeTab === "energy" && (
          <EnergyTab siteId={site.id} />
        )}
        {activeTab === "thermal" && (
          <ThermalProfileSection siteId={site.id} />
        )}
        {activeTab === "contract" && (
          <ContractTab site={site} />
        )}
        {activeTab === "exploitation" && (
          <ExploitationTab siteId={site.id} />
        )}
        {activeTab === "meters" && (
          <MetersPlaceholder siteId={site.id} siteName={site.name} />
        )}
        {activeTab === "journal" && (
          <ActivityLogTab siteId={site.id} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// General Tab
// ============================================================

function GeneralTab({
  site,
  onRefresh,
}: {
  site: SiteDetail;
  onRefresh: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Informations générales */}
      <ChartCard title="Informations générales">
        <div className="space-y-4">
          <InfoRow label="Nom" value={site.name} />
          <InfoRow
            label="Type"
            value={SITE_TYPE_LABELS[site.type] || site.type}
          />
          <InfoRow
            label="Adresse"
            value={`${site.address}, ${site.city} ${site.postalCode}`}
          />
          <InfoRow
            label="Énergie"
            value={ENERGY_CONFIG[site.energyType]?.label || site.energyType}
          />
          {site.stationMeteo && (
            <InfoRow label="Station météo" value={site.stationMeteo} />
          )}
        </div>
      </ChartCard>

      {/* Caractéristiques du bâtiment */}
      <ChartCard title="Caractéristiques du bâtiment">
        <div className="space-y-4">
          {site.constructionYear && (
            <InfoRow
              label="Année de construction"
              value={String(site.constructionYear)}
            />
          )}
          <InfoRow
            label="Surface totale"
            value={
              site.surface ? `${site.surface.toLocaleString()} m²` : "-"
            }
          />
          <InfoRow
            label="Surface chauffée"
            value={
              site.surfaceChauffee
                ? `${site.surfaceChauffee.toLocaleString()} m²`
                : "-"
            }
          />
          <InfoRow
            label="Volume chauffé"
            value={
              site.volumeChauffee
                ? `${site.volumeChauffee.toLocaleString()} m³`
                : "-"
            }
          />
          {site.numberOfFloors && (
            <InfoRow
              label="Nombre d'étages"
              value={String(site.numberOfFloors)}
            />
          )}
          {site.buildingHeight && (
            <InfoRow
              label="Hauteur"
              value={`${site.buildingHeight} m`}
            />
          )}
          {site.insulationLevel && (
            <InfoRow
              label="Isolation"
              value={INSULATION_LABELS[site.insulationLevel] || site.insulationLevel}
            />
          )}
          {site.glazingType && (
            <InfoRow
              label="Vitrage"
              value={GLAZING_LABELS[site.glazingType] || site.glazingType}
            />
          )}
          {site.ventilationType && (
            <InfoRow
              label="Ventilation"
              value={VENTILATION_LABELS[site.ventilationType] || site.ventilationType}
            />
          )}
        </div>
      </ChartCard>

      {/* Références énergie */}
      <ChartCard title="Références énergie">
        <div className="space-y-4">
          {site.pce && <InfoRow label="PCE (gaz)" value={site.pce} />}
          {site.pdl && <InfoRow label="PDL (élec)" value={site.pdl} />}
          {site.rae && <InfoRow label="RAE" value={site.rae} />}
          {site.nb != null && (
            <InfoRow
              label="Niveau de Base"
              value={`${site.nb} ${site.nbUnit === "PCS" ? "MWh PCS" : "MWh utile"}`}
            />
          )}
          {site.djuContractuel != null && (
            <InfoRow
              label="DJU contractuels"
              value={`${site.djuContractuel}`}
            />
          )}
        </div>
      </ChartCard>

      {/* Contrats liés */}
      <ChartCard title="Contrats associés">
        <div className="space-y-3">
          {site.contractSites.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun contrat lié</p>
          ) : (
            site.contractSites.map((cs) => (
              <Link
                key={cs.id}
                href={`/contracts/${cs.contract.id}`}
                className="block p-3 rounded-lg border border-gray-100 hover:border-accent/30 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cs.contract.reference}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cs.contract.title} - {cs.contract.provider}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {cs.hasP1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        P1
                      </span>
                    )}
                    {cs.hasP2 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                        P2
                      </span>
                    )}
                    {cs.hasP3 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
                        P3
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Type : {cs.contractType}
                </p>
              </Link>
            ))
          )}
        </div>
      </ChartCard>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ============================================================
// Overview Tab - Site 360° Dashboard
// ============================================================

interface OverviewStats {
  consumptions: { total: number; lastMonth: number | null; trend: number | null };
  tickets: { open: number; inProgress: number; total: number };
  contractInfo: { provider: string; reference: string; endDate: string | null; hasP1: boolean; hasP2: boolean; hasP3: boolean; amountP2: number | null; amountP3: number | null } | null;
  equipmentCount: number;
  alertCount: number;
}

function OverviewTab({ site, onNavigate }: { site: SiteDetail; onNavigate: (tab: TabKey) => void }) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sites/${site.id}/overview`);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [site.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const cs = site.contractSites[0];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => onNavigate("energy")} className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-accent/40 transition-colors">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <TrendingUp size={14} />
            Consommation
          </div>
          <p className="text-xl font-bold text-primary-dark">
            {stats?.consumptions.lastMonth != null ? `${Math.round(stats.consumptions.lastMonth).toLocaleString()} kWh` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Dernier mois</p>
        </button>

        <button onClick={() => onNavigate("exploitation")} className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-accent/40 transition-colors">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Wrench size={14} />
            Tickets ouverts
          </div>
          <p className="text-xl font-bold text-primary-dark">
            {stats?.tickets.open ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{stats?.tickets.inProgress ?? 0} en cours</p>
        </button>

        <button onClick={() => onNavigate("contract")} className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-accent/40 transition-colors">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Euro size={14} />
            Contrat
          </div>
          <p className="text-xl font-bold text-primary-dark">
            {stats?.contractInfo?.provider || cs?.contract.provider || "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {cs ? [cs.hasP1 && "P1", cs.hasP2 && "P2", cs.hasP3 && "P3"].filter(Boolean).join(" · ") : "Aucun contrat"}
          </p>
        </button>

        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <AlertTriangle size={14} />
            Alertes
          </div>
          <p className="text-xl font-bold text-primary-dark">
            {stats?.alertCount ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{stats?.equipmentCount ?? 0} équipement(s)</p>
        </div>
      </div>

      {/* Quick Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Site Identity */}
        <ChartCard title="Identité du bâtiment">
          <div className="space-y-3">
            <InfoRow label="Adresse" value={`${site.address}, ${site.city} ${site.postalCode}`} />
            <InfoRow label="Surface" value={site.surface ? `${site.surface.toLocaleString()} m²` : "—"} />
            <InfoRow label="Énergie" value={ENERGY_CONFIG[site.energyType]?.label || site.energyType} />
            {site.pce && <InfoRow label="PCE (gaz)" value={site.pce} />}
            {site.pdl && <InfoRow label="PDL (élec)" value={site.pdl} />}
            {site.stationMeteo && <InfoRow label="Station météo" value={site.stationMeteo} />}
          </div>
        </ChartCard>

        {/* Contract Summary */}
        <ChartCard title="Contrat actif">
          {site.contractSites.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucun contrat lié</p>
          ) : (
            <div className="space-y-3">
              {site.contractSites.map((cs) => (
                <div key={cs.id} className="p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cs.contract.reference}</p>
                      <p className="text-xs text-gray-500">{cs.contract.title} — {cs.contract.provider}</p>
                    </div>
                    <div className="flex gap-1">
                      {cs.hasP1 && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">P1</span>}
                      {cs.hasP2 && <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">P2</span>}
                      {cs.hasP3 && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">P3</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Type : {cs.contractType}</p>
                </div>
              ))}
              <button
                onClick={() => onNavigate("contract")}
                className="w-full text-center text-xs text-accent hover:underline py-1"
              >
                Voir détail contrat & finances →
              </button>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================
// Energy Tab - Consommations & compteurs inline
// ============================================================

function EnergyTab({ siteId }: { siteId: string }) {
  const [consumptions, setConsumptions] = useState<Array<{ period: string; quantity: number; unit: string; energyType: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sites/${siteId}/consumptions?limit=24`);
        if (res.ok) {
          const data = await res.json();
          setConsumptions(data.consumptions || data || []);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compteurs */}
        <ChartCard title="Points de livraison">
          <div className="space-y-3">
            <Link href={`/sites/${siteId}`} className="block">
              <Button variant="outline" className="w-full">
                <Gauge size={16} className="mr-2" />
                Gérer les compteurs & relevés
              </Button>
            </Link>
          </div>
        </ChartCard>

        {/* Télérelève */}
        <ChartCard title="Télérelève">
          <div className="space-y-3">
            <Link href="/energy?tab=telereleve">
              <Button variant="outline" className="w-full">
                <BarChart3 size={16} className="mr-2" />
                Configurer la télérelève GRDF / Enedis
              </Button>
            </Link>
          </div>
        </ChartCard>
      </div>

      {/* Consommations table */}
      <ChartCard title={`Consommations (${consumptions.length} relevés)`}>
        {consumptions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune consommation enregistrée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Période</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-medium">Type</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Quantité</th>
                  <th className="text-right py-2 text-xs text-gray-500 font-medium">Unité</th>
                </tr>
              </thead>
              <tbody>
                {consumptions.slice(0, 12).map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">
                      {new Date(c.period).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2 text-gray-600">{c.energyType}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {Math.round(c.quantity).toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-gray-500">{c.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ============================================================
// Contract & Finances Tab
// ============================================================

interface ContractSiteDetail {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  coefficientPCS: number | null;
  integrationDate: string | null;
  exitDate: string | null;
  contract: {
    id: string;
    reference: string;
    title: string;
    provider: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

function ContractTab({ site }: { site: SiteDetail }) {
  const [contractSites, setContractSites] = useState<ContractSiteDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sites/${site.id}/contracts`);
        if (res.ok) {
          const data = await res.json();
          setContractSites(data.contractSites || []);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [site.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (contractSites.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">Aucun contrat</h3>
        <p className="text-sm text-gray-500">Ce site n{"'"}est rattaché à aucun contrat d{"'"}exploitation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {contractSites.map((cs) => (
        <div key={cs.id} className="space-y-4">
          {/* Contract header */}
          <ChartCard title={`${cs.contract.reference} — ${cs.contract.provider}`}>
            <div className="space-y-3">
              <InfoRow label="Titre" value={cs.contract.title} />
              <InfoRow label="Type de contrat" value={cs.contractType} />
              <InfoRow label="Statut" value={cs.contract.status} />
              <InfoRow
                label="Période"
                value={`${new Date(cs.contract.startDate).toLocaleDateString("fr-FR")} → ${new Date(cs.contract.endDate).toLocaleDateString("fr-FR")}`}
              />
              {cs.integrationDate && (
                <InfoRow label="Intégration site" value={new Date(cs.integrationDate).toLocaleDateString("fr-FR")} />
              )}
              {cs.coefficientPCS != null && (
                <InfoRow label="Coefficient PCS" value={`${cs.coefficientPCS} kWh/m³`} />
              )}
              <div className="pt-2">
                <Link href={`/contracts/${cs.contract.id}`}>
                  <Button variant="outline" size="sm">
                    <FileText size={14} className="mr-1" />
                    Voir le contrat complet
                  </Button>
                </Link>
              </div>
            </div>
          </ChartCard>

          {/* Prestations & montants */}
          <ChartCard title="Prestations & montants annuels">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cs.hasP1 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium">P1 — Combustible</p>
                  <p className="text-lg font-bold text-blue-800 mt-1">
                    {cs.amountP1 != null ? `${cs.amountP1.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—"}
                  </p>
                </div>
              )}
              {cs.hasP2 && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xs text-green-600 font-medium">P2 — Petit entretien</p>
                  <p className="text-lg font-bold text-green-800 mt-1">
                    {cs.amountP2 != null ? `${cs.amountP2.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—"}
                  </p>
                </div>
              )}
              {cs.hasP3 && (
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-xs text-orange-600 font-medium">P3 — Gros entretien</p>
                  <p className="text-lg font-bold text-orange-800 mt-1">
                    {cs.amountP3 != null ? `${cs.amountP3.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €` : "—"}
                  </p>
                </div>
              )}
              {cs.hasP4 && (
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-xs text-purple-600 font-medium">P4 — Financement</p>
                  <p className="text-lg font-bold text-purple-800 mt-1">—</p>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Exploitation Tab - Tickets & interventions for this site
// ============================================================

interface SiteTicket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  source: string;
}

const TICKET_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Ouvert", color: "bg-red-100 text-red-700" },
  IN_PROGRESS: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  RESOLVED: { label: "Résolu", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "Fermé", color: "bg-gray-100 text-gray-600" },
};

function ExploitationTab({ siteId }: { siteId: string }) {
  const [tickets, setTickets] = useState<SiteTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sites/${siteId}/tickets`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const open = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500">Total tickets</p>
          <p className="text-2xl font-bold text-primary-dark">{tickets.length}</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500">Ouverts / En cours</p>
          <p className="text-2xl font-bold text-red-600">{open.length}</p>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500">Résolus</p>
          <p className="text-2xl font-bold text-green-600">{tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length}</p>
        </div>
      </div>

      {/* Tickets list */}
      <ChartCard title={`Tickets (${tickets.length})`}>
        {tickets.length === 0 ? (
          <div className="text-center py-8">
            <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Aucun ticket pour ce site</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const statusConf = TICKET_STATUS_CONFIG[ticket.status] || { label: ticket.status, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={ticket.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusConf.color}`}>
                    {statusConf.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(ticket.createdAt).toLocaleDateString("fr-FR")} · {ticket.source}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Link href="/exploitation">
            <Button variant="outline" size="sm" className="w-full">
              <Wrench size={14} className="mr-1" />
              Voir toute l{"'"}exploitation
            </Button>
          </Link>
        </div>
      </ChartCard>
    </div>
  );
}

// ============================================================
// Meters placeholder - link to existing meters page
// ============================================================

function MetersPlaceholder({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Gauge size={40} className="text-gray-300 mb-3" />
      <h3 className="text-lg font-medium text-gray-700 mb-1">
        Compteurs & relevés
      </h3>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
        Gérez les compteurs principaux et divisionnaires, les relevés et les
        conversions de ce bâtiment.
      </p>
      <Link href={`/sites/${siteId}`}>
        <Button>
          <Gauge size={16} className="mr-2" />
          Gérer les compteurs
        </Button>
      </Link>
    </div>
  );
}

// ============================================================
// Activity Log Tab (Journal d'activité)
// ============================================================

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  PANNE_CHAUFFAGE: "Panne chauffage",
  PANNE_ECS: "Panne ECS",
  PANNE_VENTILATION: "Panne ventilation",
  FUITE: "Fuite",
  DYSFONCTIONNEMENT: "Dysfonctionnement",
  COUPURE: "Coupure énergie",
  PLAINTE_USAGER: "Plainte usager",
  INTERVENTION: "Intervention",
  INCIDENT: "Incident",
  ASSIGNATION: "Assignation",
  NOTE: "Note",
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  PANNE_CHAUFFAGE: "bg-red-100 text-red-700",
  PANNE_ECS: "bg-red-100 text-red-700",
  PANNE_VENTILATION: "bg-red-100 text-red-700",
  FUITE: "bg-orange-100 text-orange-700",
  DYSFONCTIONNEMENT: "bg-amber-100 text-amber-700",
  COUPURE: "bg-red-100 text-red-700",
  PLAINTE_USAGER: "bg-purple-100 text-purple-700",
  INTERVENTION: "bg-blue-100 text-blue-700",
  INCIDENT: "bg-orange-100 text-orange-700",
  ASSIGNATION: "bg-gray-100 text-gray-600",
  NOTE: "bg-gray-100 text-gray-700",
};

interface ActivityLog {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  activityDate: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

function ActivityLogTab({ siteId }: { siteId: string }) {
  const { canEdit: userCanEdit } = usePermissions();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    activityType: "INCIDENT",
    title: "",
    description: "",
    activityDate: new Date().toISOString().split("T")[0],
  });

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/activity-log`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/activity-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ activityType: "NOTE", title: "", description: "", activityDate: new Date().toISOString().split("T")[0] });
        await fetchLogs();
      }
    } catch (error) {
      console.error("Error creating log:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {userCanEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nouvelle entrée
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <ChartCard title="Nouvelle entrée">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                >
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.activityDate}
                  onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Panne chaudière bâtiment A"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Détails supplémentaires..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </ChartCard>
      )}

      {/* Timeline */}
      {logs.length === 0 ? (
        <ChartCard title="">
          <div className="text-center py-8">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucune activité enregistrée pour ce site</p>
          </div>
        </ChartCard>
      ) : (
        <ChartCard title={`Journal d'activité (${logs.length})`}>
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTIVITY_TYPE_COLORS[log.activityType] || "bg-gray-100 text-gray-700"}`}>
                    {ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{log.title}</p>
                  {log.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(log.activityDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    {" - "}
                    {log.user.firstName || ""} {log.user.lastName || ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
