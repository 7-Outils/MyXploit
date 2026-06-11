"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Station } from "@/components/outils/StationMap";

// Imports dynamiques : Leaflet a besoin de `window`, donc pas de SSR.
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

type Props = {
  stations: Station[];
  selected: string | null;
  onSelect: (key: string) => void;
};

export function StationMapLeaflet({ stations, selected, onSelect }: Props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // @ts-expect-error - import CSS Leaflet au runtime client
    import("leaflet/dist/leaflet.css");
  }, []);

  if (!isClient) {
    return (
      <div
        className="bg-gray-50 rounded-xl flex items-center justify-center"
        style={{ height: 460 }}
      >
        <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <MapContainer
      center={[46.6, 2.4]}
      zoom={5}
      minZoom={5}
      maxZoom={12}
      scrollWheelZoom
      style={{ height: 460, width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map((s) => {
        const isSelected = s.key === selected;
        // CircleMarker : rayon en PIXELS → taille fixe quel que soit le zoom,
        // donc zoomer écarte visuellement les stations proches (région PACA/IDF).
        return (
          <CircleMarker
            key={s.key}
            center={[s.lat, s.lon]}
            radius={isSelected ? 8 : 5}
            pathOptions={{
              color: "#fff",
              weight: 1.5,
              fillColor: isSelected ? "#3A7E85" : "#94A3B8",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(s.key) }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <div className="text-xs">
                <div className="font-medium">{s.name}</div>
                {s.djuTrentenaire != null && (
                  <div className="text-gray-500">
                    DJU trentenaire {s.djuTrentenaire.toLocaleString("fr-FR")}
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
