"use client";

import { useMemo, useState } from "react";

export type Station = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  djuTrentenaire: number | null;
};

type Props = {
  stations: Station[];
  selected: string | null;
  onSelect: (key: string) => void;
};

// Bornes géographiques métropole + Corse
const LON_MIN = -5.2;
const LON_MAX = 9.7;
const LAT_MIN = 41.2;
const LAT_MAX = 51.2;
// Les degrés de longitude sont compressés par cos(latitude) — on corrige pour
// garder des proportions réalistes (sinon la France paraît étirée en largeur).
const COS_LAT = Math.cos((46 * Math.PI) / 180);

const W = 480;
const H = 520;
const PAD = 16;

const LON_SPAN = (LON_MAX - LON_MIN) * COS_LAT;
const LAT_SPAN = LAT_MAX - LAT_MIN;

function project(lon: number, lat: number): [number, number] {
  const x = PAD + ((lon - LON_MIN) * COS_LAT) / LON_SPAN * (W - 2 * PAD);
  const y = PAD + ((LAT_MAX - lat) / LAT_SPAN) * (H - 2 * PAD);
  return [x, y];
}

// Contour grossier mais reconnaissable de la France métropolitaine ("l'Hexagone")
// + la Corse, en [lon, lat] — projeté avec la MÊME fonction que les points
// stations, donc toujours aligné, sans dépendance cartographique externe.
const FRANCE: [number, number][] = [
  [2.5, 51.05], [4.2, 50.3], [5.9, 49.5], [8.2, 48.9], [7.6, 47.6],
  [6.9, 47.4], [6.1, 46.4], [7.0, 45.6], [6.8, 45.1], [7.5, 43.75],
  [6.5, 43.1], [5.4, 43.25], [4.0, 43.55], [3.0, 42.45], [1.5, 42.6],
  [-0.5, 42.8], [-1.4, 43.3], [-1.5, 44.5], [-1.1, 45.6], [-1.2, 46.3],
  [-2.2, 47.0], [-2.6, 47.6], [-4.8, 48.0], [-4.6, 48.65], [-2.8, 48.6],
  [-1.5, 48.65], [-1.6, 49.7], [-0.2, 49.3], [1.6, 50.1], [2.5, 51.05],
];
const CORSE: [number, number][] = [
  [9.35, 43.0], [9.55, 42.6], [9.4, 41.8], [9.0, 41.4],
  [8.6, 41.6], [8.7, 42.3], [9.0, 42.7], [9.35, 43.0],
];

function toPath(pts: [number, number][]): string {
  return pts
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

export function StationMap({ stations, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const francePath = useMemo(() => toPath(FRANCE), []);
  const corsePath = useMemo(() => toPath(CORSE), []);

  const active = hover ?? selected;
  const activeStation = stations.find((s) => s.key === active) ?? null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Carte des stations météo de France"
      >
        {/* Contour pays */}
        <path d={francePath} fill="#F0F4F8" stroke="#CBD5E0" strokeWidth={1.5} />
        <path d={corsePath} fill="#F0F4F8" stroke="#CBD5E0" strokeWidth={1.5} />

        {/* Stations */}
        {stations.map((s) => {
          const [x, y] = project(s.lon, s.lat);
          const isSelected = s.key === selected;
          const isHover = s.key === hover;
          return (
            <g
              key={s.key}
              transform={`translate(${x},${y})`}
              className="cursor-pointer"
              onClick={() => onSelect(s.key)}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover((h) => (h === s.key ? null : h))}
            >
              {/* halo de sélection */}
              {isSelected && (
                <circle r={9} fill="#3A7E85" opacity={0.18} />
              )}
              <circle
                r={isSelected ? 5.5 : isHover ? 4.5 : 3}
                fill={isSelected ? "#3A7E85" : isHover ? "#4fa3aa" : "#94A3B8"}
                stroke="#fff"
                strokeWidth={1}
                className="transition-all"
              />
            </g>
          );
        })}
      </svg>

      {/* Étiquette de la station active (hover prioritaire, sinon sélectionnée) */}
      {activeStation && (
        <div className="absolute top-2 left-2 rounded-lg bg-white/95 shadow-soft border border-gray-200 px-3 py-1.5 pointer-events-none">
          <div className="text-sm font-medium text-text-primary">
            {activeStation.name}
          </div>
          {activeStation.djuTrentenaire != null && (
            <div className="text-xs text-text-muted">
              DJU trentenaire {activeStation.djuTrentenaire.toLocaleString("fr-FR")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
