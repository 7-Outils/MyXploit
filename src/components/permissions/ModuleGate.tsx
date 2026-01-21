"use client";

import { Module } from "@/generated/prisma/client";
import { useHasModule } from "@/contexts/PermissionContext";

interface ModuleGateProps {
  module: Module;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Affiche le contenu uniquement si le module est activé pour l'organisation
 * Utilisé pour filtrer la navigation et les fonctionnalités par module
 */
export function ModuleGate({ module, children, fallback = null }: ModuleGateProps) {
  const hasModule = useHasModule(module);

  if (!hasModule) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
