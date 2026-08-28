"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

const CACHE_KEY = "swr-cache";

// Au-delà de ~200 Ko, une entrée coûte plus cher à sérialiser (thread principal)
// et à stocker (quota localStorage) qu'à refetcher. On la saute en silence.
const MAX_ENTRY_CHARS = 200_000;

// Référence au cache en cours, pour pouvoir le vider à la déconnexion.
let activeCache: Map<string, unknown> | null = null;
let persistEnabled = true;
// Écriture du cache courant, posée par le provider et consommée par les
// écouteurs de SWRProvider (montage/démontage propres).
let persistActiveCache: (() => void) | null = null;

/**
 * Vide le cache SWR, en mémoire et dans localStorage.
 * À appeler à la déconnexion : sans ça, les données métier du compte précédent
 * (contrats, sites, factures) restent lisibles dans localStorage et sont
 * resservies au prochain utilisateur qui se connecte sur le même navigateur.
 */
export function clearSwrCache() {
  persistEnabled = false;
  activeCache?.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Pas de localStorage disponible — rien à purger
  }
}

// localStorage-backed SWR cache : le cache survit aux reloads de page.
// On ne persiste que les clés qui commencent par "/api/" pour éviter de stocker des données sensibles.
function localStorageProvider() {
  if (typeof window === "undefined") return new Map();

  let map: Map<string, unknown>;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    map = new Map(raw ? (JSON.parse(raw) as [string, unknown][]) : []);
  } catch {
    map = new Map();
  }

  activeCache = map;
  persistEnabled = true;

  const persist = () => {
    if (!persistEnabled) return;
    try {
      const entries: [string, unknown][] = [];
      for (const [k, v] of map.entries()) {
        if (typeof k !== "string" || !k.startsWith("/api/")) continue;
        // Une réponse volumineuse (parc complet, analytics) coûte plus cher à
        // sérialiser qu'à refetcher : on la laisse hors du localStorage.
        let serialized: string;
        try {
          serialized = JSON.stringify(v);
        } catch {
          continue;
        }
        if (!serialized || serialized.length > MAX_ENTRY_CHARS) continue;
        entries.push([k, v]);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Quota, SSR, etc. — ignore
    }
  };

  persistActiveCache = persist;

  return map;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  // Plus de setInterval : rejouer un JSON.stringify de tout le cache toutes les
  // 30 s bloquait le thread principal pour rien. On n'écrit qu'aux deux moments
  // où la persistance sert vraiment — l'onglet passe en arrière-plan, ou il part.
  useEffect(() => {
    const persist = () => persistActiveCache?.();
    const persistOnHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", persistOnHide);
    window.addEventListener("beforeunload", persist);
    return () => {
      document.removeEventListener("visibilitychange", persistOnHide);
      window.removeEventListener("beforeunload", persist);
    };
  }, []);

  return (
    <SWRConfig
      value={{
        fetcher,
        provider: localStorageProvider,
        // Le retour de focus ne revalide plus : sur les pages lourdes, un simple
        // alt-tab relançait 4 à 8 appels API (dont les analytics) pour zéro donnée
        // nouvelle. Les écrans qui ont besoin de fraîcheur passent revalidateOnFocus
        // au cas par cas, ou appellent mutate() après une écriture.
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 60_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
