"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Flame, Loader2, MapPin, Search } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { daysFrom, fmtHeatingDate } from "@/components/heating/HeatingForecast";
import HeatingTimeline from "@/components/heating/HeatingTimeline";
import HeatingCalcPanel from "@/components/heating/HeatingCalcPanel";
import { evaluateDays, firstRuleDate, fmtDeg, fmtDM, fmtLongDate, fmtWeekdayShort } from "@/components/heating/heating-calc";
import { HEATING_RELIABLE_DAYS, type HeatingWeather } from "@/lib/heating-season";
import { HEATING_PROFILE_THRESHOLDS } from "@/lib/heating-profiles";
import type { HolidayPeriod } from "@/lib/school-holidays";
import type { GeocodePlace } from "@/app/api/heating/geocode/route";

const STORAGE_KEY = "heating-tool-place";
const BUILDING_KEY = "heating-tool-building";

// Types de bâtiment proposés : un profil de seuils, et le calendrier scolaire
// pour les écoles.
const BUILDINGS = [
  { key: "CRECHE", label: "Crèche · santé", short: "Crèche", profile: "SENSIBLE", school: false },
  { key: "ECOLE", label: "École · collège · lycée", short: "École", profile: "STANDARD", school: true },
  { key: "MAIRIE", label: "Mairie · bureaux", short: "Mairie", profile: "STANDARD", school: false },
  { key: "GYMNASE", label: "Gymnase", short: "Gymnase", profile: "SPORTIF", school: false },
] as const;
type Building = (typeof BUILDINGS)[number];
type BuildingKey = Building["key"];

interface ForecastResponse {
  today: string;
  weather: HeatingWeather;
  startNote: string | null;
  stopNote: string | null;
  zone: string | null;
  holidays?: HolidayPeriod[];
}

interface Shown {
  key: string;
  place: GeocodePlace;
  building: Building;
  data: ForecastResponse;
}

function loadPlace(): GeocodePlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GeocodePlace) : null;
  } catch {
    return null;
  }
}

function savePlace(p: GeocodePlace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible : on ne retient simplement pas la ville */
  }
}

const placeLabel = (p: GeocodePlace) => [p.name, p.postcode ?? p.department].filter(Boolean).join(" · ");

