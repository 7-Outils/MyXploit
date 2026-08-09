"use client";

import { AlertTriangle, RotateCw, Home } from "lucide-react";

interface ErrorScreenProps {
  title?: string;
  message?: string;
  /**
   * Identifiant que Next attache à l'erreur côté serveur. C'est la seule
   * façon de relier ce que voit l'utilisateur à la trace complète dans les
   * logs Vercel : il faut donc l'afficher, pas le masquer.
   */
  digest?: string;
  /** Remonte le composant en erreur, sans recharger toute la page. */
  onRetry?: () => void;
  /** Affiche un lien de retour à l'accueil (inutile si on y est déjà). */
  showHome?: boolean;
}

export function ErrorScreen({
  title = "Une erreur est survenue",
  message = "L'affichage de cette page a échoué. Réessayer suffit dans la plupart des cas.",
  digest,
  onRetry,
  showHome = true,
}: ErrorScreenProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle size={22} className="text-red-600" />
        </div>

        <h1 className="text-lg font-semibold text-primary-dark">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>

        {digest && (
          <p className="mt-5 font-mono text-xs text-gray-400">
            Code d&apos;erreur : {digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              <RotateCw size={15} />
              Réessayer
            </button>
          )}
          {showHome && (
            <a
              href="/overview"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-50"
            >
              <Home size={15} />
              Accueil
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
