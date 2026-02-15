"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserRole, Module } from "@/generated/prisma/client";
import { canEdit, canDelete, canCreate, canImport, canSync, canManageUsers, canUseGhostMode } from "@/lib/permissions";

interface PermissionContextType {
  // État
  userRole: UserRole | null;
  enabledModules: Module[];
  isGhostMode: boolean;
  ghostOrgId: string | null;
  ghostOrgName: string | null;
  isLoading: boolean;
  hasPortfolio: boolean;

  // Vérifications rapides
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canImport: boolean;
  canSync: boolean;
  canManageUsers: boolean;
  canUseGhostMode: boolean;

  // Méthodes
  hasModule: (module: Module) => boolean;
  enterGhostMode: (orgId: string) => Promise<void>;
  exitGhostMode: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [enabledModules, setEnabledModules] = useState<Module[]>([]);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [ghostOrgId, setGhostOrgId] = useState<string | null>(null);
  const [ghostOrgName, setGhostOrgName] = useState<string | null>(null);
  const [hasPortfolio, setHasPortfolio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await fetch("/api/permissions");
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role);
        setEnabledModules(data.enabledModules || []);
        setIsGhostMode(data.isGhostMode || false);
        setGhostOrgId(data.ghostOrgId || null);
        setGhostOrgName(data.ghostOrgName || null);
        setHasPortfolio(data.hasPortfolio || false);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasModule = useCallback(
    (module: Module): boolean => {
      // SUPER_ADMIN a accès à tous les modules
      if (userRole === "SUPER_ADMIN") return true;
      return enabledModules.includes(module);
    },
    [userRole, enabledModules]
  );

  const enterGhostMode = useCallback(
    async (orgId: string) => {
      if (userRole !== "SUPER_ADMIN") return;

      try {
        const response = await fetch("/api/ghost-mode/enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsGhostMode(true);
          setGhostOrgId(orgId);
          setGhostOrgName(data.organizationName || null);
          // Refresh modules for the new org
          await fetchPermissions();
        }
      } catch (error) {
        console.error("Error entering ghost mode:", error);
      }
    },
    [userRole, fetchPermissions]
  );

  const exitGhostMode = useCallback(async () => {
    try {
      const response = await fetch("/api/ghost-mode/exit", { method: "POST" });

      if (response.ok) {
        setIsGhostMode(false);
        setGhostOrgId(null);
        setGhostOrgName(null);
        await fetchPermissions();
      }
    } catch (error) {
      console.error("Error exiting ghost mode:", error);
    }
  }, [fetchPermissions]);

  // Calculer les permissions basées sur le rôle
  const permissions = {
    canEdit: userRole ? canEdit(userRole) : false,
    canDelete: userRole ? canDelete(userRole) : false,
    canCreate: userRole ? canCreate(userRole) : false,
    canImport: userRole ? canImport(userRole) : false,
    canSync: userRole ? canSync(userRole) : false,
    canManageUsers: userRole ? canManageUsers(userRole) : false,
    canUseGhostMode: userRole ? canUseGhostMode(userRole) : false,
  };

  return (
    <PermissionContext.Provider
      value={{
        userRole,
        enabledModules,
        isGhostMode,
        ghostOrgId,
        ghostOrgName,
        isLoading,
        hasPortfolio,
        ...permissions,
        hasModule,
        enterGhostMode,
        exitGhostMode,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}

// Hooks spécifiques pour des cas d'usage courants
export function useCanEdit() {
  const { canEdit } = usePermissions();
  return canEdit;
}

export function useCanDelete() {
  const { canDelete } = usePermissions();
  return canDelete;
}

export function useCanCreate() {
  const { canCreate } = usePermissions();
  return canCreate;
}

export function useCanImport() {
  const { canImport } = usePermissions();
  return canImport;
}

export function useIsReader() {
  const { userRole } = usePermissions();
  return userRole === "READER";
}

export function useIsSuperAdmin() {
  const { userRole } = usePermissions();
  return userRole === "SUPER_ADMIN";
}

export function useHasModule(module: Module) {
  const { hasModule } = usePermissions();
  return hasModule(module);
}

export function useGhostMode() {
  const { isGhostMode, ghostOrgId, ghostOrgName, enterGhostMode, exitGhostMode, canUseGhostMode } =
    usePermissions();
  return { isGhostMode, ghostOrgId, ghostOrgName, enterGhostMode, exitGhostMode, canUseGhostMode };
}