export default function HeatingToolPage() {
  const [place, setPlace] = useState<GeocodePlace | null>(null);
  const [building, setBuilding] = useState<BuildingKey>("ECOLE");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ouverture depuis un contrat : ?city=&postcode=&lat=&lon= prime sur la ville retenue.
  const params = useSearchParams();
  useEffect(() => {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    const city = params.get("city");
    if (city && Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) {
      const p: GeocodePlace = { id: -1, name: city, department: null, postcode: params.get("postcode") || null, lat, lon };
      setPlace(p);
      savePlace(p);
      return;
    }
    const saved = loadPlace();
    if (saved) setPlace(saved);
    try {
      const b = localStorage.getItem(BUILDING_KEY);
      if (BUILDINGS.some((x) => x.key === b)) setBuilding(b as BuildingKey);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseBuilding(b: BuildingKey) {
    setBuilding(b);
    try {
      localStorage.setItem(BUILDING_KEY, b);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: geo, isLoading: searching } = useSWR<{ places: GeocodePlace[] }>(
    debounced.length >= 2 ? `/api/heating/geocode?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const places = geo?.places ?? [];
  useEffect(() => setActive(0), [debounced]);

  const cfg = BUILDINGS.find((b) => b.key === building)!;
  const key = place
    ? `/api/heating/forecast?lat=${place.lat}&lon=${place.lon}&profile=${cfg.profile}` +
      (cfg.school ? `&school=1&postcode=${place.postcode ?? ""}` : "")
    : null;
  const { data, error } = useSWR<ForecastResponse>(key, fetcher, { revalidateOnFocus: false });

  // On garde le dernier résultat affiché pendant le chargement du suivant :
  // la page ne clignote pas quand on change de ville ou de bâtiment.
  useEffect(() => {
    if (data && key && place) setShown({ key, place, building: cfg, data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);

  function choose(p: GeocodePlace) {
    setPlace(p);
    savePlace(p);
    setQuery("");
    setOpen(false);
  }

  const loading = !!key && !data && !error;
  const current = shown && shown.key === key ? shown : null;
  const display = current ?? shown;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-2.5">
        <Flame size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-ink">Allumage du chauffage</h1>
      </div>

      {/* Réglages : ville + type de bâtiment */}
      <div className="flex flex-wrap items-center gap-3">
        <div ref={boxRef} className="relative w-full sm:w-80">
          <div className="flex h-9 items-center gap-2 border border-ink/20 bg-white px-2.5 focus-within:border-accent">
            {place && !query ? (
              <MapPin size={14} className="shrink-0 text-ink/40" />
            ) : (
              <Search size={14} className="shrink-0 text-ink/40" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(places.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && places[active]) choose(places[active]);
                else if (e.key === "Escape") setOpen(false);
              }}
              placeholder={place ? placeLabel(place) : "Ville ou code postal"}
              className={`min-w-0 flex-1 bg-transparent text-sm text-ink outline-none ${
                place ? "placeholder:text-ink" : "placeholder:text-ink/40"
              }`}
            />
            {searching && <Loader2 size={14} className="animate-spin text-ink/40" />}
          </div>
          {open && debounced.length >= 2 && geo && (
            <div className="absolute z-30 mt-px w-full border border-ink/20 bg-white">
              {places.length === 0 ? (
                <div className="px-3 py-2 text-sm text-ink/40">Aucune commune trouvée</div>
              ) : (
                places.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(p)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left ${
                      i === active ? "bg-ink/[0.04]" : ""
                    }`}
                  >
                    <span className="text-sm text-ink">{p.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink/40">
                      {[p.postcode, p.department].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="inline-flex border border-ink/20">
          {BUILDINGS.map((b, i) => (
            <button
              key={b.key}
              type="button"
              onClick={() => chooseBuilding(b.key)}
              title={b.label}
              className={`${i > 0 ? "border-l border-ink/20" : ""} px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                b.key === building ? "bg-ink text-paper" : "text-ink/50 hover:text-ink"
              }`}
            >
              {b.short}
            </button>
          ))}
        </div>
      </div>

      {!place ? (
        <div className="flex min-h-[200px] items-center justify-center border border-dashed border-ink/15 px-6 text-center text-sm text-ink/40">
          Tapez une ville : on compare les 7 derniers jours et les 15 prochains aux seuils du bâtiment, et on donne la
          date d&apos;allumage ou d&apos;arrêt.
        </div>
      ) : error && !data ? (
        <p className="text-sm text-red-600">
          {(error as { info?: { error?: string } } | undefined)?.info?.error ?? "Météo indisponible pour le moment."}
        </p>
      ) : display ? (
        <div className={`transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}>
          <Result key={display.key} shown={display} />
        </div>
      ) : (
        <div className="panel flex min-h-[200px] items-center justify-center gap-2 text-sm text-ink/40">
          <Loader2 size={14} className="animate-spin" /> Chargement de la météo…
        </div>
      )}
    </div>
  );
}

// ─── Résultat ───────────────────────────────────────────────────────────────

function Result({ shown }: { shown: Shown }) {
  const { place, building, data } = shown;
  const { today, weather, startNote, stopNote, zone } = data;
  const holidays = data.holidays ?? [];
  const { startDate, stopDate } = weather;
  const t = HEATING_PROFILE_THRESHOLDS[building.profile];

  const evals = useMemo(() => evaluateDays(weather.days, today, t), [weather.days, today, t]);
  const todayIndex = evals.findIndex((e) => !e.past);

  // Sans état d'installation, on suit la saison : juillet → décembre on
  // cherche la date d'allumage, janvier → juin la date d'arrêt (l'autre date
  // reste visible dans les chiffres clés).
  const autumn = Number(today.slice(5, 7)) >= 7;
  const primary: "start" | "stop" = autumn ? "start" : "stop";
  const nextDate = autumn ? startDate : stopDate;
  const next = nextDate ? { kind: primary, date: nextDate } : null;
  const nextIn = next ? daysFrom(today, next.date) : null;
  const isTrend = nextIn !== null && nextIn >= HEATING_RELIABLE_DAYS;
  const note = next ? (next.kind === "start" ? startNote : stopNote) : null;
  const ruleDate = firstRuleDate(evals, primary);
  const shifted = next && ruleDate && ruleDate !== next.date ? ruleDate : null;

  const decisionIndex = next ? evals.findIndex((e) => e.day.date === next.date) : -1;
  const [pinned, setPinned] = useState<number>(decisionIndex >= 0 ? decisionIndex : Math.max(0, todayIndex));
  const [hover, setHover] = useState<number | null>(null);
  const focus = evals.length ? Math.min(evals.length - 1, hover ?? pinned) : null;

  if (evals.length === 0) {
    return <div className="panel px-4 py-6 text-center text-sm text-ink/50">Pas de température disponible pour cette ville.</div>;
  }

  const verb = primary === "start" ? "Allumer" : "Arrêter";
  let headline: string;
  if (!next) headline = `Pas ${primary === "start" ? "d'allumage" : "d'arrêt"} à prévoir`;
  else if (nextIn! <= 0) headline = `${verb} aujourd'hui`;
  else headline = `${verb} le ${fmtWeekdayShort(next.date)}. ${fmtDM(next.date)}`;

  let sub: string;
  if (!next) {
    sub =
      primary === "start"
        ? "Sur 15 jours, il ne fait pas assez froid assez longtemps pour allumer."
        : "Sur 15 jours, il ne fait pas assez doux assez longtemps pour arrêter.";
  } else if (nextIn! <= 0) {
    sub = "Les deux conditions sont réunies dès aujourd'hui.";
  } else if (isTrend) {
    sub = `J−${nextIn}, date indicative : au-delà de 7 jours, la prévision n'est qu'une tendance.`;
  } else {
    sub = `J−${nextIn}, d'après la prévision.`;
  }
  const detail = [sub, shifted ? `La météo seule donnerait le ${fmtLongDate(shifted)}.` : null, note ? `${note}.` : null]
    .filter(Boolean)
    .join(" ");

  const fmtShort = (iso: string | null) => (!iso ? "–" : iso === today ? "Aujourd'hui" : fmtHeatingDate(iso));
  const kpis = [
    { label: "Allumage", value: fmtShort(startDate) },
    { label: "Arrêt", value: fmtShort(stopDate) },
    { label: "Moy. 5 derniers j", value: fmtDeg(weather.observedMean5d) },
    { label: "Moy. 7 prochains j", value: fmtDeg(weather.forecastMean7d) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* Décision */}
        <div className="panel flex flex-col">
          <div className="px-4 pb-3 pt-2.5">
            <div className="label-tech truncate">
              {placeLabel(place)} · {building.label}
              {building.school && zone && <> · {zone}</>}
            </div>
            <div className={`mt-1.5 text-lg font-semibold ${next && !isTrend ? "text-accent" : "text-ink"}`}>{headline}</div>
            <p className="mt-0.5 text-[12px] leading-snug text-ink/50">{detail}</p>
          </div>
          <div className="mt-auto grid grid-cols-2 divide-x divide-ink/10 border-t border-ink/10 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="px-4 py-2.5">
                <div className="label-tech truncate">{k.label}</div>
                <div className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-ink first-letter:uppercase">
                  {k.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calcul du jour sélectionné */}
        <HeatingCalcPanel e={focus !== null ? evals[focus] : null} days={evals} thresholds={t} primary={primary} todayIso={today} />
      </div>

      {/* Frise 22 jours + tableau aligné */}
      <div className="panel">
        <div className="panel-header flex-wrap">
          <span className="label-tech">7 jours passés · 15 jours de prévision</span>
          <Legend t={t} holidays={holidays.length > 0} />
        </div>
        <div className="px-4 pb-3 pt-2">
          <HeatingTimeline
            evals={evals}
            thresholds={t}
            todayIndex={todayIndex}
            primary={primary}
            decision={next && decisionIndex >= 0 ? next : null}
            holidays={holidays}
            focus={focus}
            pinned={pinned}
            onHover={setHover}
            onPick={(i) => {
              setPinned(i);
              setHover(null);
            }}
          />
          <p className="mt-2 text-[11px] text-ink/40">Survol : calcul du jour. Clic ou flèches ← → : garder un jour.</p>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink/50">
        <span className="font-medium text-ink/70">{building.label}.</span> Allumage le premier jour où la moyenne des 5
        jours d&apos;avant passe sous {t.start}° et où les 7 jours suivants restent sous {t.startForecastMax}° en moyenne.
        Arrêt quand la moyenne des 5 jours d&apos;avant atteint {t.stop}° et qu&apos;aucun des 7 jours suivants ne descend
        sous {t.stopForecastMin}° (en moyenne journalière).
        {building.school && (
          <> Une date qui tombe pendant les vacances scolaires est reportée à la veille de la rentrée (allumage) ou avancée au début des vacances (arrêt).</>
        )}{" "}
        Prévision Open-Meteo, mise à jour toutes les 6 h.
      </p>
    </div>
  );
}

function Legend({ t, holidays }: { t: { start: number; stop: number }; holidays: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" aria-hidden>
          <rect x="3" y="0" width="6" height="12" fill="#0F1E33" fillOpacity="0.15" />
          <line x1="1" x2="11" y1="6" y2="6" stroke="#0F1E33" strokeWidth="1.5" />
        </svg>
        min–max · moyenne
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="2" aria-hidden>
          <line x1="0" y1="1" x2="18" y2="1" stroke="#D97706" strokeDasharray="5 3" />
        </svg>
        allumage {t.start}°
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="2" aria-hidden>
          <line x1="0" y1="1" x2="18" y2="1" stroke="#2563EB" strokeDasharray="5 3" />
        </svg>
        arrêt {t.stop}°
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 border border-dashed border-ink/30 bg-ink/[0.04]" />
        fenêtres du calcul
      </span>
      {holidays && (
        <span className="flex items-center gap-1.5">
          <svg width="14" height="10" aria-hidden>
            <defs>
              <pattern id="legend-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="#0F1E33" strokeOpacity="0.3" />
              </pattern>
            </defs>
            <rect width="14" height="10" fill="url(#legend-hatch)" />
          </svg>
          vacances
        </span>
      )}
    </div>
  );
}
