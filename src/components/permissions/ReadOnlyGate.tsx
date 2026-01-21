"use client";

import { useIsReader } from "@/contexts/PermissionContext";

interface ReadOnlyGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Cache le contenu pour les utilisateurs en lecture seule (READER)
 * Utilisé pour masquer les boutons d'action (Créer, Modifier, Supprimer, Importer, etc.)
 */
export function ReadOnlyGate({ children, fallback = null }: ReadOnlyGateProps) {
  const isReader = useIsReader();

  if (isReader) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
