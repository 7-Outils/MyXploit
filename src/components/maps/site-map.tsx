"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Thème « bureau d'études » : pas de code couleur décoratif par type.
// L'encre marque le repère, l'accent la sélection.
const INK = "#0F1E33";
const ACCENT = "#2563EB";

const SITE_TYPE_LABELS: Record<string, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

interface MapSite {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  energyType?: string;
  contractName?: string;
}

interface SiteMapProps {
  sites: MapSite[];
  height?: string;
  onSiteClick?: (siteId: string) => void;
  selectedSiteId?: string;
  showLegend?: boolean;
}

// Repère de plan : carré à hairline + croix de visée, pas de goutte pastel
function createColoredIcon(color: string, opacity: number) {
  if (typeof window === "undefined") return null;

  // Chargement paresseux volontaire : leaflet touche `window` à l'import, donc
  // il ne doit pas être résolu côté serveur. Un import statique casse le SSR.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet");

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" opacity="${opacity}">
      <rect x="5.5" y="5.5" width="13" height="13" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>
      <rect x="10" y="10" width="4" height="4" fill="${color}"/>
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="${color}" stroke-width="1"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: "custom-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export function SiteMap({
  sites,
  height = "400px",
  onSiteClick,
  selectedSiteId,
  showLegend = true,
}: SiteMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [icons, setIcons] = useState<Record<string, L.DivIcon>>({});

  useEffect(() => {
    setIsClient(true);
    // Import Leaflet CSS dynamically
    // @ts-expect-error - CSS module import
    import("leaflet/dist/leaflet.css");

    // Deux repères seulement : encre (neutre) et accent (sélection)
    const newIcons: Record<string, L.DivIcon> = {};
    const base = createColoredIcon(INK, 0.45);
    const selected = createColoredIcon(ACCENT, 1);
    if (base) newIcons.default = base;
    if (selected) newIcons.selected = selected;
    setIcons(newIcons);
  }, []);

  // Filter sites with valid coordinates
  const mappableSites = useMemo(
    () => sites.filter((s) => s.latitude !== null && s.longitude !== null),
    [sites]
  );

  // Calculate center based on sites
  const center = useMemo(() => {
    if (mappableSites.length === 0) {
      return { lat: 46.603354, lng: 1.888334 }; // Center of France
    }

    const sumLat = mappableSites.reduce((sum, s) => sum + (s.latitude || 0), 0);
    const sumLng = mappableSites.reduce((sum, s) => sum + (s.longitude || 0), 0);

    return {
      lat: sumLat / mappableSites.length,
      lng: sumLng / mappableSites.length,
    };
  }, [mappableSites]);

  // Calculate zoom based on sites spread
  const zoom = useMemo(() => {
    if (mappableSites.length <= 1) return 12;
    if (mappableSites.length <= 5) return 10;
    return 8;
  }, [mappableSites.length]);

  // Count sites without coordinates
  const sitesWithoutCoords = sites.length - mappableSites.length;

  // Get unique site types for legend
  const usedTypes = useMemo(() => {
    const types = new Set(mappableSites.map((s) => s.type));
    return Array.from(types);
  }, [mappableSites]);

  if (!isClient) {
    return (
      <div
        className="flex items-center justify-center border border-ink/10 bg-white"
        style={{ height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
      </div>
    );
  }

  if (mappableSites.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center border border-ink/10 bg-white p-4 text-center"
        style={{ height }}
      >
        <div className="mb-2 text-ink/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
          Aucun site avec coordonnées GPS
        </p>
        <p className="mt-1 text-xs text-ink/40">
          Les coordonnées sont calculées automatiquement à partir des adresses
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <style jsx global>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0;
          border: 1px solid rgb(15 30 51 / 0.15);
          box-shadow: 0 12px 32px -8px rgb(15 30 51 / 0.18);
        }
        .leaflet-popup-tip {
          border: 1px solid rgb(15 30 51 / 0.15);
        }
        .leaflet-popup-content {
          margin: 10px 14px;
        }
        .leaflet-container {
          font-family: inherit;
        }
        /* Fond de plan en encre très claire : la carte reste un calque, pas un décor */
        .leaflet-tile-pane {
          filter: grayscale(1) contrast(0.78) brightness(1.12);
        }
        .leaflet-control-zoom a {
          border-radius: 0 !important;
          border: 1px solid rgb(15 30 51 / 0.15) !important;
          background: rgb(255 255 255 / 0.95) !important;
          color: rgb(15 30 51 / 0.6) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
        }
        .leaflet-control-zoom a:hover {
          color: #2563eb !important;
        }
        .leaflet-control-attribution {
          border-radius: 0;
          font-size: 10px;
        }
      `}</style>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height, width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappableSites.map((site) => (
          <Marker
            key={site.id}
            position={[site.latitude!, site.longitude!]}
            icon={
              selectedSiteId === site.id
                ? icons.selected || icons.default
                : icons.default
            }
            eventHandlers={{
              click: () => onSiteClick?.(site.id),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <h3 className="mb-1 text-sm font-semibold text-ink">
                  {site.name}
                </h3>
                <p className="mb-2 text-xs text-ink/50">
                  {site.address}
                  <br />
                  {site.postalCode} {site.city}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink/60">
                    {SITE_TYPE_LABELS[site.type] || site.type}
                  </span>
                  {site.contractName && (
                    <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                      {site.contractName}
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      {showLegend && usedTypes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] border border-ink/15 bg-white/95 p-3 shadow-large backdrop-blur">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Types de sites
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {usedTypes.map((type) => (
              <span
                key={type}
                className="font-mono text-[11px] uppercase tracking-widest text-ink/70"
              >
                {SITE_TYPE_LABELS[type] || type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warning for sites without coordinates */}
      {sitesWithoutCoords > 0 && (
        <div className="absolute right-4 top-4 z-[1000] border border-amber-600/20 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-amber-700 shadow-large">
          <span className="tabular-nums">{sitesWithoutCoords}</span> site
          {sitesWithoutCoords > 1 ? "s" : ""} sans coordonnées
        </div>
      )}
    </div>
  );
}
