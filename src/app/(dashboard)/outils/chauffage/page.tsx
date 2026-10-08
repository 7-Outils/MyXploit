"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Flame, Loader2, MapPin, Search } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import HeatingForecast, { daysFrom, fmtHeatingDate } from "@/components/heating/HeatingForecast";
import { fmtTemp } from "@/components/overview/heating-types";
import {
  HEATING_RELIABLE_DAYS,
  HEATING_START_FORECAST_MAX,
  HEATING_START_THRESHOLD,
  HEATING_STOP_FORECAST_MIN,
  HEATING_STOP_THRESHOLD,
  type HeatingWeather,
} from "@/lib/heating-season";
import type { GeocodePlace } from "@/app/api/heating/geocode/route";

const STORAGE_KEY = "heating-tool-place";

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

const placeLabel = (p: GeocodePlace) =>
  [p.name, p.postcode ?? p.department].filter(Boolean).join(" · ");

export default function HeatingToolPage() {
  const [place, setPlace] = useState<GeocodePlace | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadPlace();
    if (saved) setPlace(saved);
  }, []);

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

  const { data, error, isLoading } = useSWR<{ today: string; weather: HeatingWeather }>(
    place ? `/api/heating/forecast?lat=${place.lat}&lon=${place.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  function choose(p: GeocodePlace) {
    setPlace(p);
    savePlace(p);
    setQuery("");
    setOpen(false);
  }

  const places = geo?.places ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2.5">
        <Flame size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-ink">Allumage du chauffage</h1>
      </div>

      {/* Recherche de ville */}
      <div ref={boxRef} className="relative max-w-md">
        <div className="flex h-10 items-center gap-2 border border-ink/20 bg-white px-3 focus-within:border-accent">
          <Search size={14} className="shrink-0 text-ink/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && places[0]) choose(places[0]);
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={place ? placeLabel(place) : "Ville ou code postal"}
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
          />
          {searching && <Loader2 size={14} className="animate-spin text-ink/40" />}
        </div>
        {open && debounced.length >= 2 && geo && (
          <div className="absolute z-20 mt-1 w-full border border-ink/20 bg-white">
            {places.length === 0 ? (
              <div className="px-3 py-2 text-sm text-ink/40">Aucune commune trouvée</div>
            ) : (
              places.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choose(p)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-ink/[0.03]"
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

      {!place ? (
        <div className="flex min-h-[200px] items-center justify-center border border-dashed border-ink/15 text-sm text-ink/40">
          Tapez une ville pour savoir quand allumer ou arrêter le chauffage.
        </div>
      ) : isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center text-ink/40">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : error || !data ? (
        <div className="panel px-4 py-3 text-sm text-red-600">
          {(error as { info?: { error?: string } } | undefined)?.info?.error ?? "Météo indisponible pour le moment"}
        </div>
      ) : (
        <Result place={place} today={data.today} weather={data.weather} />
      )}
    </div>
  );
}

function Result({ place, today, weather }: { place: GeocodePlace; today: string; weather: HeatingWeather }) {
  const { startDate, stopDate } = weather;
  const forecast = weather.days.filter((d) => d.isForecast);

  // Sans état d'installation, on suit la saison : juillet → décembre on
  // cherche la date d'allumage, janvier → juin la date d'arrêt (l'autre date
  // reste visible dans les chiffres clés).
  const autumn = Number(today.slice(5, 7)) >= 7;
  const next = autumn
    ? startDate ? { type: "start" as const, date: startDate } : null
    : stopDate ? { type: "stop" as const, date: stopDate } : null;
  const nextIn = next ? daysFrom(today, next.date) : null;
  const isTrend = nextIn !== null && nextIn >= HEATING_RELIABLE_DAYS;

  let headline: string;
  let sub: string;
  if (!next) {
    headline = autumn ? "Pas d'allumage à prévoir" : "Pas d'arrêt à prévoir";
    sub = "Rien à faire sur les 15 prochains jours d'après la prévision.";
  } else if (nextIn === 0) {
    headline = next.type === "start" ? "Il est temps d'allumer" : "Il est temps d'arrêter";
    sub = "Les conditions sont réunies dès aujourd'hui.";
  } else {
    headline = `${next.type === "start" ? "Allumer" : "Arrêter"} le ${fmtHeatingDate(next.date)}`;
    sub = isTrend
      ? `Dans ${nextIn} jours. Date indicative : au-delà de 7 jours, la prévision n'est qu'une tendance.`
      : `Dans ${nextIn} jour${nextIn! > 1 ? "s" : ""}, d'après la prévision.`;
  }

  const fmtNext = (iso: string | null) =>
    !iso ? "–" : iso === today ? "Aujourd'hui" : fmtHeatingDate(iso);

  return (
    <div className="space-y-4">
      <div className={`panel px-4 py-3 border-l-2 ${next && !isTrend ? "border-l-accent" : "border-l-ink"}`}>
        <div className="flex items-center gap-1.5 label-tech">
          <MapPin size={12} />
          {placeLabel(place)}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${next && !isTrend ? "text-accent" : "text-ink"}`}>{headline}</div>
        <p className="mt-0.5 text-[13px] text-ink/50">{sub}</p>
      </div>

      <div className="panel grid grid-cols-2 sm:grid-cols-4 divide-x divide-ink/10">
        {[
          { label: "Allumage", value: fmtNext(startDate), mono: false },
          { label: "Arrêt", value: fmtNext(stopDate), mono: false },
          { label: "Moyenne 5 derniers jours", value: fmtTemp(weather.observedMean5d), mono: true },
          { label: "Moyenne 7 prochains jours", value: fmtTemp(weather.forecastMean7d), mono: true },
        ].map((k) => (
          <div key={k.label} className="px-4 py-3">
            <div className="label-tech">{k.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="panel px-4 py-3">
        <HeatingForecast days={forecast} highlight={next?.date ?? null} />
      </div>

      <p className="text-xs text-ink/40 leading-relaxed">
        Allumage le premier jour où la moyenne des 5 jours précédents passe sous {HEATING_START_THRESHOLD} °C et où la
        semaine suivante reste sous {HEATING_START_FORECAST_MAX} °C en moyenne. Arrêt quand cette moyenne atteint{" "}
        {HEATING_STOP_THRESHOLD} °C sans aucun jour prévu sous {HEATING_STOP_FORECAST_MIN} °C. Prévision Open-Meteo, mise à
        jour toutes les 6 h.
      </p>
    </div>
  );
}
