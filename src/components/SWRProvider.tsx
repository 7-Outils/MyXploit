"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

// localStorage-backed SWR cache : le cache survit aux reloads de page.
// On ne persiste que les clés qui commencent par "/api/" pour éviter de stocker des données sensibles.
function localStorageProvider() {
  if (typeof window === "undefined") return new Map();

  let map: Map<string, unknown>;
  try {
    const raw = localStorage.getItem("swr-cache");
    map = new Map(raw ? (JSON.parse(raw) as [string, unknown][]) : []);
  } catch {
    map = new Map();
  }

  const persist = () => {
    try {
      const entries = Array.from(map.entries()).filter(([k]) => typeof k === "string" && k.startsWith("/api/"));
      localStorage.setItem("swr-cache", JSON.stringify(entries));
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
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
