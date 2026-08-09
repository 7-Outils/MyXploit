"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ui/error-screen";

/**
 * Erreur cantonnée à une page du dashboard : le layout (barre latérale,
 * sélecteur de contrat) reste monté, l'utilisateur peut naviguer ailleurs
 * sans recharger l'application.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", { digest: error.digest, message: error.message, stack: error.stack });
  }, [error]);

  return (
    <ErrorScreen
      title="Cet écran n'a pas pu s'afficher"
      message="Les autres écrans restent accessibles depuis le menu. Si le problème persiste, communique le code ci-dessous."
      digest={error.digest}
      onRetry={reset}
      showHome={false}
    />
  );
}
