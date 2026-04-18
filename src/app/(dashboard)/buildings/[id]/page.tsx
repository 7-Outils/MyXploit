"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Flame,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThermalProfileSection from "@/components/energy/ThermalProfileSection";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionContext";

import type { SiteDetail, TabKey } from "@/components/buildings/types";
import { SITE_TYPE_LABELS, ENERGY_CONFIG, TABS } from "@/components/buildings/constants";
import { GeneralTab } from "@/components/buildings/tabs/GeneralTab";
import { EnergyTab } from "@/components/buildings/tabs/EnergyTab";
import { ActivityLogTab } from "@/components/buildings/tabs/ActivityLogTab";
import { MetersTab } from "@/components/buildings/tabs/MetersTab";

export default function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEdit: userCanEdit } = usePermissions();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const initialTab = (searchParams.get("tab") as TabKey) || "general";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
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
          href="/contrat"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Contrat
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
          <MetersTab siteId={site.id} />
        )}
        {activeTab === "journal" && (
          <ActivityLogTab siteId={site.id} />
        )}
      </div>
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

