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
        <Building2 size={40} className="text-ink/20 mb-4" />
        <h2 className="text-base font-semibold text-ink">
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
          className="inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-accent mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Contrat
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-ink truncate">
                {site.name}
              </h1>
              <span className="label-tech border border-ink/20 px-2 py-0.5">
                {SITE_TYPE_LABELS[site.type] || site.type}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-ink/40" />
                <span className="text-sm text-ink/50">
                  {site.address}, {site.city} {site.postalCode}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <EnergyIcon size={13} className="text-ink/40" />
                <span className="text-sm text-ink/50">
                  {energy?.label || site.energyType}
                </span>
              </div>
            </div>
          </div>

          {/* Contract badges */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {site.contractSites.map((cs) => (
              <div
                key={cs.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="font-mono text-[11px] text-ink/50">
                  {cs.contract.reference}
                </span>
                <div className="flex gap-1">
                  {cs.hasP1 && (
                    <span className="border border-ink/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink/70">
                      P1
                    </span>
                  )}
                  {cs.hasP2 && (
                    <span className="border border-ink/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink/70">
                      P2
                    </span>
                  )}
                  {cs.hasP3 && (
                    <span className="border border-ink/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink/70">
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
      <div className="border-b border-ink/10">
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "label-tech px-4 py-2.5 border-b-2 transition-colors -mb-px",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent hover:text-ink hover:border-accent/40"
                )}
              >
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
      <Calendar size={36} className="text-ink/20 mb-3" />
      <h3 className="text-base font-semibold text-ink mb-1">
        Zones d{"'"}occupation
      </h3>
      <p className="text-sm text-ink/50 mb-4 text-center max-w-md">
        Les zones d{"'"}occupation sont gérées dans l{"'"}onglet Profil thermique.
        Elles y sont intégrées avec les températures de consigne et les plannings hebdomadaires.
      </p>
      <p className="text-xs text-ink/40">
        Rendez-vous dans l{"'"}onglet &quot;Profil thermique&quot; pour gérer les zones.
      </p>
    </div>
  );
}

