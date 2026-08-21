"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Loader2, Trash2, Upload } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

interface ParsedRow {
  code: string;
  lot: string | null;
  corpsEtat: string | null;
  designation: string;
  unit: string | null;
  laborHours: number | null;
  laborCost: number | null;
  suppliesCost: number | null;
  sellPriceHT: number | null;
  installOnly: number | null;
  description: string | null;
}

const CHUNK_SIZE = 2000;

// Parseur CSV minimal : séparateur ";", champs éventuellement entre guillemets
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // BOM éventuel en tête de fichier
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// "3319,31" -> 3319.31 ; vide -> null. Les cellules Excel arrivent déjà en nombre.
function frNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const n = parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

type Cell = string | number | undefined;

const cellStr = (c: Cell) => (c === undefined || c === null ? "" : String(c));

// Trouve l'index d'une colonne par fragments de son intitulé
function col(headers: string[], ...needles: string[]): number {
  return headers.findIndex((h) => {
    const l = h.toLowerCase();
    return needles.every((n) => l.includes(n));
  });
}

export default function PriceLibrarySection() {
  const [count, setCount] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    fetch("/api/price-references")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCount(data.count);
          setSource(data.source);
        }
      })
      .catch(() => {});
  };

  useEffect(refresh, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setProgress("Lecture du fichier...");
    try {
      let rows: Cell[][];
      if (/\.xlsx?$/i.test(file.name)) {
        // Excel via la lib xlsx du projet. On cherche la feuille de données :
        // la première dont l'entête contient Code et Désignation (les exports
        // Batiprix ont une feuille Sommaire en tête).
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer());
        rows = [];
        for (const name of wb.SheetNames) {
          const sheetRows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], {
            header: 1,
            raw: true,
            defval: "",
          });
          const h = (sheetRows[0] ?? []).map(cellStr);
          if (col(h, "code") >= 0 && col(h, "désignation") >= 0 && sheetRows.length > 1) {
            rows = sheetRows;
            break;
          }
        }
        if (rows.length === 0) {
          throw new Error(
            "Aucune feuille avec colonnes « Code » et « Désignation » trouvée dans ce classeur"
          );
        }
      } else {
        rows = parseCsv(await file.text());
      }
      if (rows.length < 2) throw new Error("Fichier vide ou illisible");

      const headers = rows[0].map(cellStr);
      const iCode = col(headers, "code");
      const iDesignation = col(headers, "désignation");
      if (iCode < 0 || iDesignation < 0) {
        throw new Error(
          "Colonnes « Code » et « Désignation » introuvables — vérifiez que c'est bien l'export ouvrages (séparateur ;)"
        );
      }
      const iLot = col(headers, "lot");
      const iCorps = col(headers, "corps");
      const iUnit = col(headers, "unité");
      const iHours = col(headers, "temps");
      const iLabor = col(headers, "m.-o");
      const iSupplies = col(headers, "fournitures");
      const iSell = col(headers, "vente");
      const iInstall = col(headers, "mise en œuvre");
      const iDesc = col(headers, "description");

      const parsed: ParsedRow[] = rows
        .slice(1)
        .map((r) => ({
          code: cellStr(r[iCode]).trim(),
          lot: iLot >= 0 ? cellStr(r[iLot]).trim() || null : null,
          corpsEtat: iCorps >= 0 ? cellStr(r[iCorps]).trim() || null : null,
          designation: cellStr(r[iDesignation]).trim(),
          unit: iUnit >= 0 ? cellStr(r[iUnit]).trim() || null : null,
          laborHours: iHours >= 0 ? frNumber(r[iHours]) : null,
          laborCost: iLabor >= 0 ? frNumber(r[iLabor]) : null,
          suppliesCost: iSupplies >= 0 ? frNumber(r[iSupplies]) : null,
          sellPriceHT: iSell >= 0 ? frNumber(r[iSell]) : null,
          installOnly: iInstall >= 0 ? frNumber(r[iInstall]) : null,
          description: iDesc >= 0 ? cellStr(r[iDesc]).trim() || null : null,
        }))
        .filter((r) => r.code && r.designation);

      if (parsed.length === 0) throw new Error("Aucune ligne exploitable dans le fichier");

      // Source dérivée du nom de fichier, ex: "Batiprix_bibliotheque_COMPLETE_juillet2026"
      const sourceName = file.name.replace(/\.(csv|xlsx?)$/i, "").replace(/[_-]+/g, " ").trim() || "Import CSV";

      let inserted = 0;
      for (let start = 0; start < parsed.length; start += CHUNK_SIZE) {
        const chunk = parsed.slice(start, start + CHUNK_SIZE);
        setProgress(`Import ${Math.min(start + chunk.length, parsed.length)} / ${parsed.length} ouvrages...`);
        const res = await fetch("/api/price-references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, source: sourceName, replace: start === 0 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur lors de l'import");
        inserted += data.inserted;
      }
      setProgress(null);
      setError(null);
      refresh();
      alert(`Import terminé : ${inserted} ouvrages dans le référentiel.`);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Vider tout le référentiel de prix ?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/price-references", { method: "DELETE" });
      if (res.ok) refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <BookOpen size={14} className="text-ink/40" />
          Bibliothèque de prix
        </span>
      }
    >
      <p className="mb-4 text-sm text-ink/50">
        Référentiel d&apos;ouvrages (Batiprix...) utilisé pour l&apos;analyse des prix des devis.
        Import CSV (séparateur « ; ») ou Excel, avec colonnes Code, Désignation, Unité, Prix vente HT.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex-1 text-sm">
          {progress ? (
            <span className="flex items-center gap-2 text-ink/60">
              <Loader2 size={14} className="animate-spin text-accent" />
              {progress}
            </span>
          ) : count && count > 0 ? (
            <>
              <span className="font-mono tabular-nums font-medium text-ink">{count.toLocaleString("fr-FR")}</span>
              <span className="text-ink/60"> ouvrages</span>
              {source && <span className="block text-xs text-ink/40">Source : {source}</span>}
            </>
          ) : (
            <span className="text-ink/40">Aucun référentiel importé</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title={count && count > 0 ? "Remplacer le référentiel (CSV)" : "Importer le référentiel (CSV)"}
            className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/60 transition-colors hover:bg-ink/[0.02] disabled:opacity-50"
          >
            {busy && !progress ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          </button>
          {count != null && count > 0 && (
            <button
              onClick={handleDelete}
              disabled={busy}
              title="Vider le référentiel"
              className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
