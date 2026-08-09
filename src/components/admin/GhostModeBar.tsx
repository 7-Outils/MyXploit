"use client";

import { Ghost, X } from "lucide-react";
import { useGhostMode } from "@/contexts/PermissionContext";

/**
 * Barre indicateur pour le mode fantôme (visible uniquement pour SUPER_ADMIN en ghost mode)
 * S'affiche en haut de l'écran quand le SUPER_ADMIN consulte une autre organisation
 */
export function GhostModeBar() {
  const { isGhostMode, ghostOrgName, exitGhostMode } = useGhostMode();

  if (!isGhostMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-b border-amber-600/30 bg-amber-50 px-4 py-2 text-amber-800">
      <div className="flex items-center gap-3 min-w-0">
        <Ghost size={16} className="flex-shrink-0 text-amber-600" />
        <div className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-widest text-amber-700">
            Mode fantôme
          </span>
          <span className="mx-2 text-amber-600/40">·</span>
          <span className="text-sm font-medium text-ink">
            {ghostOrgName || "Organisation"}
          </span>
          <p className="mt-0.5 text-xs text-amber-700/80">
            Vous consultez cette organisation en toute discrétion
          </p>
        </div>
      </div>
      <button
        onClick={async () => {
          await exitGhostMode();
          window.location.href = "/platform";
        }}
        className="flex flex-shrink-0 items-center gap-2 border border-amber-600/30 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:border-amber-600 hover:bg-amber-600/10"
      >
        <X size={14} />
        Quitter
      </button>
    </div>
  );
}
