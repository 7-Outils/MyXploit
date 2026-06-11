"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";

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

const MIN_K = 1;
const MAX_K = 8;

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type View = { k: number; tx: number; ty: number };

export function StationMap({ stations, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [rings, setRings] = useState<[number, number][][]>([]);
  const [deptRings, setDeptRings] = useState<[number, number][][]>([]);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/france-metropole.json").then((r) => r.json()),
      fetch("/france-departements.json").then((r) => r.json()),
    ])
      .then(([metro, depts]: [[number, number][][], [number, number][][]]) => {
        if (!alive) return;
        setRings(metro);
        setDeptRings(depts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const paths = useMemo(() => rings.map(toPath), [rings]);
  const deptPaths = useMemo(() => deptRings.map(toPath), [deptRings]);

  // Empêche le contenu de sortir entièrement du cadre quand on pan/zoome.
  const clampView = useCallback((k: number, tx: number, ty: number): View => {
    const kk = clamp(k, MIN_K, MAX_K);
    const minTx = W * (1 - kk);
    const minTy = H * (1 - kk);
    return {
      k: kk,
      tx: clamp(tx, minTx, 0),
      ty: clamp(ty, minTy, 0),
    };
  }, []);

  // Coordonnées pointeur (client px) → repère viewBox du SVG.
  const toSvg = useCallback((clientX: number, clientY: number): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((clientX - r.left) / r.width) * W, ((clientY - r.top) / r.height) * H];
  }, []);

  // Zoom centré sur un point (px, py) du repère viewBox.
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      setView((v) => {
        const k = clamp(v.k * factor, MIN_K, MAX_K);
        const r = k / v.k;
        return clampView(k, px - (px - v.tx) * r, py - (py - v.ty) * r);
      });
    },
    [clampView]
  );

  // Molette : zoom non-passif (preventDefault) pour ne pas scroller la page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [px, py] = toSvg(e.clientX, e.clientY);
      zoomAt(px, py, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toSvg, zoomAt]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setGrabbing(true);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const r = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.x) / r.width) * W;
    const dy = ((e.clientY - dragRef.current.y) / r.height) * H;
    if (Math.abs(e.clientX - dragRef.current.x) + Math.abs(e.clientY - dragRef.current.y) > 3) {
      movedRef.current = true;
    }
    dragRef.current = { x: e.clientX, y: e.clientY };
    setView((v) => clampView(v.k, v.tx + dx, v.ty + dy));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setGrabbing(false);
  }

  const active = hover ?? selected;
  const activeStation = stations.find((s) => s.key === active) ?? null;
  const zoomed = view.k > 1.001;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full h-auto select-none touch-none ${
          grabbing ? "cursor-grabbing" : zoomed ? "cursor-grab" : "cursor-default"
        }`}
        role="img"
        aria-label="Carte des stations météo de France"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Géographie : translatée + scalée par le zoom */}
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          {/* Fond pays (continent + Corse + îles) */}
          {paths.map((d, i) => (
            <path key={i} d={d} fill="#F0F4F8" stroke="#CBD5E0" strokeWidth={1 / view.k} />
          ))}
          {/* Séparations départementales (traits fins, sans remplissage) */}
          {deptPaths.map((d, i) => (
            <path
              key={`dep-${i}`}
              d={d}
              fill="none"
              stroke="#D7DEE6"
              strokeWidth={0.5 / view.k}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Stations : centres déplacés par le zoom, mais RAYON constant en px
            → zoomer écarte les pastilles proches sans les grossir. */}
        {stations.map((s) => {
          const [px, py] = project(s.lon, s.lat);
          const x = px * view.k + view.tx;
          const y = py * view.k + view.ty;
          const isSelected = s.key === selected;
          const isHover = s.key === hover;
          return (
            <g
              key={s.key}
              transform={`translate(${x},${y})`}
              className="cursor-pointer"
              onClick={() => {
                if (!movedRef.current) onSelect(s.key);
              }}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover((h) => (h === s.key ? null : h))}
            >
              {/* zone de clic invisible élargie (confort, surtout zoomé) */}
              <circle r={9} fill="transparent" />
              {isSelected && <circle r={9} fill="#3A7E85" opacity={0.18} />}
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

      {/* Contrôles de zoom */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomAt(W / 2, H / 2, 1.4)}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/95 border border-gray-200 shadow-soft text-text-secondary hover:text-text-primary hover:bg-white"
          title="Zoomer"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={() => zoomAt(W / 2, H / 2, 1 / 1.4)}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/95 border border-gray-200 shadow-soft text-text-secondary hover:text-text-primary hover:bg-white"
          title="Dézoomer"
        >
          <Minus size={16} />
        </button>
        {zoomed && (
          <button
            type="button"
            onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/95 border border-gray-200 shadow-soft text-text-secondary hover:text-text-primary hover:bg-white"
            title="Réinitialiser"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
