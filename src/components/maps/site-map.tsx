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

// Site type colors
const SITE_TYPE_COLORS: Record<string, string> = {
  LYCEE: "#3b82f6",
  COLLEGE: "#8b5cf6",
  ECOLE: "#06b6d4",
  MAIRIE: "#f59e0b",
  HOPITAL: "#ef4444",
  GYMNASE: "#22c55e",
  PISCINE: "#0ea5e9",
  MEDIATHEQUE: "#a855f7",
  AUTRE: "#6b7280",
};

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

// Create custom colored marker
function createColoredIcon(color: string) {
  if (typeof window === "undefined") return null;

  const L = require("leaflet");

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="${color}" stroke="#fff" stroke-width="1" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z"/>
      <circle cx="12" cy="8" r="3" fill="#fff"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: "custom-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
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

    // Create icons for each site type
    const newIcons: Record<string, L.DivIcon> = {};
    Object.entries(SITE_TYPE_COLORS).forEach(([type, color]) => {
      const icon = createColoredIcon(color);
      if (icon) newIcons[type] = icon;
    });
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
        className="bg-gray-50 rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (mappableSites.length === 0) {
    return (
      <div
        className="bg-gray-50 rounded-xl flex flex-col items-center justify-center text-center p-6"
        style={{ height }}
      >
        <div className="text-gray-400 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-12 h-12 mx-auto"
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
        <p className="text-sm text-gray-500">
          Aucun site avec coordonnées GPS
        </p>
        <p className="text-xs text-gray-400 mt-1">
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
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        .leaflet-popup-content {
          margin: 12px 16px;
        }
      `}</style>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height, width: "100%", borderRadius: "12px" }}
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
            icon={icons[site.type] || icons.AUTRE}
            eventHandlers={{
              click: () => onSiteClick?.(site.id),
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <h3 className="font-semibold text-primary-dark mb-1">
                  {site.name}
                </h3>
                <p className="text-xs text-text-secondary mb-2">
                  {site.address}
                  <br />
                  {site.postalCode} {site.city}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: SITE_TYPE_COLORS[site.type] || SITE_TYPE_COLORS.AUTRE }}
                  >
                    {SITE_TYPE_LABELS[site.type] || site.type}
                  </span>
                  {site.contractName && (
                    <span className="text-gray-500">{site.contractName}</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      {showLegend && usedTypes.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg p-3 shadow-lg z-[1000]">
          <div className="text-xs font-medium text-gray-500 mb-2">Légende</div>
          <div className="flex flex-wrap gap-2">
            {usedTypes.map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: SITE_TYPE_COLORS[type] || SITE_TYPE_COLORS.AUTRE }}
                />
                <span className="text-xs text-gray-700">
                  {SITE_TYPE_LABELS[type] || type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning for sites without coordinates */}
      {sitesWithoutCoords > 0 && (
        <div className="absolute top-4 right-4 bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg shadow-lg z-[1000] text-xs">
          {sitesWithoutCoords} site{sitesWithoutCoords > 1 ? "s" : ""} sans
          coordonnées
        </div>
      )}
    </div>
  );
}
