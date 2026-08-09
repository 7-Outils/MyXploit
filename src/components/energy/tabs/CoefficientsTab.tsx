"use client";

/**
 * Onglet "Coefficients" — coefficient de conversion gaz (PCS, kWh/m³) par site.
 * --------------------------------------------------------------------------
 * Le coefficient vit sur ContractSite.coefficientPCS (défaut 10,5). L'import AE
 * ne le renseigne pas → tous les sites importés sont au défaut. Cet écran liste
 * les sites gaz du contrat et permet d'appliquer un coef, avec deux presets de
 * pression (20 mbar / 300 mbar) éditables, en un clic par site ou en masse.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, Check, Search, Info } from "lucide-react";

interface ContractSiteInfo {
  id: string;
  coefficientPCS: number | null;
  coefficientQ: number | null;
}

interface SiteRow {
  id: string;
  name: string;
  energyType: string;
  contractSites?: ContractSiteInfo[];
}

const PRESET_STORE = "myxploit-gas-presets";
const DEFAULT_PRESETS = { p20: 11.0, p300: 14.0 };
// Coef par défaut du schéma : un site à cette valeur (ou null) est considéré
// "à définir" car l'AE ne renseigne jamais le PCS.
const SCHEMA_DEFAULT = 10.5;

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 3 });

function loadPresets(): { p20: number; p300: number } {
  try {
    const raw = localStorage.getItem(PRESET_STORE);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.p20 === "number" && typeof p.p300 === "number") return p;
    }
  } catch {
    /* localStorage indispo → defaults */
  }
  return { ...DEFAULT_PRESETS };
}

