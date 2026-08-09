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
      <div className="w-full max-w-md border border-ink/10 bg-white p-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          <span className="label-tech text-red-600/70">Erreur</span>
        </div>

        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>

        {digest && (
          <p className="mt-5 font-mono text-xs text-ink/40">
            Code d&apos;erreur : {digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              <RotateCw size={15} />
              Réessayer
            </button>
          )}
          {showHome && (
            <a
              href="/overview"
              className="inline-flex h-10 items-center gap-2 border border-ink/20 px-4 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
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
