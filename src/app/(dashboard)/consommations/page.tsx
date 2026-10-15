"use client";

/**
 * Consommations : une seule série mensuelle, quatre lectures.
 *  - Suivi mensuel (la courbe, N−1 en superposition)
 *  - Bilan de la période (totaux, par énergie, par site, à climat comparable via kWh/DJU)
 *  - Performance de la saison (NC contre N'B), seulement quand la période est une saison de chauffe
 *  - Historique par année civile, indépendant de la période
 * Page à part : lit les données, ne modifie aucun calcul existant.
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";
import { dateToSeason } from "@/lib/heating-season";

type Mode = "saison" | "annee" | "libre";
interface Pt { month: string; total: number; chauffage: number; ecs: number; cost: number; dju: number | null }
interface Totals { total: number; chauffage: number; ecs: number; cost: number; dju: number | null }
interface Series {
  months: Pt[];
  previousMonths: Pt[];
  totals: Totals;
  previousTotals: Totals;
  bySite: Array<{ site: { id: string; name: string }; total: number; chauffage: number; ecs: number; cost: number; dju: number | null }>;
  byEnergy: Array<{ energyType: string; total: number; chauffage: number; ecs: number; cost: number }>;
  history: Array<{ year: string; total: number; chauffage: number; ecs: number; cost: number; dju: number | null }>;
  sites: Array<{ id: string; name: string }>;
  stations: number;
}
interface Perf {
  summary: { totalSites: number; sitesIncomplets: number; totalNc: number; totalNbPrime: number; totalDelta: number; deltaPercent: number; status: string };
}

const ENERGY: Record<string, string> = { GAZ: "Gaz", ELECTRICITE: "Électricité", FIOUL: "Fioul", BOIS: "Bois", RESEAU_CHALEUR: "Réseau de chaleur", AUTRE: "Autre" };
const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const kwh = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("fr-FR"));
const mwh = (v: number | null | undefined) => (v == null ? "—" : (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }));
const eur = (v: number | null | undefined) => (v == null || v === 0 ? "—" : `${Math.round(v).toLocaleString("fr-FR")} €`);
const delta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);
const Delta = ({ v }: { v: number | null }) =>
  v === null ? <span className="text-ink/25">—</span> : <span className={cn("font-mono text-xs tabular-nums", v > 0 ? "text-red-700" : v < 0 ? "text-green-700" : "text-ink/50")}>{v > 0 ? "+" : ""}{v.toLocaleString("fr-FR")} %</span>;

function seasonBounds(key: string) {
  const y = parseInt(key.slice(0, 4), 10);
  return { from: new Date(y, 6, 1), to: new Date(y + 1, 5, 30) };
}

export default function ConsommationsPage() {
  const { selectedContract, isLoading } = useContract();
  const cid = selectedContract?.id;
  const today = useMemo(() => new Date(), []);
  const currentSeason = dateToSeason(today);

  const [mode, setMode] = useState<Mode>("saison");
  const [season, setSeason] = useState(currentSeason);
  const [year, setYear] = useState(String(today.getFullYear()));
  const [free, setFree] = useState({ from: iso(new Date(today.getFullYear() - 1, today.getMonth(), 1)), to: iso(today) });
  const [siteId, setSiteId] = useState("");
  useEffect(() => setSiteId(""), [cid]);

  const window = useMemo(() => {
    if (mode === "saison") { const b = seasonBounds(season); return { from: iso(b.from), to: iso(b.to) }; }
    if (mode === "annee") return { from: `${year}-01-01`, to: `${year}-12-31` };
    return free;
  }, [mode, season, year, free]);

  const url = cid ? `/api/consumptions/series?contractId=${cid}&from=${window.from}&to=${window.to}${siteId ? `&siteId=${siteId}` : ""}` : null;
  const { data, error, isLoading: loading } = useSWR<Series>(url, fetcher, { keepPreviousData: true });
  const perfUrl = cid && mode === "saison" ? `/api/consumptions/analytics?contractId=${cid}&year=${parseInt(season.slice(0, 4), 10) + 1}&yearType=HEATING_SEASON${siteId ? `&siteId=${siteId}` : ""}` : null;
  const { data: perf } = useSWR<Perf>(perfUrl, fetcher, { keepPreviousData: true });

  const seasons = useMemo(() => {
    const first = selectedContract?.startDate ? new Date(selectedContract.startDate) : new Date(today.getFullYear() - 5, 6, 1);
    const out: string[] = [];
    for (let y = parseInt(currentSeason.slice(0, 4), 10); y >= first.getFullYear() - 1; y--) out.push(`${y}-${y + 1}`);
    return out;
  }, [selectedContract, currentSeason, today]);
  const years = useMemo(() => (data?.history ?? []).map((h) => h.year).reverse(), [data]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-ink/30" /></div>;
  if (!selectedContract) return <div className="panel p-10 text-center text-sm text-ink/50">Sélectionne un contrat.</div>;

  const t = data?.totals;
  const p = data?.previousTotals;
  const perDju = (x?: Totals) => (x && x.dju ? x.chauffage / x.dju : null);
  const max = Math.max(1, ...(data?.months ?? []).map((m) => m.total), ...(data?.previousMonths ?? []).map((m) => m.total));
  const label = mode === "saison" ? `Saison ${season.replace("-", "/")}` : mode === "annee" ? `Année ${year}` : `${new Date(free.from).toLocaleDateString("fr-FR")} → ${new Date(free.to).toLocaleDateString("fr-FR")}`;

  return (
    <div className="space-y-4">
      {/* Période + site */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-xl font-semibold text-ink">Consommations</h1>
        <div className="flex">
          {(["saison", "annee", "libre"] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-9 border px-3 text-sm transition-colors -ml-px first:ml-0", mode === m ? "border-accent bg-accent/5 text-accent" : "border-ink/20 bg-white text-ink/60 hover:text-ink")}>
              {m === "saison" ? "Saison de chauffe" : m === "annee" ? "Année civile" : "Plage libre"}
            </button>
          ))}
        </div>
        {mode === "saison" && (
          <select value={season} onChange={(e) => setSeason(e.target.value)} className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm">
            {seasons.map((s) => <option key={s} value={s}>{s.replace("-", "/")}</option>)}
          </select>
        )}
        {mode === "annee" && (
          <select value={year} onChange={(e) => setYear(e.target.value)} className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm">
            {(years.length ? years : [String(today.getFullYear())]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {mode === "libre" && (
          <span className="flex items-center gap-1">
            <input type="date" value={free.from} onChange={(e) => setFree({ ...free, from: e.target.value })} className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm" />
            <span className="text-ink/40">→</span>
            <input type="date" value={free.to} onChange={(e) => setFree({ ...free, to: e.target.value })} className="h-9 border border-ink/20 bg-white px-2 font-mono text-sm" />
          </span>
        )}
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="h-9 max-w-[260px] border border-ink/20 bg-white px-2 text-sm">
          <option value="">Tous les sites</option>
          {(data?.sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {loading && <Loader2 size={14} className="animate-spin text-ink/40" />}
      </div>

      {error && <div className="panel p-6 text-sm text-red-700">Impossible de charger la série.</div>}

      {/* Bilan : chiffres nus, N−1 dessous */}
      {t && p && (
        <div className="grid grid-cols-2 border border-ink/10 bg-white md:grid-cols-6">
          {[
            ["Consommation", `${mwh(t.total)} MWh`, delta(t.total, p.total)],
            ["Chauffage", `${mwh(t.chauffage)} MWh`, delta(t.chauffage, p.chauffage)],
            ["ECS", `${mwh(t.ecs)} MWh`, delta(t.ecs, p.ecs)],
            ["DJU", t.dju == null ? "—" : kwh(t.dju), t.dju != null && p.dju != null ? delta(t.dju, p.dju) : null],
            ["kWh chauffage / DJU", perDju(t) == null ? "—" : perDju(t)!.toLocaleString("fr-FR", { maximumFractionDigits: 1 }), perDju(t) != null && perDju(p) != null ? delta(perDju(t)!, perDju(p)!) : null],
            ["Coût", eur(t.cost), t.cost && p.cost ? delta(t.cost, p.cost) : null],
          ].map(([l, v, d], i) => (
            <div key={l as string} className={cn("px-4 py-3", i > 0 && "border-l border-ink/10")}>
              <div className="label-tech">{l as string}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">{v as string}</div>
              <div className="mt-0.5"><Delta v={d as number | null} /> <span className="text-[11px] text-ink/35">vs N−1</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Suivi mensuel */}
        <section className="panel">
          <div className="panel-header"><span className="label-tech">Suivi mensuel · {label}</span><span className="label-tech">N−1 en gris</span></div>
          <div className="px-4 pb-3 pt-4">
            {(data?.months ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-ink/40">Aucune consommation sur la période.</p>
            ) : (
              <div className="grid items-end gap-1" style={{ gridTemplateColumns: `repeat(${data!.months.length}, minmax(0,1fr))`, height: 180 }}>
                {data!.months.map((m, i) => {
                  const prev = data!.previousMonths[i];
                  return (
                    <div key={m.month} className="flex h-full items-end justify-center gap-px" title={`${m.month} · ${kwh(m.total)} kWh${prev ? ` · N−1 ${kwh(prev.total)} kWh` : ""}${m.dju != null ? ` · ${m.dju} DJU` : ""}`}>
                      <div className="w-[40%] bg-ink/15" style={{ height: `${((prev?.total ?? 0) / max) * 100}%` }} />
                      <div className="w-[40%]" style={{ height: `${(m.total / max) * 100}%`, background: "#2563eb" }} />
                    </div>
                  );
                })}
              </div>
            )}
            {(data?.months ?? []).length > 0 && (
              <div className="mt-1 grid gap-1 border-t border-ink/10 pt-1" style={{ gridTemplateColumns: `repeat(${data!.months.length}, minmax(0,1fr))` }}>
                {data!.months.map((m) => (
                  <div key={m.month} className="text-center font-mono text-[10px] uppercase text-ink/40">{MONTHS[parseInt(m.month.slice(5), 10) - 1]}</div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Performance de la saison, seulement en mode saison */}
        <section className="panel">
          <div className="panel-header"><span className="label-tech">Performance · NC contre N&apos;B</span></div>
          {mode !== "saison" ? (
            <p className="px-4 py-10 text-center text-sm text-ink/40">La performance se lit sur une saison de chauffe.</p>
          ) : !perf?.summary ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-ink/30" /></div>
          ) : (
            <div className="grid grid-cols-3 divide-x divide-ink/10">
              {[
                ["NC chauffage", `${mwh(perf.summary.totalNc)} MWh`],
                ["N'B", `${mwh(perf.summary.totalNbPrime)} MWh`],
                ["Écart", `${perf.summary.deltaPercent > 0 ? "+" : ""}${perf.summary.deltaPercent.toLocaleString("fr-FR")} %`],
              ].map(([l, v], i) => (
                <div key={l} className="px-4 py-3">
                  <div className="label-tech">{l}</div>
                  <div className={cn("mt-1 font-mono text-xl font-semibold tabular-nums", i === 2 ? (perf.summary.deltaPercent > 5 ? "text-red-700" : perf.summary.deltaPercent < -5 ? "text-green-700" : "text-ink") : "text-ink")}>{v}</div>
                </div>
              ))}
              <div className="col-span-3 border-t border-ink/10 px-4 py-2">
                <span className="label-tech">
                  <span className="tabular-nums">{perf.summary.totalSites}</span> site{perf.summary.totalSites > 1 ? "s" : ""} comparable{perf.summary.totalSites > 1 ? "s" : ""}
                  {perf.summary.sitesIncomplets > 0 && <> · <span className="tabular-nums">{perf.summary.sitesIncomplets}</span> incomplet{perf.summary.sitesIncomplets > 1 ? "s" : ""}</>}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Par site */}
        <section className="panel overflow-x-auto">
          <div className="panel-header"><span className="label-tech">Par site · {label}</span></div>
          <table className="w-full">
            <thead><tr className="border-b border-ink/10 text-left">
              <th className="label-tech px-4 py-2">Site</th><th className="label-tech px-3 py-2 text-right">MWh</th><th className="label-tech px-3 py-2 text-right">Chauffage</th><th className="label-tech px-3 py-2 text-right">ECS</th><th className="label-tech px-3 py-2 text-right">kWh/DJU</th><th className="label-tech px-3 py-2 text-right">Coût</th>
            </tr></thead>
            <tbody className="divide-y divide-ink/10">
              {(data?.bySite ?? []).filter((s) => s.total > 0).sort((a, b) => b.total - a.total).map((s) => (
                <tr key={s.site.id} className="hover:bg-ink/[0.02]">
                  <td className="truncate px-4 py-1.5 text-sm text-ink">{s.site.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-sm tabular-nums text-ink">{mwh(s.total)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{mwh(s.chauffage)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{mwh(s.ecs)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{s.dju ? (s.chauffage / s.dju).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{eur(s.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.byEnergy ?? []).length > 1 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-ink/10 px-4 py-2">
              {data!.byEnergy.map((e) => (
                <span key={e.energyType} className="font-mono text-xs tabular-nums text-ink/60">{ENERGY[e.energyType] ?? e.energyType} <span className="text-ink">{mwh(e.total)} MWh</span></span>
              ))}
            </div>
          )}
        </section>

        {/* Historique par année civile, indépendant de la période */}
        <section className="panel overflow-x-auto">
          <div className="panel-header"><span className="label-tech">Historique · années civiles</span></div>
          <table className="w-full">
            <thead><tr className="border-b border-ink/10 text-left">
              <th className="label-tech px-4 py-2">Année</th><th className="label-tech px-3 py-2 text-right">MWh</th><th className="label-tech px-3 py-2 text-right">Chauffage</th><th className="label-tech px-3 py-2 text-right">ECS</th><th className="label-tech px-3 py-2 text-right">DJU</th><th className="label-tech px-3 py-2 text-right">kWh/DJU</th><th className="label-tech px-3 py-2 text-right">Δ</th>
            </tr></thead>
            <tbody className="divide-y divide-ink/10">
              {(data?.history ?? []).slice().reverse().map((h, i, arr) => {
                const prev = arr[i + 1];
                return (
                  <tr key={h.year} className={cn("hover:bg-ink/[0.02]", h.year === String(today.getFullYear()) && "text-ink/50")}>
                    <td className="px-4 py-1.5 font-mono text-sm tabular-nums text-ink">{h.year}{h.year === String(today.getFullYear()) && <span className="ml-1 text-[10px] text-ink/35">en cours</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-sm tabular-nums text-ink">{mwh(h.total)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{mwh(h.chauffage)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{mwh(h.ecs)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{h.dju == null ? "—" : kwh(h.dju)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink/60">{h.dju ? (h.chauffage / h.dju).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}</td>
                    <td className="px-3 py-1.5 text-right"><Delta v={prev ? delta(h.total, prev.total) : null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
