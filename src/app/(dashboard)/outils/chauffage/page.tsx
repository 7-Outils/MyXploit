"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronUp, CloudSun, Loader2, MapPin, Search, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import { daysFrom, fmtHeatingDate } from "@/components/heating/HeatingForecast";
import HeatingTimeline from "@/components/heating/HeatingTimeline";
import HeatingCalcPanel from "@/components/heating/HeatingCalcPanel";
import { evaluateDays, fmtDeg } from "@/components/heating/heating-calc";
import { DEFAULT_THRESHOLDS, HEATING_RELIABLE_DAYS, type HeatingWeather } from "@/lib/heating-season";
import type { HolidayPeriod } from "@/lib/school-holidays";
import type { HeatingStatusResponse } from "@/components/overview/heating-types";
import type { GeocodePlace } from "@/app/api/heating/geocode/route";

interface ForecastResponse {
  today: string;
  weather: HeatingWeather;
  holidays: HolidayPeriod[];
}

/** Ce que la page affiche, que la source soit un contrat ou une ville libre. */
interface View {
  today: string;
  weather: HeatingWeather | null;
  holidays: HolidayPeriod[];
  /** Ligne « où » : client · ville, ou ville seule. */
  where: string;
  /** Événement attendu : allumage si les sites sont à l'arrêt, arrêt s'ils chauffent, saison sinon. */
  kind: "start" | "stop";
  /** Nombre de sites du contrat concernés, null pour une ville libre. */
  sites: number | null;
  unavailable: string | null;
}

const placeLabel = (p: GeocodePlace) => [p.name, p.postcode ?? p.department].filter(Boolean).join(" · ");

const seasonKind = (today: string): "start" | "stop" => (Number(today.slice(5, 7)) >= 7 ? "start" : "stop");

export default function HeatingToolPage() {
  const { selectedContract } = useContract();
  // Ville tapée à la main : prend le pas sur le contrat jusqu'à ce qu'on la retire.
  const [manual, setManual] = useState<GeocodePlace | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setActive(0), [debounced]);
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

  const contractKey = !manual && selectedContract ? `/api/contracts/${selectedContract.id}/heating-status` : null;
  const cityKey = manual ? `/api/heating/forecast?lat=${manual.lat}&lon=${manual.lon}&postcode=${manual.postcode ?? ""}` : null;
  const contractRes = useSWR<HeatingStatusResponse>(contractKey, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const cityRes = useSWR<ForecastResponse>(cityKey, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const res = manual ? cityRes : contractRes;
  const loading = res.isLoading || res.isValidating;

  const view: View | null = useMemo(() => {
    if (manual) {
      const d = cityRes.data;
      if (!d) return null;
      return {
        today: d.today,
        weather: d.weather,
        holidays: d.holidays ?? [],
        where: placeLabel(manual),
        kind: seasonKind(d.today),
        sites: null,
        unavailable: null,
      };
    }
    const d = contractRes.data;
    if (!d || !selectedContract) return null;
    const c = d.counts;
    const allOff = c.enChauffe === 0 && c.allumagePrevu === 0 && c.arretPrevu === 0;
    const kind: "start" | "stop" =
      c.total === 0 ? seasonKind(d.today) : allOff ? "start" : c.enChauffe > 0 ? "stop" : seasonKind(d.today);
    const name = selectedContract.client?.name ?? selectedContract.title;
    return {
      today: d.today,
      weather: d.weather,
      holidays: d.holidays ?? [],
      where: d.location ? `${name} · ${d.location.city}` : name,
      kind,
      sites: kind === "start" ? c.arrete : c.enChauffe,
      unavailable:
        c.total === 0
          ? "Ce contrat n'a pas encore de site."
          : d.weather
            ? null
            : "Météo indisponible : aucun site de ce contrat n'a d'adresse ni de coordonnées. Tapez une ville ci-dessus.",
    };
  }, [manual, cityRes.data, contractRes.data, selectedContract]);

  function choose(p: GeocodePlace) {
    setManual(p);
    setQuery("");
    setOpen(false);
  }

  const error = res.error as { info?: { error?: string } } | undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2.5">
        <CloudSun size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-ink">Prévision météo</h1>
      </div>

      {/* Où : le contrat sélectionné en haut de page, ou une ville tapée ici */}
      <div className="flex flex-wrap items-center gap-3">
        <div ref={boxRef} className="relative w-full sm:w-80">
          <div className="flex h-9 items-center gap-2 border border-ink/20 bg-white px-2.5 focus-within:border-accent">
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
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(places.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && places[active]) choose(places[active]);
                else if (e.key === "Escape") setOpen(false);
              }}
              placeholder={selectedContract && !manual ? "Voir une autre ville…" : "Ville ou code postal"}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
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
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left ${i === active ? "bg-ink/[0.04]" : ""}`}
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

        {manual && (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 border border-ink/20 px-2.5 text-sm text-ink">
              <MapPin size={13} className="text-ink/40" />
              {placeLabel(manual)}
            </span>
            {selectedContract && (
              <button
                type="button"
                onClick={() => setManual(null)}
                title="Revenir au contrat sélectionné"
                className="flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {!manual && !selectedContract ? (
        <div className="flex min-h-[200px] items-center justify-center border border-dashed border-ink/15 px-6 text-center text-sm text-ink/40">
          Sélectionnez un contrat en haut de page, ou tapez une ville.
        </div>
      ) : error && !res.data ? (
        <p className="text-sm text-red-600">{error.info?.error ?? "Météo indisponible pour le moment."}</p>
      ) : view ? (
        <div className={`transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}>
          <Result view={view} />
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

