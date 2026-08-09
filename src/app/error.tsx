"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ui/error-screen";

/**
 * Filet de sécurité pour toute exception de rendu non rattrapée plus bas.
 * Sans ce fichier, Next affiche une page vide et l'erreur n'apparaît nulle part.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Visible dans les logs runtime Vercel, avec le digest pour recoupement.
    console.error("[render error]", { digest: error.digest, message: error.message, stack: error.stack });
  }, [error]);

  return <ErrorScreen digest={error.digest} onRetry={reset} />;
}
