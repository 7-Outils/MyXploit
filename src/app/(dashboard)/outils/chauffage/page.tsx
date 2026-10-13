"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronUp, Flame, Loader2, MapPin, Search, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import { daysFrom, fmtHeatingDate } from "@/components/heating/HeatingForecast";
import HeatingTimeline from "@/components/heating/HeatingTimeline";
import HeatingCalcPanel from "@/components/heating/HeatingCalcPanel";
import { evaluateDays, fmtDeg } from "@/components/heating/heating-calc";
import { HEATING_RELIABLE_DAYS, type HeatingWeather } from "@/lib/heating-season";
import { HEATING_PROFILE_THRESHOLDS, type HeatingProfile } from "@/lib/heating-profiles";
import type { HeatingGroup } from "@/lib/heating-groups";
import type { HolidayPeriod } from "@/lib/school-holidays";
import type { HeatingStatusResponse } from "@/components/overview/heating-types";
import type { GeocodePlace } from "@/app/api/heating/geocode/route";

interface ForecastResponse {
  today: string;
  weather: HeatingWeather;
  groups: HeatingGroup[];
  holidays: HolidayPeriod[];
  zone: string | null;
}

/** Ce que la page affiche, que la source soit un contrat ou une ville libre. */
interface View {
  today: string;
  weather: HeatingWeather | null;
  groups: HeatingGroup[];
  holidays: HolidayPeriod[];
  /** Ligne « où » : client · ville, ou ville seule. */
  where: string;
  /** Événement attendu : allumage si les sites sont à l'arrêt, arrêt s'ils chauffent, saison sinon. */
  kind: "start" | "stop";
  /** Effectifs par famille (mode contrat). */
  withCounts: boolean;
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
        groups: d.groups ?? [],
        holidays: d.holidays ?? [],
        where: placeLabel(manual),
        kind: seasonKind(d.today),
        withCounts: false,
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
      groups: d.groups ?? [],
      holidays: d.holidays ?? [],
      where: d.location ? `${name} · ${d.location.city}` : name,
      kind,
      withCounts: true,
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
        <Flame size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-ink">Allumage du chauffage</h1>
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

interface Line {
  key: string;
  label: string;
  count: number;
  profile: HeatingProfile;
  date: string | null;
  note: string | null;
}

function Result({ view }: { view: View }) {
  const { today, weather, groups, holidays, kind, withCounts } = view;

  // Une ligne par famille présente ; les piscines, chauffées toute l'année, sont hors sujet.
  const lines: Line[] = groups
    .filter((g) => g.profile !== "HORS_SIGNAL")
    .map((g) => ({
      key: g.key,
      label: g.label,
      count: g.siteIds.length,
      profile: g.profile,
      date: kind === "start" ? g.startDate : g.stopDate,
      note: kind === "start" ? g.startNote : g.stopNote,
    }));
  const dated = lines.filter((l): l is Line & { date: string } => !!l.date).sort((a, b) => a.date.localeCompare(b.date));
  const first = dated[0]?.date ?? null;
  const firstIn = first ? daysFrom(today, first) : null;
  const spread = dated.length > 1 && dated[dated.length - 1].date !== first;
  const isTrend = firstIn !== null && firstIn >= HEATING_RELIABLE_DAYS;

  const [detail, setDetail] = useState(false);
  const [family, setFamily] = useState<string | null>(null);
  const shownFamily = lines.find((l) => l.key === family) ?? dated[0] ?? lines[0] ?? null;
  const thresholds = HEATING_PROFILE_THRESHOLDS[(shownFamily?.profile ?? "STANDARD") as Exclude<HeatingProfile, "HORS_SIGNAL">];

  const evals = useMemo(() => evaluateDays(weather?.days ?? [], today, thresholds), [weather?.days, today, thresholds]);
  const todayIndex = evals.findIndex((e) => !e.past);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const defaultPin = shownFamily?.date ? evals.findIndex((e) => e.day.date === shownFamily.date) : -1;
  const focus = evals.length
    ? Math.min(evals.length - 1, hover ?? pinned ?? (defaultPin >= 0 ? defaultPin : Math.max(0, todayIndex)))
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
  if (!first) headline = kind === "start" ? "Pas d'allumage à prévoir" : "Pas d'arrêt à prévoir";
  else if (firstIn! <= 0) headline = kind === "start" ? "Il est temps d'allumer" : "Il est temps d'arrêter";
  else headline = `${verb} ${spread ? "à partir du" : "le"} ${fmtHeatingDate(first)}`;

  let sub: string;
  if (!first) {
    sub =
      kind === "start"
        ? "Sur les 15 prochains jours, il ne fait pas assez froid assez longtemps."
        : "Sur les 15 prochains jours, il ne fait pas assez doux assez longtemps.";
  } else if (firstIn! <= 0) sub = "Les conditions sont réunies dès aujourd'hui.";
  else if (isTrend) sub = `Dans ${firstIn} jours. Date indicative : au-delà de 7 jours, la prévision n'est qu'une tendance.`;
  else sub = `Dans ${firstIn} jour${firstIn! > 1 ? "s" : ""}, d'après la météo des derniers jours et la prévision.`;

  const fmtLine = (iso: string | null) => (!iso ? "pas sur 15 jours" : iso === today ? "aujourd'hui" : fmtHeatingDate(iso));
  const decisions = dated.map((l) => ({ kind, date: l.date, label: l.label }));

  return (
    <div className="space-y-4">
      {/* Décision */}
      <div className={`panel border-l-2 ${first && !isTrend ? "border-l-accent" : "border-l-ink"} px-4 py-3`}>
        <div className="label-tech">{view.where}</div>
        <div className={`mt-1 text-lg font-semibold ${first && !isTrend ? "text-accent" : "text-ink"}`}>{headline}</div>
        <p className="mt-0.5 text-[12px] text-ink/50">{sub}</p>

        {lines.length > 0 && (
          <ul className="mt-3 divide-y divide-ink/[0.06] border-t border-ink/10">
            {lines.map((l) => (
              <li key={l.key} className="flex items-baseline gap-3 py-1.5 text-sm">
                <span className="text-ink">
                  {l.label}
                  {withCounts && <span className="ml-1.5 font-mono text-[11px] tabular-nums text-ink/40">×{l.count}</span>}
                </span>
                <span className="flex-1 translate-y-[-4px] border-b border-dotted border-ink/15" />
                <span
                  className={`font-mono tabular-nums ${
                    l.date === first ? "font-semibold text-accent" : l.date ? "text-ink" : "text-ink/40"
                  }`}
                >
                  {fmtLine(l.date)}
                </span>
                {l.note && <span className="text-[12px] text-ink/40">· {l.note}</span>}
              </li>
            ))}
          </ul>
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
            thresholds={thresholds}
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
        <p className="border-t border-ink/10 px-4 py-2 text-[12px] text-ink/50">
          Chaque jour : barre du minimum au maximum, trait à la moyenne. Les jours 8 à 15 sont une tendance, moins fiable.
          Les vacances scolaires sont hachurées.
        </p>
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
              <strong className="text-ink">7 jours suivants</strong>. On allume le premier jour où les deux passent sous les seuils de
              la famille de bâtiments ({thresholds.start} °C et {thresholds.startForecastMax} °C pour{" "}
              {shownFamily?.label.toLowerCase() ?? "cette famille"}) ; on arrête quand la moyenne des 5 jours atteint{" "}
              {thresholds.stop} °C sans aucun jour prévu sous {thresholds.stopForecastMin} °C. Pour les écoles, une date tombant
              pendant les vacances est reportée à la veille de la rentrée. Survolez un jour sur le graphique pour voir ses deux
              fenêtres.
            </p>
            {lines.length > 1 && (
              <div className="inline-flex flex-wrap border border-ink/20">
                {lines.map((l, i) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setFamily(l.key)}
                    className={`${i > 0 ? "border-l border-ink/20" : ""} px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                      l.key === shownFamily?.key ? "bg-ink text-paper" : "text-ink/50 hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
            <HeatingCalcPanel e={focus !== null ? evals[focus] : null} days={evals} thresholds={thresholds} primary={kind} todayIso={today} />
            <p className="text-xs text-ink/40">Prévision Open-Meteo, mise à jour toutes les 6 h. Seuils d&apos;usage, sans norme derrière.</p>
          </div>
        )}
      </div>
    </div>
  );
}
