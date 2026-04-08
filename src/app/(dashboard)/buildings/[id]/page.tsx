"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
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
  Calendar,
  BarChart3,
  Loader2,
  ClipboardList,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  ConsumptionTimeChart,
  type ConsumptionPoint,
} from "@/components/dashboard/consumption-time-chart";
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

type TabKey = "general" | "energy" | "thermal" | "zones" | "meters" | "journal";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: "general", label: "Général", icon: Building2 },
  { key: "energy", label: "Énergie", icon: BarChart3 },
  { key: "thermal", label: "Profil thermique", icon: Thermometer },
  { key: "zones", label: "Zones", icon: Calendar },
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
  const [activeTab, setActiveTab] = useState<TabKey>("general");
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
        {activeTab === "general" && (
          <GeneralTab site={site} onRefresh={fetchSite} />
        )}
        {activeTab === "energy" && (
          <EnergyTab siteId={site.id} />
        )}
        {activeTab === "thermal" && (
          <ThermalProfileSection siteId={site.id} />
        )}
        {activeTab === "zones" && (
          <ZonesPlaceholder siteId={site.id} />
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
// Energy Tab — daily / monthly consumption chart with date range filter
// ============================================================

interface ConsumptionRecord {
  id: string;
  energyType: string;
  usage: string;
  period: string;
  quantity: number;
  unit: string;
  cost: number | null;
  /**
   * Set when the record was imported from an exploitant Excel sheet
   * (IDEX, Engie, Dalkia…). Null when synced automatically from GRDF/Enedis.
   * The Energy tab on the building detail only shows exploitant data;
   * GRDF/Enedis raw data is shown in the Télérelève tab.
   */
  meterName: string | null;
}

const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#3b82f6",
  FIOUL: "#78716c",
  BOIS: "#84cc16",
  RESEAU_CHALEUR: "#ef4444",
  EAU: "#06b6d4",
  AUTRE: "#9ca3af",
};

const ENERGY_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau de chaleur",
  EAU: "Eau",
  AUTRE: "Autre",
};

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function EnergyTab({ siteId }: { siteId: string }) {
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(daysAgoIso(90));
  const [dateTo, setDateTo] = useState<string>(todayIso());
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/consumptions?siteId=${siteId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Erreur de chargement des consommations");
        return r.json();
      })
      .then((data: ConsumptionRecord[]) => {
        if (cancelled) return;
        // Only keep exploitant data (manually imported with a meterName).
        // Raw GRDF/Enedis sync data has meterName === null and lives in
        // the Télérelève tab, not here.
        setConsumptions(data.filter((c) => c.meterName !== null));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Available energy types in this site's exploitant data
  const availableEnergies = useMemo(() => {
    const set = new Set<string>();
    consumptions.forEach((c) => set.add(c.energyType));
    return Array.from(set).sort();
  }, [consumptions]);

  // Default selected energy when data first loads
  useEffect(() => {
    if (selectedEnergy === null && availableEnergies.length > 0) {
      // Prefer GAZ, then ELECTRICITE, otherwise first available
      const preferred = availableEnergies.includes("GAZ")
        ? "GAZ"
        : availableEnergies.includes("ELECTRICITE")
        ? "ELECTRICITE"
        : availableEnergies[0];
      setSelectedEnergy(preferred);
    }
  }, [availableEnergies, selectedEnergy]);

  // Filtered records (energy type + date range)
  const filtered = useMemo(() => {
    if (!selectedEnergy) return [];
    const fromTs = new Date(dateFrom).getTime();
    const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    return consumptions.filter((c) => {
      if (c.energyType !== selectedEnergy) return false;
      const t = new Date(c.period).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [consumptions, selectedEnergy, dateFrom, dateTo]);

  // Convert to chart format
  const chartData: ConsumptionPoint[] = useMemo(
    () =>
      filtered
        .map((c) => ({ date: c.period, kwh: c.quantity }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filtered]
  );

  // KPIs
  const totals = useMemo(() => {
    const total = filtered.reduce((acc, c) => acc + c.quantity, 0);
    const cost = filtered.reduce((acc, c) => acc + (c.cost || 0), 0);
    return { total, cost };
  }, [filtered]);

  // YoY comparison: same period one year ago
  const yoyDelta = useMemo(() => {
    if (!selectedEnergy || filtered.length === 0) return null;
    const fromTs = new Date(dateFrom).getTime() - 365 * 24 * 60 * 60 * 1000;
    const toTs = new Date(dateTo).getTime() - 365 * 24 * 60 * 60 * 1000;
    const lastYear = consumptions
      .filter((c) => c.energyType === selectedEnergy)
      .filter((c) => {
        const t = new Date(c.period).getTime();
        return t >= fromTs && t <= toTs + 24 * 60 * 60 * 1000 - 1;
      })
      .reduce((acc, c) => acc + c.quantity, 0);
    if (lastYear === 0) return null;
    return Math.round(((totals.total - lastYear) / lastYear) * 100);
  }, [consumptions, selectedEnergy, dateFrom, dateTo, totals.total, filtered.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-accent mb-3" />
        <p className="text-sm text-text-secondary">
          Chargement des consommations...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={40} className="text-red-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          Impossible de charger les consommations
        </h3>
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (consumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={40} className="text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          Aucun relevé exploitant pour ce site
        </h3>
        <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
          Cet onglet affiche les consommations transmises par votre exploitant
          (import Excel mensuel ou saisie manuelle). Pour la donnée brute du
          distributeur (GRDF, Enedis), rendez-vous dans l&apos;onglet
          <strong> Télérelève</strong> du module Énergie.
        </p>
        <Link href={`/energy/sites/${siteId}`}>
          <Button variant="outline">
            <BarChart3 size={16} className="mr-2" />
            Voir le suivi énergétique détaillé
          </Button>
        </Link>
      </div>
    );
  }

  const chartColor = selectedEnergy
    ? ENERGY_COLORS[selectedEnergy] || "#6b7280"
    : "#6b7280";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
        {availableEnergies.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">
              Énergie
            </label>
            <div className="flex gap-2">
              {availableEnergies.map((energy) => (
                <button
                  key={energy}
                  onClick={() => setSelectedEnergy(energy)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    selectedEnergy === energy
                      ? "text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                  style={
                    selectedEnergy === energy
                      ? { backgroundColor: ENERGY_COLORS[energy] || "#6b7280" }
                      : undefined
                  }
                >
                  {ENERGY_LABELS[energy] || energy}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayIso()}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex gap-2 ml-auto">
          {[
            { label: "30 j", days: 30 },
            { label: "90 j", days: 90 },
            { label: "1 an", days: 365 },
            { label: "3 ans", days: 365 * 3 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setDateFrom(daysAgoIso(preset.days));
                setDateTo(todayIso());
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Conso totale
          </p>
          <p className="text-2xl font-semibold text-primary-dark mt-1">
            {totals.total >= 5000
              ? `${(totals.total / 1000).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })} MWh`
              : `${Math.round(totals.total).toLocaleString("fr-FR")} kWh`}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            sur la période sélectionnée
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Coût estimé
          </p>
          <p className="text-2xl font-semibold text-primary-dark mt-1">
            {totals.cost > 0
              ? `${Math.round(totals.cost).toLocaleString("fr-FR")} €`
              : "—"}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {totals.cost > 0 ? "sur la période" : "non renseigné"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Évolution N-1
          </p>
          <p
            className={cn(
              "text-2xl font-semibold mt-1",
              yoyDelta === null
                ? "text-gray-400"
                : yoyDelta > 0
                ? "text-red-600"
                : yoyDelta < 0
                ? "text-green-600"
                : "text-primary-dark"
            )}
          >
            {yoyDelta === null
              ? "—"
              : `${yoyDelta > 0 ? "+" : ""}${yoyDelta} %`}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {yoyDelta === null
              ? "pas de données N-1"
              : "vs même période l'an dernier"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <ChartCard
        title={`Consommation ${
          selectedEnergy ? ENERGY_LABELS[selectedEnergy] || selectedEnergy : ""
        }`}
        subtitle="Relevés transmis par l'exploitant"
      >
        <ConsumptionTimeChart data={chartData} color={chartColor} height={320} />
      </ChartCard>
    </div>
  );
}

// ============================================================
// Zones placeholder - will show OccupationZones from ThermalProfileSection
// ============================================================

function ZonesPlaceholder({ siteId }: { siteId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Calendar size={40} className="text-gray-300 mb-3" />
      <h3 className="text-lg font-medium text-gray-700 mb-1">
        Zones d{"'"}occupation
      </h3>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
        Les zones d{"'"}occupation sont gérées dans l{"'"}onglet Profil thermique.
        Elles y sont intégrées avec les températures de consigne et les plannings hebdomadaires.
      </p>
      <p className="text-xs text-gray-400">
        Rendez-vous dans l{"'"}onglet &quot;Profil thermique&quot; pour gérer les zones.
      </p>
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
