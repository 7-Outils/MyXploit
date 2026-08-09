"use client";

import { useState, useEffect } from "react";
import { Building, ChevronDown, Ghost, Loader2 } from "lucide-react";
import { useGhostMode } from "@/contexts/PermissionContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

interface Organization {
  id: string;
  name: string;
  _count?: {
    users: number;
    sites: number;
  };
}

/**
 * Sélecteur d'organisation pour SUPER_ADMIN
 * Permet d'entrer en mode fantôme pour consulter n'importe quelle organisation
 */
export function OrganizationSwitcher() {
  const { user } = useUserProfile();
  const { isGhostMode, ghostOrgId, enterGhostMode, exitGhostMode, canUseGhostMode } = useGhostMode();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (canUseGhostMode) {
      fetch("/api/admin/organizations")
        .then((res) => res.json())
        .then((data) => setOrganizations(data || []))
        .catch(console.error);
    }
  }, [canUseGhostMode]);

  if (!canUseGhostMode) return null;

  const currentOrg = organizations.find((o) => o.id === ghostOrgId);
  const isInOwnOrg = !isGhostMode;

  const handleSelectOrg = async (orgId: string) => {
    setLoading(true);
    try {
      if (orgId === user?.organization.id) {
        await exitGhostMode();
      } else {
        await enterGhostMode(orgId);
      }
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`w-full flex items-center gap-2 border px-3 py-2 transition-colors ${
          isGhostMode
            ? "border-amber-600/30 bg-amber-50 text-amber-800 hover:border-amber-600"
            : "border-ink/15 bg-white text-ink hover:border-accent/40"
        }`}
      >
        {isGhostMode ? (
          <Ghost size={16} className="flex-shrink-0 text-amber-600" />
        ) : (
          <Building size={16} className="flex-shrink-0 text-ink/40" />
        )}
        <span className="text-sm font-medium truncate flex-1 text-left">
          {isGhostMode ? currentOrg?.name : user?.organization.name || "Votre Org"}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 bg-white shadow-large border border-ink/15 py-1 z-50 min-w-[280px] max-w-[320px]">
            <div className="label-tech border-b border-ink/10 px-3 py-2">
              Organisations
            </div>
            <div className="max-h-80 overflow-y-auto">
              {/* Organisation de l'admin */}
              {user?.organization && (
                <button
                  onClick={() => handleSelectOrg(user.organization.id)}
                  disabled={loading}
                  className={`w-full border-l-2 px-3 py-2 text-left transition-colors ${
                    isInOwnOrg
                      ? "border-accent bg-accent/5"
                      : "border-transparent hover:bg-ink/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {user.organization.name}
                      </p>
                      <p className="font-mono text-[11px] text-accent mt-0.5 truncate">Votre organisation</p>
                    </div>
                    {isInOwnOrg && <Building size={14} className="text-accent flex-shrink-0" />}
                  </div>
                </button>
              )}

              <div className="h-px bg-ink/10" />

              {/* Autres organisations */}
              {organizations
                .filter((org) => org.id !== user?.organization.id)
                .map((org) => {
                  const isActive = org.id === ghostOrgId;
                  return (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      disabled={loading}
                      className={`w-full border-l-2 px-3 py-2 text-left transition-colors ${
                        isActive
                          ? "border-amber-600 bg-amber-50"
                          : "border-transparent hover:bg-ink/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{org.name}</p>
                          {org._count && (
                            <p className="font-mono text-[11px] tabular-nums text-ink/40 mt-0.5 truncate">
                              {org._count.users} users · {org._count.sites} sites
                            </p>
                          )}
                        </div>
                        {isActive && <Ghost size={16} className="text-amber-600" />}
                        {loading && <Loader2 size={16} className="animate-spin text-ink/30" />}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