export function CoefficientsContent({ contractId }: { contractId: string | null }) {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const persistPresets = (next: { p20: number; p300: number }) => {
    setPresets(next);
    try {
      localStorage.setItem(PRESET_STORE, JSON.stringify(next));
    } catch {
      /* tant pis */
    }
  };

  const fetchData = useCallback(async () => {
    if (!contractId) {
      setSites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sites`);
      const data = await res.json();
      setSites(Array.isArray(data) ? data : []);
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const coefOf = (s: SiteRow): number | null => s.contractSites?.[0]?.coefficientPCS ?? null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites
      .filter((s) => (showAll ? true : s.energyType === "GAZ"))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [sites, search, showAll]);

  const gasCount = useMemo(() => sites.filter((s) => s.energyType === "GAZ").length, [sites]);
  const toDefineCount = useMemo(
    () =>
      sites
        .filter((s) => s.energyType === "GAZ")
        .filter((s) => {
          const c = coefOf(s);
          return c == null || c === SCHEMA_DEFAULT;
        }).length,
    [sites]
  );

  // Sauvegarde le coef d'un site (envoi partiel : ne touche qu'à coefficientPCS).
  const saveCoef = async (site: SiteRow, value: number) => {
    if (!contractId) return false;
    setSavingId(site.id);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sites/${site.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coefficientPCS: value }),
      });
      if (!res.ok) throw new Error();
      // Maj optimiste locale
      setSites((prev) =>
        prev.map((s) =>
          s.id === site.id && s.contractSites?.[0]
            ? { ...s, contractSites: [{ ...s.contractSites[0], coefficientPCS: value }] }
            : s
        )
      );
      return true;
    } catch {
      alert(`Échec de l'enregistrement pour ${site.name}`);
      return false;
    } finally {
      setSavingId(null);
    }
  };

  // Applique un preset à toutes les lignes affichées (option : seulement les non définis).
  const applyToAll = async (value: number, onlyUndefined: boolean) => {
    const targets = rows.filter((s) => {
      if (!onlyUndefined) return true;
      const c = coefOf(s);
      return c == null || c === SCHEMA_DEFAULT;
    });
    if (targets.length === 0) return;
    if (
      !confirm(
        `Appliquer ${fmt(value)} kWh/m³ à ${targets.length} site(s)${onlyUndefined ? " non défini(s)" : " affiché(s)"} ?`
      )
    )
      return;
    setBulkRunning(true);
    let ok = 0;
    for (const s of targets) {
      if (!contractId) break;
      try {
        const res = await fetch(`/api/contracts/${contractId}/sites/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coefficientPCS: value }),
        });
        if (res.ok) ok++;
      } catch {
        /* on continue */
      }
    }
    setBulkRunning(false);
    await fetchData();
    alert(`${ok}/${targets.length} site(s) mis à jour.`);
  };

  if (!contractId) {
    return <p className="py-8 text-center text-sm text-ink/50">Sélectionne un contrat.</p>;
  }

  if (loading && sites.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bandeau presets + explication */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-ink">
            <Gauge size={16} className="text-ink/40" />
            <span className="label-tech">Presets de pression</span>
          </div>
          <PresetInput
            label="20 mbar (BP)"
            value={presets.p20}
            onChange={(v) => persistPresets({ ...presets, p20: v })}
          />
          <PresetInput
            label="300 mbar (MP)"
            value={presets.p300}
            onChange={(v) => persistPresets({ ...presets, p300: v })}
          />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkRunning}
              onClick={() => applyToAll(presets.p20, true)}
              className="border border-ink/20 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              20 mbar → non définis
            </button>
            <button
              type="button"
              disabled={bulkRunning}
              onClick={() => applyToAll(presets.p300, true)}
              className="border border-ink/20 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              300 mbar → non définis
            </button>
            {bulkRunning && <Loader2 size={16} className="animate-spin text-accent" />}
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink/50">
          <Info size={13} className="mt-0.5 flex-shrink-0 text-ink/40" />
          L&apos;import d&apos;AE ne renseigne pas le coefficient gaz : les sites importés restent au défaut {fmt(SCHEMA_DEFAULT)}.
          Choisis un preset selon la pression de livraison du compteur (20 mbar basse pression / 300 mbar moyenne pression).
          Les presets sont éditables et mémorisés sur ce navigateur.
        </p>
      </div>

      {/* Barre outils tableau */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
          <span className="font-semibold tabular-nums text-ink">{rows.length}</span> site{rows.length > 1 ? "s" : ""}
          {!showAll && ` gaz`} ·{" "}
          <span className={toDefineCount > 0 ? "tabular-nums text-amber-600" : "tabular-nums"}>
            {toDefineCount} à définir
          </span>{" "}
          / <span className="tabular-nums">{gasCount}</span> gaz
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink/60">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="border-ink/30 text-accent focus:ring-0"
            />
            Inclure les sites non-gaz
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 border border-ink/20 bg-white py-2 pl-9 pr-3 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-ink/10">
            <tr>
              <th className="label-tech px-3 py-2 font-normal text-left w-10">#</th>
              <th className="label-tech px-3 py-2 font-normal text-left">Site</th>
              <th className="label-tech px-3 py-2 font-normal text-left">Énergie</th>
              <th className="label-tech px-3 py-2 font-normal text-right">Coef actuel</th>
              <th className="label-tech px-3 py-2 font-normal text-left">État</th>
              <th className="label-tech px-3 py-2 font-normal text-right">Appliquer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/[0.06]">
            {rows.map((s, i) => {
              const coef = coefOf(s);
              const isSaving = savingId === s.id;
              return (
                <tr key={s.id} className="hover:bg-ink/[0.02]">
                  <td className="px-3 py-2 font-mono tabular-nums text-ink/30">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-ink/50">{s.energyType}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-ink">
                    {fmt(coef)} <span className="text-[10px] font-normal text-ink/40">kWh/m³</span>
                  </td>
                  <td className="px-3 py-2">
                    <CoefBadge coef={coef} p20={presets.p20} p300={presets.p300} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {isSaving ? (
                        <Loader2 size={15} className="animate-spin text-accent" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => saveCoef(s, presets.p20)}
                            title={`Appliquer 20 mbar (${fmt(presets.p20)})`}
                            className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                              coef === presets.p20
                                ? "border-accent bg-accent text-paper"
                                : "border-ink/20 text-ink hover:border-accent hover:text-accent"
                            }`}
                          >
                            20
                          </button>
                          <button
                            type="button"
                            onClick={() => saveCoef(s, presets.p300)}
                            title={`Appliquer 300 mbar (${fmt(presets.p300)})`}
                            className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                              coef === presets.p300
                                ? "border-accent bg-accent text-paper"
                                : "border-ink/20 text-ink hover:border-accent hover:text-accent"
                            }`}
                          >
                            300
                          </button>
                          <ManualCoef current={coef} onSave={(v) => saveCoef(s, v)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink/50">
                  Aucun site {showAll ? "" : "gaz "}sur ce contrat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function PresetInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label-tech mb-1 block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          min="0"
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          className="w-20 border border-ink/20 bg-white px-2 py-1.5 font-mono text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
        />
        <span className="text-[10px] text-ink/40">kWh/m³</span>
      </div>
    </div>
  );
}

function CoefBadge({ coef, p20, p300 }: { coef: number | null; p20: number; p300: number }) {
  const base = "inline-block font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 border";
  if (coef == null) {
    return <span className={`${base} border-amber-600/20 bg-amber-50 text-amber-700`}>non renseigné</span>;
  }
  if (coef === p20) {
    return <span className={`${base} border-accent/25 bg-accent/5 text-accent`}>20 mbar</span>;
  }
  if (coef === p300) {
    return <span className={`${base} border-accent/25 bg-accent/5 text-accent`}>300 mbar</span>;
  }
  if (coef === SCHEMA_DEFAULT) {
    return <span className={`${base} border-amber-600/20 bg-amber-50 text-amber-700`}>défaut {fmt(SCHEMA_DEFAULT)}</span>;
  }
  return <span className={`${base} border-ink/15 bg-ink/[0.04] text-ink/60`}>personnalisé</span>;
}

function ManualCoef({ current, onSave }: { current: number | null; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(current != null ? String(current) : "");
          setEditing(true);
        }}
        title="Saisir une valeur manuelle"
        className="border border-ink/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-ink/50 transition-colors hover:border-accent hover:text-accent"
      >
        …
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.1"
        min="0"
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = parseFloat(val);
            if (!isNaN(v)) onSave(v);
            setEditing(false);
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="w-20 border border-ink/20 bg-white px-2 py-1 font-mono text-xs tabular-nums text-ink focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        title="Enregistrer"
        onClick={() => {
          const v = parseFloat(val);
          if (!isNaN(v)) onSave(v);
          setEditing(false);
        }}
        className="p-1 text-accent transition-colors hover:bg-accent/5"
      >
        <Check size={14} />
      </button>
    </div>
  );
}
