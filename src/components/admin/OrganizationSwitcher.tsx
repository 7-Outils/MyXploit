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
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          isGhostMode
            ? "bg-purple-100 hover:bg-purple-200 text-purple-700"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`}
      >
        {isGhostMode ? <Ghost size={16} className="flex-shrink-0" /> : <Building size={16} className="flex-shrink-0" />}
        <span className="text-sm font-medium truncate flex-1 text-left">
          {isGhostMode ? currentOrg?.name : user?.organization.name || "Votre Org"}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 min-w-[280px] max-w-[320px]">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
              Organisations
            </div>
            <div className="max-h-80 overflow-y-auto">
              {/* Organisation de l'admin */}
              {user?.organization && (
                <button
                  onClick={() => handleSelectOrg(user.organization.id)}
                  disabled={loading}
                  className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    isInOwnOrg ? "bg-blue-50 border-l-2 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.organization.name}
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5 truncate">Votre organisation</p>
                    </div>
                    {isInOwnOrg && <Building size={14} className="text-blue-600 flex-shrink-0" />}
                  </div>
                </button>
              )}

              <div className="h-px bg-gray-200 my-1" />

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
                      className={`w-full px-3 py-2.5 text-left hover:bg-purple-50 transition-colors ${
                        isActive ? "bg-purple-50 border-l-2 border-purple-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{org.name}</p>
                          {org._count && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {org._count.users} users · {org._count.sites} sites
                            </p>
                          )}
                        </div>
                        {isActive && <Ghost size={16} className="text-purple-600" />}
                        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
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
