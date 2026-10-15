"use client";

/**
 * Outil « Contrôle des relevés » : pour le contrat sélectionné, les sites qui
 * ont à la fois des relevés exploitant et de la télérelève ; pour un site,
 * chaque relevé exploitant face à la télérelève sur les mêmes dates.
 * Page à part : ne touche à aucun calcul énergie existant.
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, Scale } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useContract } from "@/contexts/ContractContext";
import { cn } from "@/lib/utils";
import { DIAGNOSTIC_LABELS, ECART_SEUIL_PCT, type ControlRow, type ControlSummary, type Diagnostic } from "@/lib/releves-controle";

interface SiteEntry {
  site: { id: string; name: string; city: string | null };
  energyType: string;
  summary: ControlSummary;
  rows?: ControlRow[];
}
interface Resp {
  sites: SiteEntry[];
  sitesInContract: number;
}

const ENERGY: Record<string, string> = { GAZ: "Gaz", ELECTRICITE: "Électricité", FIOUL: "Fioul", BOIS: "Bois", RESEAU_CHALEUR: "Réseau", EAU: "Eau", AUTRE: "Autre" };

const TONE: Record<Diagnostic, string> = {
  ok: "text-ink/50",
  a_verifier: "text-red-700",
  compteur_recule: "text-red-700",
  compteur_remplace: "text-ink",
  unite: "text-red-700",
  releve_manquant: "text-red-700",
  telereleve_incomplete: "text-ink/40",
  coefficient: "text-accent",
};

const d = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const n = (v: number) => v.toLocaleString("fr-FR");
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR")} %`);

export default function RelevesControlPage() {
  const { selectedContract, isLoading } = useContract();
  const cid = selectedContract?.id;
  const { data: list, isLoading: loadingList } = useSWR<Resp>(cid ? `/api/consumptions/controle?contractId=${cid}` : null, fetcher);
  const entries = useMemo(() => (Array.isArray(list?.sites) ? list.sites : []), [list]);

  const [selected, setSelected] = useState<string | null>(null); // `${siteId}|${energyType}`
  useEffect(() => setSelected(null), [cid]);
  useEffect(() => {
    if (!selected && entries.length > 0) setSelected(`${entries[0].site.id}|${entries[0].energyType}`);
  }, [entries, selected]);
  const [selSite, selEnergy] = (selected ?? "|").split("|");
  const { data: detail, isLoading: loadingDetail } = useSWR<Resp>(
    cid && selSite ? `/api/consumptions/controle?contractId=${cid}&siteId=${selSite}` : null,
    fetcher
  );
  const current = useMemo(() => detail?.sites?.find((s) => s.site.id === selSite && s.energyType === selEnergy) ?? null, [detail, selSite, selEnergy]);
  const rows = useMemo(() => (Array.isArray(current?.rows) ? current.rows : []), [current]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ink/30" />
      </div>
    );
  }
  if (!selectedContract) {
    return <div className="panel p-10 text-center text-sm text-ink/50">Sélectionne un contrat.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-ink/40" />
        <h1 className="text-xl font-semibold text-ink">Contrôle des relevés</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sites avec les deux sources */}
        <section className="panel">
          <div className="panel-header">
            <span className="label-tech">
              Sites <span className="tabular-nums">({entries.length}/{list?.sitesInContract ?? 0})</span>
            </span>
          </div>
          {loadingList && !list ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-ink/30" /></div>
          ) : entries.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink/40">Aucun site avec relevés exploitant et télérelève.</p>
          ) : (
            <div className="divide-y divide-ink/10">
              {entries.map((e) => {
                const key = `${e.site.id}|${e.energyType}`;
                const on = key === selected;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn("flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors", on ? "border-l-accent bg-accent/5" : "border-l-transparent hover:bg-ink/[0.02]")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium", on ? "text-accent" : "text-ink")}>{e.site.name}</span>
                      <span className="block font-mono text-[11px] text-ink/45">
                        {ENERGY[e.energyType] ?? e.energyType} · {e.summary.readings} relevé{e.summary.readings > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className={cn("font-mono text-xs tabular-nums", e.summary.anomalies > 0 ? "text-red-700" : "text-ink/30")}>
                      {e.summary.anomalies > 0 ? `${e.summary.anomalies} à voir` : "ok"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Détail relevé par relevé */}
        <section className="panel min-w-0">
          {!current ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-ink/40">
              {loadingDetail ? <Loader2 className="h-5 w-5 animate-spin text-ink/30" /> : "Sélectionne un site."}
            </div>
          ) : (
            <>
              <div className="panel-header">
                <span className="label-tech">
                  {current.site.name} · {ENERGY[current.energyType] ?? current.energyType}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink/60">
                  {n(current.summary.totalExploitant)} <span className="text-ink/35">exploitant</span> · {n(current.summary.totalTelereleve)}{" "}
                  <span className="text-ink/35">télérelève</span> ·{" "}
                  <span className={cn(current.summary.totalEcartPct !== null && Math.abs(current.summary.totalEcartPct) > ECART_SEUIL_PCT ? "text-red-700" : "text-ink")}>
                    {pct(current.summary.totalEcartPct)}
                  </span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink/10 text-left">
                      <th className="label-tech px-4 py-2.5">Relevé</th>
                      <th className="label-tech px-4 py-2.5 text-right">Jours</th>
                      <th className="label-tech px-4 py-2.5 text-right">Exploitant</th>
                      <th className="label-tech px-4 py-2.5 text-right">Télérelève</th>
                      <th className="label-tech px-4 py-2.5 text-right">Écart</th>
                      <th className="label-tech px-4 py-2.5 text-right">%</th>
                      <th className="label-tech px-4 py-2.5">Diagnostic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {rows.map((r) => (
                      <tr key={r.start} className="hover:bg-ink/[0.02]">
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-ink">
                          {d(r.start)} → {d(r.end)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink/50">{r.days}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-ink">{n(r.exploitant)}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-ink">
                          {n(r.telereleve)}
                          {r.coverage < 1 && <span className="ml-1 text-[10px] text-ink/35">{Math.round(r.coverage * 100)} %</span>}
                        </td>
                        <td className={cn("px-4 py-2 text-right font-mono text-sm tabular-nums", r.ecart === 0 ? "text-ink/30" : "text-ink")}>
                          {r.ecart > 0 ? "+" : ""}{n(r.ecart)}
                        </td>
                        <td className={cn("px-4 py-2 text-right font-mono text-sm tabular-nums", r.ecartPct !== null && Math.abs(r.ecartPct) > ECART_SEUIL_PCT ? "text-red-700" : "text-ink/60")}>
                          {pct(r.ecartPct)}
                        </td>
                        <td className={cn("px-4 py-2 text-sm", TONE[r.diagnostic])}>{DIAGNOSTIC_LABELS[r.diagnostic]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-ink/10 px-4 py-2">
                <span className="label-tech">
                  <span className="tabular-nums">{current.summary.compared}</span> relevé{current.summary.compared > 1 ? "s" : ""} comparé{current.summary.compared > 1 ? "s" : ""} · seuil {ECART_SEUIL_PCT} % · kWh
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
