"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

const CACHE_KEY = "swr-cache";

// Référence au cache en cours, pour pouvoir le vider à la déconnexion.
let activeCache: Map<string, unknown> | null = null;
let persistEnabled = true;

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
      const entries = Array.from(map.entries()).filter(([k]) => typeof k === "string" && k.startsWith("/api/"));
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Quota, SSR, etc. — ignore
    }
  };

  window.addEventListener("beforeunload", persist);
  // Persist régulièrement pour que les reloads intempestifs n'effacent pas tout
  setInterval(persist, 30_000);

  return map;
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
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
