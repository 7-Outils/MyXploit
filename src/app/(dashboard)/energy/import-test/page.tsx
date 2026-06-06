"use client";

/**
 * PAGE DE TEST — Import exploitant universel (v2)
 * ------------------------------------------------
 * Isolée de la vraie page Relevé. 100% côté navigateur, AUCUNE écriture en base.
 * Objectif : valider qu'un mapping universel (colonne → notion) + le moteur de
 * calcul existant marchent sur n'importe quelle trame (Idex, Veolia, ...).
 *
 * Flux : upload → détection ligne d'en-têtes → mapping colonnes (avec suggestions)
 *        → aperçu des lignes normalisées → aperçu des consommations mensuelles.
 *
 * Le calcul réutilise EXACTEMENT prorateAcrossMonths() du moteur de prod, donc
 * l'aperçu est fidèle au kWh près.
 */

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { prorateAcrossMonths, periodKeyToDate } from "@/lib/date-prorate";
import { useContract } from "@/contexts/ContractContext";
import { Upload, FileSpreadsheet, AlertTriangle, Info, Database, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Notions sémantiques universelles (indépendantes de l'exploitant)
// ---------------------------------------------------------------------------
type FieldKey =
  | "site"
  | "dateReleve"
  | "compteur"
  | "index"
  | "conso"
  | "fluide"
  | "unite";

const FIELDS: { key: FieldKey; label: string; required: boolean; hint: string }[] = [
  { key: "site", label: "Site", required: true, hint: "Nom de l'installation / site" },
  { key: "dateReleve", label: "Date de relevé", required: true, hint: "Date du relevé" },
  { key: "compteur", label: "Compteur", required: true, hint: "Nom / n° du compteur" },
  { key: "index", label: "Index relevé", required: false, hint: "Index du compteur (on calcule la conso par différence)" },
  { key: "conso", label: "Conso (si fournie)", required: false, hint: "Utilisée seulement si pas d'index" },
  { key: "fluide", label: "Fluide / Énergie", required: false, hint: "Aide à deviner GAZ / ECS / chaleur..." },
  { key: "unite", label: "Unité", required: false, hint: "m³, kWh, MWh, L..." },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const norm = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Détecte la ligne d'en-têtes : celle qui a le plus de cellules texte non vides
 *  parmi les ~15 premières, en privilégiant la présence de mots-clés métier. */
function detectHeaderRow(rows: unknown[][]): number {
  const KEYWORDS = ["date", "site", "installation", "compteur", "index", "conso", "fluide", "energie", "releve", "unit"];
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(15, rows.length);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i] ?? [];
    const textCells = cells.filter((c) => typeof c === "string" && c.trim().length > 0);
    const kwHits = textCells.filter((c) => KEYWORDS.some((k) => norm(c).includes(k))).length;
    const score = textCells.length + kwHits * 3;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Parse une valeur de cellule en Date (gère Date, série Excel, string fr "jj/mm/aaaa"). */
function parseCellDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // série Excel (jours depuis 1899-12-30)
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const day = +m[1];
    const month = +m[2] - 1;
    let year = +m[3];
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// Devine (energyType, usage, coef→kWh) — réplique la sémantique du projector.
function mapEnergy(
  compteur: string,
  fluide: string,
  pcs: number,
  qEcsMwh: number
): { energyType: string; usage: string; coef: number | null; outUnit: string } {
  const name = norm(compteur);
  const fl = norm(fluide);
  const txt = `${name} ${fl}`;
  const isEcs = /\becs\b|sanitaire|eau chaude/.test(txt);

  if (/chaleur|rcu|calorie|chauffage urbain/.test(txt))
    return { energyType: "RESEAU_CHALEUR", usage: "CHAUFFAGE", coef: 1, outUnit: "kWh" };
  if (/gaz|grdf|\bgn\b/.test(txt))
    return { energyType: "GAZ", usage: isEcs ? "ECS" : "CHAUFFAGE", coef: pcs, outUnit: "kWh" };
  if (/elec|enedis/.test(txt))
    return { energyType: "ELECTRICITE", usage: "MIXTE", coef: 1, outUnit: "kWh" };
  if (/fioul|fuel/.test(txt))
    return { energyType: "FIOUL", usage: "CHAUFFAGE", coef: 10, outUnit: "kWh" };
  if (isEcs)
    return { energyType: "EAU", usage: "ECS", coef: qEcsMwh * 1000, outUnit: "kWh" };
  if (/eau/.test(txt))
    return { energyType: "EAU", usage: "AUTRE", coef: null, outUnit: "m³" };
  return { energyType: "AUTRE", usage: "AUTRE", coef: null, outUnit: "?" };
}

// EnergyType/usage → MeterFluid (pour l'écriture en base).
function energyToFluid(energyType: string, usage: string): string {
  if (energyType === "RESEAU_CHALEUR") return "CHALEUR";
  if (energyType === "GAZ") return "GAZ";
  if (energyType === "ELECTRICITE") return "ELECTRICITE";
  if (energyType === "FIOUL") return "FIOUL";
  if (energyType === "EAU") return usage === "ECS" ? "EAU_CHAUDE" : "EAU_FROIDE";
  return "EAU_FROIDE";
}

// Suggestion auto d'une colonne pour un champ donné.
function suggestColumn(field: FieldKey, headers: string[], sample: unknown[][]): number {
  const h = headers.map(norm);
  const findBy = (re: RegExp) => h.findIndex((x) => re.test(x));
  switch (field) {
    case "site": {
      const i = findBy(/installation|site|adresse|batiment|lieu/);
      return i;
    }
    case "dateReleve": {
      let i = findBy(/date.*relev|relev.*date|^date/);
      if (i === -1) i = findBy(/date/);
      if (i === -1) {
        // colonne dont les valeurs ressemblent à des dates
        for (let c = 0; c < headers.length; c++) {
          const hits = sample.filter((r) => parseCellDate(r[c]) != null).length;
          if (hits >= Math.max(1, sample.length * 0.6)) return c;
        }
      }
      return i;
    }
    case "compteur":
      return findBy(/compteur|pdl|prm|pce|point.*livraison|^ref/);
    case "index":
      return findBy(/index|relev[ée]/);
    case "conso":
      return findBy(/conso/);
    case "fluide":
      return findBy(/fluide|energie|type/);
    case "unite":
      return findBy(/unit/);
    default:
      return -1;
  }
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------
type NormalizedRow = {
  site: string;
  date: Date | null;
  compteur: string;
  index: number | null;
  conso: number | null;
  fluide: string;
  unite: string;
};

export default function ImportTestPage() {
  const [fileName, setFileName] = useState<string>("");
  const [allRows, setAllRows] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({} as Record<FieldKey, number>);
  const [pcs, setPcs] = useState(10.5);
  const [qEcs, setQEcs] = useState(0.13);
  const [error, setError] = useState<string>("");

  // Écriture en base
  const { contracts, selectedContract } = useContract();
  const [targetContractId, setTargetContractId] = useState<string>("");
  const [importType, setImportType] = useState<"RELEVE_MENSUEL" | "ALLUMAGE" | "ARRET">("RELEVE_MENSUEL");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<
    | { error: string }
    | {
        imported: number;
        updated: number;
        skipped: number;
        metersCreated: number;
        sitesImpacted: number;
        resetsDetected: number;
        heatingPeriods: number;
        unmatchedSites: { name: string; count: number; suggestionId: string | null }[];
        contractSites: { id: string; name: string }[];
      }
    | null
  >(null);
  // Correspondances manuelles choisies pour les sites non reconnus : nomFichier → siteId
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});

  const dataRows = useMemo(() => allRows.slice(headerRow + 1).filter((r) => r.some((c) => c !== "" && c != null)), [allRows, headerRow]);

  const handleFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
        if (!rows.length) {
          setError("Fichier vide.");
          return;
        }
        const hr = detectHeaderRow(rows as unknown[][]);
        const hdrs = (rows[hr] as unknown[]).map((c) => String(c ?? "").trim());
        const body = (rows as unknown[][]).slice(hr + 1, hr + 9);
        const auto: Record<FieldKey, number> = {} as Record<FieldKey, number>;
        for (const f of FIELDS) auto[f.key] = suggestColumn(f.key, hdrs, body);
        setAllRows(rows as unknown[][]);
        setHeaderRow(hr);
        setHeaders(hdrs);
        setMapping(auto);
        setFileName(file.name);
      } catch (err) {
        setError("Erreur de lecture : " + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Lignes normalisées
  const normalized: NormalizedRow[] = useMemo(() => {
    if (!headers.length) return [];
    const col = (k: FieldKey) => mapping[k] ?? -1;
    return dataRows.map((r) => ({
      site: col("site") >= 0 ? String(r[col("site")] ?? "").trim() : "",
      date: col("dateReleve") >= 0 ? parseCellDate(r[col("dateReleve")]) : null,
      compteur: col("compteur") >= 0 ? String(r[col("compteur")] ?? "").trim() : "",
      index: col("index") >= 0 ? parseNumber(r[col("index")]) : null,
      conso: col("conso") >= 0 ? parseNumber(r[col("conso")]) : null,
      fluide: col("fluide") >= 0 ? String(r[col("fluide")] ?? "").trim() : "",
      unite: col("unite") >= 0 ? String(r[col("unite")] ?? "").trim() : "",
    }));
  }, [dataRows, headers, mapping]);

  // Calcul des consommations mensuelles (même logique que consumption-projector)
  const monthly = useMemo(() => {
    if (!normalized.length) return [];
    // groupe par site|compteur
    const groups = new Map<string, NormalizedRow[]>();
    for (const row of normalized) {
      if (!row.site || !row.compteur || !row.date) continue;
      const key = `${norm(row.site)}|${norm(row.compteur)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    type Bucket = { site: string; energyType: string; usage: string; periodIso: string; qty: number; unit: string; meters: Set<string> };
    const buckets = new Map<string, Bucket>();

    for (const rows of groups.values()) {
      const sorted = [...rows].sort((a, b) => (a.date!.getTime() - b.date!.getTime()));
      const first = sorted[0];
      const { energyType, usage, coef, outUnit } = mapEnergy(first.compteur, first.fluide, pcs, qEcs);

      const addToBuckets = (startDate: Date, endDate: Date, converted: number) => {
        const months = prorateAcrossMonths(startDate, endDate, converted);
        for (const [iso, q] of months.entries()) {
          const bk = `${norm(first.site)}|${energyType}|${usage}|${iso}`;
          const ex = buckets.get(bk);
          if (ex) {
            ex.qty += q;
            ex.meters.add(first.compteur);
          } else {
            buckets.set(bk, { site: first.site, energyType, usage, periodIso: iso, qty: q, unit: outUnit, meters: new Set([first.compteur]) });
          }
        }
      };

      const hasIndex = sorted.some((r) => r.index != null);
      if (hasIndex) {
        let prev: NormalizedRow | null = null;
        for (const curr of sorted) {
          if (!prev || prev.index == null || curr.index == null) { prev = curr; continue; }
          const delta = curr.index - prev.index;
          if (delta <= 0) { prev = curr; continue; }
          const converted = coef != null ? delta * coef : delta;
          const startDate = new Date(prev.date!.getTime() + 86400000);
          addToBuckets(startDate, curr.date!, converted);
          prev = curr;
        }
      } else {
        // pas d'index → on utilise la conso fournie, attribuée au mois de la date de relevé
        for (const curr of sorted) {
          if (curr.conso == null || curr.conso <= 0) continue;
          const converted = coef != null ? curr.conso * coef : curr.conso;
          addToBuckets(curr.date!, curr.date!, converted);
        }
      }
    }

    return Array.from(buckets.values())
      .map((b) => ({ ...b, period: periodKeyToDate(b.periodIso), meterNames: Array.from(b.meters).join(", ") }))
      .sort((a, b) => a.site.localeCompare(b.site) || a.period.getTime() - b.period.getTime());
  }, [normalized, pcs, qEcs]);

  // Lignes prêtes pour l'écriture en base (site + date + compteur + index requis)
  const payloadRows = useMemo(
    () =>
      normalized
        .filter((r) => r.site && r.date && r.compteur && r.index != null)
        .map((r) => {
          const { energyType, usage } = mapEnergy(r.compteur, r.fluide, pcs, qEcs);
          return {
            site: r.site,
            date: r.date!.toISOString(),
            meter: r.compteur,
            fluid: energyToFluid(energyType, usage),
            index: r.index,
            unit: r.unite || "m³",
          };
        }),
    [normalized, pcs, qEcs]
  );

  const runImport = async (cid: string, siteMappings?: Record<string, string>) => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/consumptions/import-universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: cid, rows: payloadRows, siteMappings, importType }),
      });
      const data = await res.json();
      setImportResult(res.ok ? data : { error: data.error || "Échec de l'import" });
      // Pré-remplit les menus de correspondance avec la suggestion de chaque site non reconnu
      if (res.ok && Array.isArray(data.unmatchedSites) && data.unmatchedSites.length > 0) {
        const seed: Record<string, string> = {};
        for (const s of data.unmatchedSites) if (s.suggestionId) seed[s.name] = s.suggestionId;
        setManualMappings(seed);
      }
    } catch {
      setImportResult({ error: "Erreur réseau." });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    const cid = targetContractId || selectedContract?.id;
    if (!cid || payloadRows.length === 0) return;
    const label = contracts.find((c) => c.id === cid)?.title || "";
    if (
      !window.confirm(
        `Importer ${payloadRows.length} relevés dans le contrat « ${label} » ?\n\n` +
          "Les consommations 'exploitant' des sites concernés seront recalculées à partir des relevés."
      )
    )
      return;
    setManualMappings({});
    await runImport(cid);
  };

  // Mémorise les correspondances choisies (SiteAlias) puis ré-importe avec elles
  const handleRemap = async () => {
    const cid = targetContractId || selectedContract?.id;
    if (!cid) return;
    const entries = Object.entries(manualMappings).filter(([, sid]) => sid);
    if (entries.length === 0) return;
    // Persiste les alias pour les prochains imports
    try {
      await fetch("/api/site-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries.map(([alias, siteId]) => ({ alias, siteId, source: "EXPLOITANT" }))),
      });
    } catch {
      /* la persistance échoue silencieusement : on ré-importe quand même */
    }
    await runImport(cid, Object.fromEntries(entries));
  };

  const missingRequired = FIELDS.filter((f) => f.required && (mapping[f.key] == null || mapping[f.key] < 0));
  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");
  const fmtMonth = (d: Date) => d.toISOString().slice(0, 7);
  const fmtQty = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
        <div>
          <h1 className="text-xl font-semibold">Import exploitant — Banc de test</h1>
          <p className="text-sm text-gray-500">
            Page isolée · 100% navigateur · <span className="font-medium text-amber-600">aucune écriture en base</span>
          </p>
        </div>
      </div>

      {/* Upload */}
      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <div className="text-sm text-gray-600">
          {fileName ? <span className="font-medium text-gray-900">{fileName}</span> : "Glisse un fichier exploitant (.xlsx, .csv) ou clique"}
        </div>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-3">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {headers.length > 0 && (
        <>
          {/* Réglages détection */}
          <div className="flex flex-wrap items-end gap-4 bg-gray-50 rounded-lg p-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ligne d'en-têtes détectée</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={headerRow}
                onChange={(e) => {
                  const hr = +e.target.value;
                  const hdrs = (allRows[hr] as unknown[]).map((c) => String(c ?? "").trim());
                  setHeaderRow(hr);
                  setHeaders(hdrs);
                  const body = allRows.slice(hr + 1, hr + 9);
                  const auto = { ...mapping };
                  for (const f of FIELDS) auto[f.key] = suggestColumn(f.key, hdrs, body);
                  setMapping(auto);
                }}
              >
                {allRows.slice(0, 15).map((_, i) => (
                  <option key={i} value={i}>Ligne {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PCS gaz (kWh/m³)</label>
              <input type="number" step="0.1" value={pcs} onChange={(e) => setPcs(+e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Q ECS (MWh/m³)</label>
              <input type="number" step="0.01" value={qEcs} onChange={(e) => setQEcs(+e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
            </div>
          </div>

          {/* Mapping colonnes → notions */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Mapping des colonnes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS.map((f) => {
                const val = mapping[f.key];
                const auto = val != null && val >= 0;
                return (
                  <div key={f.key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </span>
                      {auto && <span className="text-[10px] uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">auto</span>}
                    </div>
                    <select
                      className={`w-full border rounded px-2 py-1 text-sm ${f.required && !auto ? "border-red-300" : ""}`}
                      value={val ?? -1}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: +e.target.value }))}
                    >
                      <option value={-1}>— Aucune —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded p-3">
              <Info className="w-4 h-4" />
              Champs obligatoires non mappés : {missingRequired.map((f) => f.label).join(", ")}
            </div>
          )}

          {/* Aperçu lignes normalisées */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Lignes normalisées <span className="font-normal text-gray-400">({normalized.length})</span>
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Site</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Compteur</th>
                    <th className="px-3 py-2 text-right">Index</th>
                    <th className="px-3 py-2 text-right">Conso</th>
                    <th className="px-3 py-2 text-left">Fluide</th>
                    <th className="px-3 py-2 text-left">Unité</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {normalized.slice(0, 50).map((r, i) => (
                    <tr key={i} className={!r.date || !r.site || !r.compteur ? "bg-red-50" : ""}>
                      <td className="px-3 py-1.5">{r.site || "—"}</td>
                      <td className="px-3 py-1.5">{fmtDate(r.date)}</td>
                      <td className="px-3 py-1.5">{r.compteur || "—"}</td>
                      <td className="px-3 py-1.5 text-right">{r.index ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right">{r.conso ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.fluide || "—"}</td>
                      <td className="px-3 py-1.5">{r.unite || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {normalized.length > 50 && <p className="text-xs text-gray-400 mt-1">Aperçu limité à 50 lignes.</p>}
          </div>

          {/* Aperçu consommations calculées */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Consommations mensuelles calculées <span className="font-normal text-gray-400">({monthly.length})</span>
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Site</th>
                    <th className="px-3 py-2 text-left">Mois</th>
                    <th className="px-3 py-2 text-left">Énergie</th>
                    <th className="px-3 py-2 text-left">Usage</th>
                    <th className="px-3 py-2 text-right">Quantité</th>
                    <th className="px-3 py-2 text-left">Unité</th>
                    <th className="px-3 py-2 text-left">Compteur(s)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthly.map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{m.site}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmtMonth(m.period)}</td>
                      <td className="px-3 py-1.5">{m.energyType}</td>
                      <td className="px-3 py-1.5">{m.usage}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtQty(m.qty)}</td>
                      <td className="px-3 py-1.5">{m.unit}</td>
                      <td className="px-3 py-1.5 text-gray-500">{m.meterNames}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Écriture en base */}
          <div className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50/40 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-800">Importer en base</h2>
            </div>
            <p className="text-xs text-gray-500">
              Crée les compteurs + relevés et recalcule les consommations. Le PCS gaz / Q ECS de chaque
              site (depuis son contrat) est appliqué automatiquement — le coef global ci-dessus ne sert
              qu'à l'aperçu.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type d&apos;import</label>
                <select
                  className="border rounded px-2 py-1.5 text-sm"
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as "RELEVE_MENSUEL" | "ALLUMAGE" | "ARRET")}
                >
                  <option value="RELEVE_MENSUEL">Relevé mensuel — conso, ne touche pas aux dates</option>
                  <option value="ALLUMAGE">Allumage — pose la date de démarrage (1er relevé)</option>
                  <option value="ARRET">Arrêt — clôture la saison (dernier relevé)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contrat cible</label>
                <select
                  className="border rounded px-2 py-1.5 text-sm min-w-[16rem]"
                  value={targetContractId || selectedContract?.id || ""}
                  onChange={(e) => setTargetContractId(e.target.value)}
                >
                  <option value="">— Choisir un contrat —</option>
                  {contracts.map((c) => {
                    const parts = [
                      c.client?.name,
                      c.title || c.reference,
                      c.reference && c.title ? c.reference : null,
                      typeof c._count?.contractSites === "number" ? `${c._count.contractSites} sites` : null,
                    ].filter(Boolean);
                    return (
                      <option key={c.id} value={c.id}>{parts.join(" · ")}</option>
                    );
                  })}
                </select>
              </div>
              <button
                type="button"
                disabled={
                  importing ||
                  missingRequired.length > 0 ||
                  payloadRows.length === 0 ||
                  !(targetContractId || selectedContract?.id)
                }
                onClick={handleImport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Importer {payloadRows.length} relevés
              </button>
            </div>

            {importResult && "error" in importResult && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-3">
                <AlertTriangle className="w-4 h-4" /> {importResult.error}
              </div>
            )}
            {importResult && !("error" in importResult) && (
              <div className="text-sm bg-white border rounded p-3 space-y-1">
                <div className="font-medium text-emerald-700">Import terminé ✓</div>
                <div className="text-gray-600">
                  {importResult.imported} relevés créés · {importResult.updated} mis à jour ·{" "}
                  {importResult.metersCreated} compteurs créés · {importResult.sitesImpacted} sites recalculés ·{" "}
                  {importResult.heatingPeriods} période(s) de chauffe
                  {importResult.resetsDetected > 0 ? ` · ${importResult.resetsDetected} changement(s) de compteur détecté(s)` : ""}
                  {importResult.skipped > 0 ? ` · ${importResult.skipped} ignorés` : ""}
                </div>
                {importResult.unmatchedSites.length > 0 && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <div className="text-amber-700 font-medium">
                      {importResult.unmatchedSites.length} site(s) non reconnu(s) — associe-les manuellement :
                    </div>
                    {importResult.unmatchedSites.map((s) => (
                      <div key={s.name} className="flex flex-wrap items-center gap-2">
                        <span className="text-gray-700 min-w-[14rem]">
                          {s.name} <span className="text-gray-400">({s.count} relevés)</span>
                        </span>
                        <span className="text-gray-400">→</span>
                        <select
                          className="border rounded px-2 py-1 text-sm min-w-[16rem]"
                          value={manualMappings[s.name] ?? s.suggestionId ?? ""}
                          onChange={(e) => setManualMappings((m) => ({ ...m, [s.name]: e.target.value }))}
                        >
                          <option value="">— Ne pas associer —</option>
                          {"contractSites" in importResult &&
                            importResult.contractSites.map((cs) => (
                              <option key={cs.id} value={cs.id}>{cs.name}</option>
                            ))}
                        </select>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={importing || Object.values(manualMappings).filter(Boolean).length === 0}
                      onClick={handleRemap}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Mémoriser les correspondances et ré-importer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
