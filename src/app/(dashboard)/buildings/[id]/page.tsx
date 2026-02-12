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
  Calendar,
  BarChart3,
  Loader2,
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

type TabKey = "general" | "energy" | "thermal" | "zones" | "meters";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: "general", label: "Général", icon: Building2 },
  { key: "energy", label: "Énergie", icon: BarChart3 },
  { key: "thermal", label: "Profil thermique", icon: Thermometer },
  { key: "zones", label: "Zones", icon: Calendar },
  { key: "meters", label: "Compteurs", icon: Gauge },
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
// Energy Tab - shows link to existing energy page for now
// ============================================================

function EnergyTab({ siteId }: { siteId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <BarChart3 size={40} className="text-gray-300 mb-3" />
      <h3 className="text-lg font-medium text-gray-700 mb-1">
        Suivi énergétique
      </h3>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
        Consultez les consommations, les analyses P1 et le suivi climatique
        de ce bâtiment depuis le module énergie.
      </p>
      <Link href={`/energy/sites/${siteId}`}>
        <Button>
          <BarChart3 size={16} className="mr-2" />
          Voir le suivi énergétique
        </Button>
      </Link>
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