function Result({ view }: { view: View }) {
  const { today, weather, holidays, kind, sites } = view;
  const t = DEFAULT_THRESHOLDS;

  const date = kind === "start" ? weather?.startDate ?? null : weather?.stopDate ?? null;
  const dateIn = date ? daysFrom(today, date) : null;
  const isTrend = dateIn !== null && dateIn >= HEATING_RELIABLE_DAYS;

  const [detail, setDetail] = useState(false);
  const evals = useMemo(() => evaluateDays(weather?.days ?? [], today, t), [weather?.days, today, t]);
  const todayIndex = evals.findIndex((e) => !e.past);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const dateIndex = date ? evals.findIndex((e) => e.day.date === date) : -1;
  const focus = evals.length
    ? Math.min(evals.length - 1, hover ?? pinned ?? (dateIndex >= 0 ? dateIndex : Math.max(0, todayIndex)))
    : null;

  if (view.unavailable || !weather || evals.length === 0) {
    return (
      <div className="panel px-4 py-6 text-center text-sm text-ink/50">
        {view.unavailable ?? "Pas de température disponible pour cet endroit."}
      </div>
    );
  }

  const verb = kind === "start" ? "Allumer" : "Arrêter";
  let headline: string;
  if (!date) headline = kind === "start" ? "Pas d'allumage à prévoir" : "Pas d'arrêt à prévoir";
  else if (dateIn! <= 0) headline = kind === "start" ? "Il est temps d'allumer" : "Il est temps d'arrêter";
  else headline = `${verb} le ${fmtHeatingDate(date)}`;

  let sub: string;
  if (!date) {
    sub =
      kind === "start"
        ? "Sur les 15 prochains jours, il ne fait pas assez froid assez longtemps."
        : "Sur les 15 prochains jours, il ne fait pas assez doux assez longtemps.";
  } else if (dateIn! <= 0) sub = "Les conditions sont réunies dès aujourd'hui.";
  else if (isTrend) sub = `Dans ${dateIn} jours. Date indicative : au-delà de 7 jours, la prévision n'est qu'une tendance.`;
  else sub = `Dans ${dateIn} jour${dateIn! > 1 ? "s" : ""}, d'après la météo des derniers jours et la prévision.`;
  if (sites !== null && sites > 0) {
    sub += ` ${sites} site${sites > 1 ? "s" : ""} ${kind === "start" ? "à l'arrêt" : "en chauffe"}.`;
  }

  // Vacances scolaires à venir : pour information (bâtiments scolaires vides).
  const upcoming = holidays.filter((h) => h.to >= today);

  const decisions = date ? [{ kind, date, label: "" }] : [];

  return (
    <div className="space-y-4">
      {/* Décision */}
      <div className={`panel border-l-2 ${date && !isTrend ? "border-l-accent" : "border-l-ink"} px-4 py-3`}>
        <div className="label-tech">{view.where}</div>
        <div className={`mt-1 text-lg font-semibold ${date && !isTrend ? "text-accent" : "text-ink"}`}>{headline}</div>
        <p className="mt-0.5 text-[12px] text-ink/50">{sub}</p>
        {upcoming.length > 0 && (
          <p className="mt-1.5 text-[12px] text-ink/50">
            Pour information,{" "}
            {upcoming
              .map((h) =>
                h.from <= today
                  ? `${h.label.toLowerCase()} en cours jusqu'au ${fmtHeatingDate(h.to)}`
                  : `${h.label.toLowerCase()} du ${fmtHeatingDate(h.from)} au ${fmtHeatingDate(h.to)}`
              )
              .join(" ; ")}
            .
          </p>
        )}
      </div>

      {/* Météo : 7 jours passés + 15 jours prévus */}
      <div className="panel">
        <div className="panel-header">
          <span className="label-tech">Températures · 7 derniers jours et 15 prochains</span>
          <span className="font-mono text-[11px] tabular-nums text-ink/50">
            moy. 5 derniers j <span className="text-ink">{fmtDeg(weather.observedMean5d)}</span> · 7 prochains j{" "}
            <span className="text-ink">{fmtDeg(weather.forecastMean7d)}</span>
          </span>
        </div>
        <div className="px-2 pb-2">
          <HeatingTimeline
            evals={evals}
            thresholds={t}
            todayIndex={todayIndex}
            primary={kind}
            decisions={decisions}
            holidays={holidays}
            focus={focus}
            pinned={detail ? pinned : null}
            onHover={setHover}
            onPick={(i) => setPinned((p) => (p === i ? null : i))}
            detail={detail}
          />
        </div>
        {/* Légende dessinée : les mêmes symboles que sur le graphique */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ink/10 px-4 py-2 text-[12px] text-ink/50">
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="22" aria-hidden="true">
              <rect x="4" y="2" width="6" height="18" fill="#0F1E33" fillOpacity="0.15" />
            </svg>
            Min → max de la journée
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="22" aria-hidden="true">
              <rect x="4" y="2" width="6" height="18" fill="#0F1E33" fillOpacity="0.15" />
              <line x1="1" x2="13" y1="11" y2="11" stroke="#0F1E33" strokeWidth="1.5" />
            </svg>
            Moyenne
          </span>
          {date && (
            <span className="inline-flex items-center gap-2">
              <svg width="14" height="22" aria-hidden="true">
                <rect x="0" y="0" width="14" height="22" fill="#2563EB" fillOpacity="0.08" />
                <line x1="7" x2="7" y1="0" y2="22" stroke="#2563EB" strokeOpacity="0.6" strokeDasharray="2 3" />
              </svg>
              {kind === "start" ? "Jour d'allumage" : "Jour d'arrêt"}
            </span>
          )}
          {holidays.length > 0 && (
            <span className="inline-flex items-center gap-2">
              <svg width="14" height="22" aria-hidden="true">
                <defs>
                  <pattern id="legend-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="#0F1E33" strokeOpacity="0.35" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="14" height="22" fill="url(#legend-hatch)" />
              </svg>
              Vacances scolaires
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="22" aria-hidden="true">
              <rect x="4" y="2" width="6" height="18" fill="#0F1E33" fillOpacity="0.08" />
              <line x1="1" x2="13" y1="11" y2="11" stroke="#0F1E33" strokeOpacity="0.5" strokeWidth="1.5" />
            </svg>
            Au-delà de 7 jours : tendance, moins fiable
          </span>
        </div>
      </div>

      {/* Comment c'est calculé : replié par défaut */}
      <div className="panel">
        <button type="button" onClick={() => setDetail((d) => !d)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
          <span className="label-tech">Comment c&apos;est calculé ?</span>
          {detail ? <ChevronUp size={14} className="text-ink/40" /> : <ChevronDown size={14} className="text-ink/40" />}
        </button>
        {detail && (
          <div className="space-y-3 border-t border-ink/10 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-ink/70">
              Pour chaque jour, on regarde la moyenne des <strong className="text-ink">5 jours précédents</strong> et celle des{" "}
              <strong className="text-ink">7 jours suivants</strong>. On allume le premier jour où la première passe sous {t.start} °C
              et la seconde sous {t.startForecastMax} °C. On arrête quand la moyenne des 5 jours atteint {t.stop} °C sans aucun jour
              prévu sous {t.stopForecastMin} °C.
            </p>
            <HeatingCalcPanel e={focus !== null ? evals[focus] : null} days={evals} thresholds={t} primary={kind} todayIso={today} />
          </div>
        )}
      </div>
    </div>
  );
}
