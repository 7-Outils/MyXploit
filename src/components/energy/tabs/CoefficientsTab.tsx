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
    return <p className="text-sm text-text-secondary py-8 text-center">Sélectionne un contrat.</p>;
  }

  if (loading && sites.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bandeau presets + explication */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <div className="flex flex-wrap items-end gap-5">
          <div className="flex items-center gap-2 text-primary-dark">
            <Gauge size={18} className="text-accent" />
            <span className="font-semibold text-sm">Presets de pression</span>
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
              className="px-3 py-2 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
            >
              20 mbar → non définis
            </button>
            <button
              type="button"
              disabled={bulkRunning}
              onClick={() => applyToAll(presets.p300, true)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
            >
              300 mbar → non définis
            </button>
            {bulkRunning && <Loader2 size={16} className="animate-spin text-accent" />}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-3 flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          L&apos;import d&apos;AE ne renseigne pas le coefficient gaz : les sites importés restent au défaut {fmt(SCHEMA_DEFAULT)}.
          Choisis un preset selon la pression de livraison du compteur (20 mbar basse pression / 300 mbar moyenne pression).
          Les presets sont éditables et mémorisés sur ce navigateur.
        </p>
      </div>

      {/* Barre outils tableau */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-text-secondary">
          <span className="font-semibold text-primary-dark">{rows.length}</span> site{rows.length > 1 ? "s" : ""}
          {!showAll && ` gaz`} ·{" "}
          <span className={toDefineCount > 0 ? "text-amber-600 font-medium" : ""}>
            {toDefineCount} à définir
          </span>{" "}
          / {gasCount} gaz
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300 text-accent focus:ring-accent"
            />
            Inclure les sites non-gaz
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent w-56 bg-gray-50/50"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 text-left w-10">#</th>
              <th className="px-4 py-2.5 text-left">Site</th>
              <th className="px-4 py-2.5 text-left">Énergie</th>
              <th className="px-4 py-2.5 text-right">Coef actuel</th>
              <th className="px-4 py-2.5 text-left">État</th>
              <th className="px-4 py-2.5 text-right">Appliquer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((s, i) => {
              const coef = coefOf(s);
              const isSaving = savingId === s.id;
              return (
                <tr key={s.id} className="hover:bg-accent/5">
                  <td className="px-4 py-2.5 text-gray-300 tabular-nums">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-2.5 font-medium text-primary-dark">{s.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{s.energyType}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary-dark">
                    {fmt(coef)} <span className="text-[10px] text-gray-400 font-normal">kWh/m³</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <CoefBadge coef={coef} p20={presets.p20} p300={presets.p300} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {isSaving ? (
                        <Loader2 size={15} className="animate-spin text-accent" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => saveCoef(s, presets.p20)}
                            title={`Appliquer 20 mbar (${fmt(presets.p20)})`}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                              coef === presets.p20
                                ? "border-blue-300 bg-blue-100 text-blue-800"
                                : "border-gray-200 text-blue-700 hover:bg-blue-50"
                            }`}
                          >
                            20
                          </button>
                          <button
                            type="button"
                            onClick={() => saveCoef(s, presets.p300)}
                            title={`Appliquer 300 mbar (${fmt(presets.p300)})`}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                              coef === presets.p300
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-gray-200 text-amber-700 hover:bg-amber-50"
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
                <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
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
      <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">{label}</label>
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
          className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent tabular-nums"
        />
        <span className="text-[10px] text-gray-400">kWh/m³</span>
      </div>
    </div>
  );
}

function CoefBadge({ coef, p20, p300 }: { coef: number | null; p20: number; p300: number }) {
  if (coef == null) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">non renseigné</span>;
  }
  if (coef === p20) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">20 mbar</span>;
  }
  if (coef === p300) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">300 mbar</span>;
  }
  if (coef === SCHEMA_DEFAULT) {
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">défaut {fmt(SCHEMA_DEFAULT)}</span>;
  }
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">personnalisé</span>;
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
        className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
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
        className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-accent/20 focus:border-accent tabular-nums"
      />
      <button
        type="button"
        onClick={() => {
          const v = parseFloat(val);
          if (!isNaN(v)) onSave(v);
          setEditing(false);
        }}
        className="p-1 text-accent hover:bg-accent/10 rounded"
      >
        <Check size={14} />
      </button>
    </div>
  );
}
