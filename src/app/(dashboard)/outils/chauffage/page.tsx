"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Baby, CalendarDays, Dumbbell, Flame, Landmark, Loader2, MapPin, School, Search, Snowflake } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { daysFrom, fmtHeatingDate } from "@/components/heating/HeatingForecast";
import HeatingTimeline, { HX } from "@/components/heating/HeatingTimeline";
import HeatingCalcPanel from "@/components/heating/HeatingCalcPanel";
import { evaluateDays, firstRuleDate, fmtDeg, fmtLongDate } from "@/components/heating/heating-calc";
import { plexMono } from "@/components/landing/fonts";
import { HEATING_RELIABLE_DAYS, type HeatingWeather } from "@/lib/heating-season";
import { HEATING_PROFILE_THRESHOLDS } from "@/lib/heating-profiles";
import type { HolidayPeriod } from "@/lib/school-holidays";
import type { GeocodePlace } from "@/app/api/heating/geocode/route";

const STORAGE_KEY = "heating-tool-place";
const BUILDING_KEY = "heating-tool-building";

// Types de bâtiment proposés : un profil de seuils, et le calendrier scolaire
// pour les écoles.
const BUILDINGS = [
  { key: "CRECHE", label: "Crèche · santé", short: "Crèche", profile: "SENSIBLE", school: false, Icon: Baby },
  { key: "ECOLE", label: "École · collège · lycée", short: "École", profile: "STANDARD", school: true, Icon: School },
  { key: "MAIRIE", label: "Mairie · bureaux", short: "Mairie", profile: "STANDARD", school: false, Icon: Landmark },
  { key: "GYMNASE", label: "Gymnase", short: "Gymnase", profile: "SPORTIF", school: false, Icon: Dumbbell },
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

// Animations propres à la page (préfixe hx-), coupées si l'utilisateur
// demande moins de mouvement.
const STYLES = `
.hx-rise{animation:hxRise .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes hxRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.hx-fade,.hx-swap{animation:hxFade .4s ease both}
.hx-swap{animation-duration:.2s}
@keyframes hxFade{from{opacity:0}to{opacity:1}}
.hx-grow{transform-box:fill-box;transform-origin:center;animation:hxGrow .55s cubic-bezier(.2,.7,.2,1) both}
@keyframes hxGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.hx-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:hxDraw 1.1s cubic-bezier(.4,0,.2,1) .35s forwards}
@keyframes hxDraw{to{stroke-dashoffset:0}}
.hx-ping{transform-box:fill-box;transform-origin:center;animation:hxPing 1.8s cubic-bezier(0,0,.2,1) 1.3s infinite both}
@keyframes hxPing{0%{transform:scale(1);opacity:.9}80%,100%{transform:scale(2.6);opacity:0}}
.hx-pop{transform-box:fill-box;transform-origin:center;animation:hxPop .45s cubic-bezier(.3,1.5,.5,1) both}
@keyframes hxPop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.hx-breathe{animation:hxBreathe 7s ease-in-out infinite alternate}
@keyframes hxBreathe{from{opacity:.5;transform:scale(1)}to{opacity:.9;transform:scale(1.12)}}
.hx-date{animation:hxDate .7s cubic-bezier(.2,.7,.2,1) .15s both}
@keyframes hxDate{from{opacity:0;transform:translateY(8px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
@media (prefers-reduced-motion:reduce){
  .hx-root *{animation:none!important;transition:none!important}
  .hx-root .hx-draw{stroke-dasharray:none;stroke-dashoffset:0}
}
`;

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

  const buildingIndex = BUILDINGS.findIndex((b) => b.key === building);
  const loading = !!key && !data && !error;
  const current = shown && shown.key === key ? shown : null;

  return (
    <div className={`hx-root ${plexMono.variable} mx-auto max-w-6xl space-y-5`}>
      <style>{STYLES}</style>

      {/* En-tête + réglages */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 text-white shadow-[0_6px_20px_-6px_rgba(234,88,12,0.7)]">
            <Flame size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Allumage du chauffage</h1>
            <p className="text-[13px] text-slate-500">Quand allumer ou arrêter, d&apos;après la météo des 15 prochains jours.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Recherche de ville */}
        <div ref={boxRef} className="relative w-full lg:max-w-sm">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-100">
            {place && !query ? <MapPin size={15} className="shrink-0 text-orange-500" /> : <Search size={15} className="shrink-0 text-slate-400" />}
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
              className={`flex-1 bg-transparent text-sm text-slate-900 outline-none ${
                place ? "placeholder:font-medium placeholder:text-slate-800" : "placeholder:text-slate-400"
              }`}
            />
            {searching && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          {open && debounced.length >= 2 && geo && (
            <div className="hx-rise absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl" style={{ animationDuration: "0.18s" }}>
              {places.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">Aucune commune trouvée</div>
              ) : (
                places.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(p)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left ${i === active ? "bg-orange-50" : ""}`}
                  >
                    <span className="text-sm text-slate-900">{p.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {[p.postcode, p.department].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Type de bâtiment : sélecteur à curseur glissant */}
        <div className="relative grid flex-1 grid-cols-4 rounded-xl bg-slate-200/70 p-1 lg:max-w-2xl">
          <div
            className="absolute bottom-1 left-1 top-1 rounded-lg bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(.3,1.3,.5,1)]"
            style={{ width: "calc((100% - 0.5rem) / 4)", transform: `translateX(${buildingIndex * 100}%)` }}
          />
          {BUILDINGS.map((b) => {
            const on = b.key === building;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => chooseBuilding(b.key)}
                title={b.label}
                className={`relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors ${
                  on ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <b.Icon size={15} className={on ? "text-orange-500" : ""} />
                <span className="hidden truncate sm:inline xl:hidden">{b.short}</span>
                <span className="hidden truncate xl:inline">{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!place ? (
        <EmptyState />
      ) : error && !data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {(error as { info?: { error?: string } } | undefined)?.info?.error ?? "Météo indisponible pour le moment"}
        </div>
      ) : current || shown ? (
        <div className="relative">
          <Result key={(current ?? shown)!.key} shown={(current ?? shown)!} />
          {loading && (
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center rounded-2xl bg-white/50 pt-24 backdrop-blur-[1px]">
              <span className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                <Loader2 size={13} className="animate-spin" /> Mise à jour…
              </span>
            </div>
          )}
        </div>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}

// ─── États vide / chargement ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="hx-rise relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
          <MapPin size={22} />
        </div>
        <div className="text-base font-semibold text-slate-900">Tapez une ville pour commencer</div>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          On regarde les températures des 7 derniers jours et des 15 prochains, puis on vous donne la date à laquelle
          allumer ou arrêter le chauffage, avec le détail du calcul jour par jour.
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="h-[260px] animate-pulse rounded-2xl bg-slate-800/90" />
        <div className="h-[260px] animate-pulse rounded-2xl bg-white" />
      </div>
      <div className="h-[540px] animate-pulse rounded-2xl bg-white" />
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

  // Échelle des jauges du panneau de calcul.
  const scale = useMemo<[number, number]>(() => {
    const v = evals.map((e) => e.day.tMean).concat([t.start, t.stop, t.startForecastMax, t.stopForecastMin]);
    return [Math.floor(Math.min(...v) - 2), Math.ceil(Math.max(...v) + 2)];
  }, [evals, t]);

  if (evals.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Pas de température disponible pour cette ville.
      </div>
    );
  }

  const color = primary === "start" ? HX.start : HX.stop;
  const verb = primary === "start" ? "Allumer" : "Arrêter";
  let sub: string;
  if (!next) {
    sub =
      primary === "start"
        ? "Sur les 15 prochains jours, il ne fait pas assez froid assez longtemps pour allumer."
        : "Sur les 15 prochains jours, il ne fait pas assez doux assez longtemps pour arrêter.";
  } else if (nextIn! <= 0) {
    sub = "Les deux conditions sont réunies dès aujourd'hui.";
  } else if (isTrend) {
    sub = `Dans ${nextIn} jours. Date indicative : au-delà de 7 jours, la prévision n'est qu'une tendance.`;
  } else {
    sub = `Dans ${nextIn} jour${nextIn! > 1 ? "s" : ""}, d'après la prévision.`;
  }

  const fmtShort = (iso: string | null) => (!iso ? "–" : iso === today ? "Aujourd'hui" : fmtHeatingDate(iso));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Verdict */}
        <div className="hx-rise relative overflow-hidden rounded-2xl bg-[#0B1120] p-5 text-white">
          <div
            className="hx-breathe pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: next ? color : "#64748B", opacity: 0.6 }}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
              <MapPin size={12} />
              <span className="truncate">
                {placeLabel(place)} · {building.label}
                {building.school && zone && <> · {zone}</>}
              </span>
            </div>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {next && nextIn! <= 0 ? (
                  <div className="hx-date text-[28px] font-semibold leading-tight tracking-tight">
                    Il est temps{" "}
                    <span style={{ color }}>{primary === "start" ? "d'allumer" : "d'arrêter"}</span>
                  </div>
                ) : next ? (
                  <div className="hx-date text-[28px] font-semibold leading-tight tracking-tight">
                    <span style={{ color }}>{verb}</span> le
                    <br />
                    <span className="first-letter:uppercase inline-block">{fmtLongDate(next.date)}</span>
                  </div>
                ) : (
                  <div className="hx-date text-[26px] font-semibold leading-tight tracking-tight text-slate-100">
                    Pas {primary === "start" ? "d'allumage" : "d'arrêt"} à prévoir
                  </div>
                )}
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{sub}</p>
              </div>

              {next && (
                <div className="hx-pop shrink-0 text-right" style={{ animationDelay: "250ms" }}>
                  <div className="font-mono text-[40px] font-medium leading-none tabular-nums" style={{ color }}>
                    {nextIn! <= 0 ? "J" : `J−${nextIn}`}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {isTrend ? "tendance" : nextIn! <= 0 ? "aujourd'hui" : "fiable"}
                  </div>
                </div>
              )}
            </div>

            {(note || shifted) && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-[12.5px] leading-snug text-emerald-200">
                <CalendarDays size={14} className="mt-0.5 shrink-0" />
                <span>
                  {shifted && <>La météo seule donnerait le {fmtLongDate(shifted)}. </>}
                  {note ? `${note}.` : null}
                </span>
              </div>
            )}

            <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 pt-px sm:grid-cols-4" style={{ marginTop: "1.25rem" }}>
              {[
                { label: "Allumage", value: fmtShort(startDate), icon: <Flame size={11} style={{ color: HX.start }} /> },
                { label: "Arrêt", value: fmtShort(stopDate), icon: <Snowflake size={11} style={{ color: HX.stop }} /> },
                { label: "Moy. 5 derniers j", value: fmtDeg(weather.observedMean5d), icon: null },
                { label: "Moy. 7 prochains j", value: fmtDeg(weather.forecastMean7d), icon: null },
              ].map((k) => (
                <div key={k.label} className="bg-[#0B1120] px-3 py-2">
                  <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.1em] text-slate-500">
                    {k.icon}
                    {k.label}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[13px] font-medium tabular-nums text-slate-100 first-letter:uppercase">
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calcul du jour sélectionné */}
        <div className="hx-rise rounded-2xl border border-slate-200 bg-white p-4" style={{ animationDelay: "80ms" }}>
          <HeatingCalcPanel
            e={focus !== null ? evals[focus] : null}
            days={evals}
            thresholds={t}
            primary={primary}
            todayIso={today}
            scale={scale}
          />
        </div>
      </div>

      {/* Frise 22 jours + tableau aligné */}
      <div className="hx-rise rounded-2xl border border-slate-200 bg-white p-4" style={{ animationDelay: "160ms" }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <div className="text-[15px] font-semibold text-slate-900">7 jours passés, 15 jours de prévision</div>
            <div className="text-[12px] text-slate-500">Survolez un jour pour voir son calcul, cliquez pour le garder.</div>
          </div>
          <Legend t={t} holidays={holidays.length > 0} />
        </div>
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
      </div>

      <p className="text-[12px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-700">{building.label}.</span> Allumage le premier jour où la moyenne des
        5 jours d&apos;avant passe sous {t.start}° et où les 7 jours suivants restent sous {t.startForecastMax}° en moyenne.
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="h-3.5 w-2 rounded-full bg-gradient-to-b from-orange-500 via-yellow-400 to-sky-500" />
        min → max du jour
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="22" height="10" aria-hidden>
          <line x1="1" y1="5" x2="21" y2="5" stroke={HX.ink} strokeWidth="2" />
          <circle cx="11" cy="5" r="3" fill="#fff" stroke={HX.ink} strokeWidth="1.6" />
        </svg>
        moyenne
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <line x1="0" y1="2" x2="20" y2="2" stroke={HX.start} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
        allumage {t.start}°
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="4" aria-hidden>
          <line x1="0" y1="2" x2="20" y2="2" stroke={HX.stop} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
        arrêt {t.stop}°
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-sm" style={{ background: HX.window, opacity: 0.25 }} />
        fenêtres du calcul
      </span>
      {holidays && (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm" style={{ background: HX.holiday, opacity: 0.25 }} />
          vacances
        </span>
      )}
    </div>
  );
}
