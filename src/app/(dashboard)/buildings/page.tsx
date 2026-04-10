"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Flame,
  Zap,
  Droplets,
  TreePine,
  LayoutGrid,
  List,
  Search,
  ArrowRight,
  Thermometer,
  Wrench as WrenchIcon,
  AlertTriangle,
} from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";

interface SiteData {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  surface: number | null;
  surfaceChauffee: number | null;
  energyType: string;
  annualBudget: number | null;
  _count: {
    equipments: number;
    consumptions: number;
    alerts: number;
  };
  contractSites: Array<{
    id: string;
    contractType: string;
    hasP1: boolean;
    hasP2: boolean;
    hasP3: boolean;
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

const ENERGY_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Flame; color: string }
> = {
  GAZ: { label: "Gaz", icon: Flame, color: "text-orange-500" },
  ELECTRICITE: { label: "Électricité", icon: Zap, color: "text-yellow-500" },
  FIOUL: { label: "Fioul", icon: Droplets, color: "text-gray-600" },
  BOIS: { label: "Bois", icon: TreePine, color: "text-green-600" },
  RESEAU_CHALEUR: {
    label: "Réseau de chaleur",
    icon: Thermometer,
    color: "text-red-500",
  },
  EAU: { label: "Eau", icon: Droplets, color: "text-blue-500" },
  AUTRE: { label: "Autre", icon: Flame, color: "text-gray-400" },
};

export default function BuildingsPage() {
  const router = useRouter();
  const { selectedContract, isLoading: contractLoading } = useContract();
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const fetchSites = useCallback(async () => {
    if (!selectedContract) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contracts/${selectedContract.id}/sites`
      );
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedContract]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Filter sites
  const filteredSites = sites.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "ALL" || s.type === filterType;
    return matchSearch && matchType;
  });

  // Unique types for filter
  const siteTypes = [...new Set(sites.map((s) => s.type))];

  if (contractLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-white rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 size={48} className="text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">
          Sélectionnez un contrat
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Utilisez le sélecteur de contrat en haut de la page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un bâtiment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <option value="ALL">Tous les types</option>
          {siteTypes.map((t) => (
            <option key={t} value={t}>
              {SITE_TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "grid"
                ? "bg-accent text-white"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 transition-colors",
              viewMode === "list"
                ? "bg-accent text-white"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-white rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500">Aucun bâtiment trouvé</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onClick={() => router.push(`/buildings/${site.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Bâtiment
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Ville
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Énergie
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Surface
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Prestations
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSites.map((site) => {
                const energy = ENERGY_TYPE_CONFIG[site.energyType];
                const EnergyIcon = energy?.icon || Flame;
                const cs = site.contractSites[0];
                return (
                  <tr
                    key={site.id}
                    onClick={() => router.push(`/buildings/${site.id}`)}
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {site.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {site.city}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {SITE_TYPE_LABELS[site.type] || site.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <EnergyIcon
                          size={14}
                          className={energy?.color || "text-gray-400"}
                        />
                        <span className="text-sm text-gray-600">
                          {energy?.label || site.energyType}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {site.surfaceChauffee || site.surface
                          ? `${(
                              site.surfaceChauffee || site.surface
                            )?.toLocaleString()} m²`
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {cs?.hasP1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                            P1
                          </span>
                        )}
                        {cs?.hasP2 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                            P2
                          </span>
                        )}
                        {cs?.hasP3 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
                            P3
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ArrowRight
                        size={16}
                        className="text-gray-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SiteCard({
  site,
  onClick,
}: {
  site: SiteData;
  onClick: () => void;
}) {
  const energy = ENERGY_TYPE_CONFIG[site.energyType];
  const EnergyIcon = energy?.icon || Flame;
  const cs = site.contractSites[0];

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-accent/20 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-accent transition-colors">
            {site.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">
              {site.city} ({site.postalCode})
            </span>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0 ml-2">
          {SITE_TYPE_LABELS[site.type] || site.type}
        </span>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <EnergyIcon
            size={14}
            className={energy?.color || "text-gray-400"}
          />
          <span className="text-xs text-gray-600">
            {energy?.label || site.energyType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-gray-400" />
          <span className="text-xs text-gray-600">
            {site.surfaceChauffee || site.surface
              ? `${(site.surfaceChauffee || site.surface)?.toLocaleString()} m²`
              : "Surface N/R"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex gap-1.5">
          {cs?.hasP1 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
              P1
            </span>
          )}
          {cs?.hasP2 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
              P2
            </span>
          )}
          {cs?.hasP3 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
              P3
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {site._count.equipments > 0 && (
            <div className="flex items-center gap-1">
              <WrenchIcon size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">
                {site._count.equipments}
              </span>
            </div>
          )}
          {site._count.alerts > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle size={12} className="text-orange-400" />
              <span className="text-xs text-orange-500">
                {site._count.alerts}
              </span>
            </div>
          )}
          <ArrowRight
            size={14}
            className="text-gray-300 group-hover:text-accent transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
