"use client";

import { useEffect, useMemo, useState } from "react";

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

// Contours réels (GeoJSON métropole simplifié, servi depuis /public) projetés
// avec la MÊME fonction que les points stations → toujours alignés.
function toPath(ring: [number, number][]): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function StationMap({ stations, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [rings, setRings] = useState<[number, number][][]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/france-metropole.json")
      .then((r) => r.json())
      .then((data: [number, number][][]) => {
        if (alive) setRings(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const paths = useMemo(() => rings.map(toPath), [rings]);

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
        {/* Contour pays (continent + Corse + îles) */}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="#F0F4F8" stroke="#CBD5E0" strokeWidth={1} />
        ))}

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
