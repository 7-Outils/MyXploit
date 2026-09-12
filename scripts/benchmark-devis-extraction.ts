/**
 * Banc d'essai : Gemini (chaîne du site, prompt et schéma identiques) contre
 * Mistral OCR + annotation structurée, sur un dossier de devis PDF.
 *
 *   npx tsx scripts/benchmark-devis-extraction.ts [dossier]
 *
 * Dossier par défaut : ~/Desktop/devis-test. Il contient les PDF et un fichier
 * cles.txt avec GEMINI_API_KEY=… et MISTRAL_API_KEY=… (une par ligne).
 * Sortie : tableau champ par champ à l'écran + resultats.md dans le dossier.
 */
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { PROMPT, responseSchema } from "../src/lib/gemini-pdf-parser";
import { GEMINI_MODEL } from "../src/lib/ai-client";

const FIELDS = ["reference", "siteName", "siteCity", "objet", "amountHT", "issueDate", "quoteType"] as const;
type Field = (typeof FIELDS)[number];
type Extracted = Partial<Record<Field, unknown>>;

interface Run {
  data: Extracted | null;
  error: string | null;
  ms: number;
  cost: string;
}

// Tarifs au 12/09/2026 (USD) — Gemini 3.5 Flash-Lite 0,30 $/M entrée,
// 2,50 $/M sortie ; Mistral OCR 4.1 annoté 5 $ les 1 000 pages.
const GEMINI_IN = 0.3 / 1_000_000;
const GEMINI_OUT = 2.5 / 1_000_000;
const MISTRAL_PAGE = 5 / 1000;

const MISTRAL_SCHEMA = {
  type: "object",
  properties: {
    reference: { type: "string", description: "Référence du devis ou de la facture" },
    siteName: {
      type: "string",
      description:
        "Nom du bâtiment/établissement seul (ex: Mairie, École Jules Ferry, Piscine municipale), pas l'adresse complète ni l'exploitant",
    },
    siteCity: { type: "string", description: "Ville du site concerné" },
    objet: { type: "string", description: "Objet des travaux, phrase complète telle qu'écrite" },
    amountHT: { type: "number", description: "Montant total hors taxes en nombre décimal, sans symbole ni espaces" },
    issueDate: {
      type: "string",
      description:
        "Date d'émission du document au format YYYY-MM-DD — celle en tête du document, pas l'échéance ni la date des travaux",
    },
    quoteType: {
      type: "string",
      enum: ["P1", "P3", "P5", "TRAVAUX", "AMELIORATION", "AUTRE"],
      description:
        "P1 = énergie/combustible/gaz/fioul/CEE ; P3 = gros entretien, remplacement, renouvellement, réfection ; P5 = prestations exceptionnelles (APE) ; TRAVAUX = hors contrat ; AMELIORATION = amélioration énergétique/MDE ; AUTRE sinon",
    },
  },
  required: [...FIELDS],
  additionalProperties: false,
};

function readKeys(dir: string): Record<string, string> {
  const keys: Record<string, string> = {};
  const file = path.join(dir, "cles.txt");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m) keys[m[1]] = m[2];
    }
  }
  for (const k of ["GEMINI_API_KEY", "MISTRAL_API_KEY"]) {
    if (process.env[k]) keys[k] = process.env[k]!;
  }
  return keys;
}

async function runGemini(pdf: Buffer, apiKey: string): Promise<Run> {
  const t0 = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
            { text: PROMPT },
          ],
        },
      ],
      config: { responseMimeType: "application/json", responseSchema, temperature: 0 },
    });
    const usage = response.usageMetadata;
    const cost =
      usage
        ? `${((usage.promptTokenCount ?? 0) * GEMINI_IN + (usage.candidatesTokenCount ?? 0) * GEMINI_OUT).toFixed(5)} $ (${usage.promptTokenCount ?? "?"} → ${usage.candidatesTokenCount ?? "?"} tokens)`
        : "?";
    return { data: JSON.parse(response.text ?? "{}"), error: null, ms: Date.now() - t0, cost };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0, cost: "—" };
  }
}

async function runMistral(pdf: Buffer, apiKey: string): Promise<Run> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "document_url", document_url: `data:application/pdf;base64,${pdf.toString("base64")}` },
        document_annotation_format: {
          type: "json_schema",
          json_schema: { name: "devis", schema: MISTRAL_SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      document_annotation?: string;
      usage_info?: { pages_processed?: number };
    };
    const pages = body.usage_info?.pages_processed ?? 0;
    const data = body.document_annotation ? JSON.parse(body.document_annotation) : null;
    return {
      data,
      error: data ? null : "réponse sans annotation",
      ms: Date.now() - t0,
      cost: `${(pages * MISTRAL_PAGE).toFixed(5)} $ (${pages} page${pages > 1 ? "s" : ""})`,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0, cost: "—" };
  }
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : String(v));

async function main() {
  const dir = process.argv[2] ?? path.join(process.env.HOME ?? ".", "Desktop", "devis-test");
  const keys = readKeys(dir);
  if (!keys.GEMINI_API_KEY || !keys.MISTRAL_API_KEY) {
    console.error(`Clés manquantes. Attendu dans ${path.join(dir, "cles.txt")} :\nGEMINI_API_KEY=…\nMISTRAL_API_KEY=…`);
    process.exit(1);
  }
  const pdfs = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  if (pdfs.length === 0) {
    console.error(`Aucun PDF dans ${dir}`);
    process.exit(1);
  }

  const md: string[] = [`# Banc d'essai extraction devis — ${new Date().toLocaleString("fr-FR")}`, ""];
  let totalG = 0;
  let totalM = 0;

  for (const file of pdfs) {
    const pdf = fs.readFileSync(path.join(dir, file));
    process.stdout.write(`\n${file} … `);
    const [g, m] = await Promise.all([runGemini(pdf, keys.GEMINI_API_KEY), runMistral(pdf, keys.MISTRAL_API_KEY)]);
    process.stdout.write(`Gemini ${g.ms} ms · Mistral ${m.ms} ms\n`);

    const rows = FIELDS.map((f) => {
      const a = show(g.data?.[f]);
      const b = show(m.data?.[f]);
      return `| ${f} | ${a} | ${b} | ${a === b ? "" : "≠"} |`;
    });
    const block = [
      `## ${file}`,
      "",
      `| Champ | Gemini ${GEMINI_MODEL} | Mistral OCR | |`,
      "|---|---|---|---|",
      ...rows,
      `| _durée_ | ${g.ms} ms | ${m.ms} ms | |`,
      `| _coût_ | ${g.cost} | ${m.cost} | |`,
      ...(g.error ? [`| _erreur Gemini_ | ${g.error} | | |`] : []),
      ...(m.error ? [`| _erreur Mistral_ | | ${m.error} | |`] : []),
      "",
    ];
    console.log(block.join("\n"));
    md.push(...block);
    totalG += parseFloat(g.cost) || 0;
    totalM += parseFloat(m.cost) || 0;
  }

  md.push(`**Coût total** — Gemini ${totalG.toFixed(4)} $ · Mistral ${totalM.toFixed(4)} $ pour ${pdfs.length} devis.`);
  const out = path.join(dir, "resultats.md");
  fs.writeFileSync(out, md.join("\n"));
  console.log(`\nRésultats écrits dans ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
