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
    <div className="fixed top-0 left-0 right-0 z-50 bg-purple-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <Ghost size={20} className="animate-pulse" />
        <div>
          <span className="text-sm font-semibold">
            Mode Fantôme:{" "}
            <span className="bg-white/20 px-2 py-0.5 rounded">
              {ghostOrgName || "Organisation"}
            </span>
          </span>
          <p className="text-xs opacity-90 mt-0.5">
            Vous consultez cette organisation en toute discrétion
          </p>
        </div>
      </div>
      <button
        onClick={exitGhostMode}
        className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
      >
        <X size={16} />
        Quitter
      </button>
    </div>
  );
}
