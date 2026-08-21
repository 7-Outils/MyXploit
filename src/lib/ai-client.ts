import { GoogleGenAI } from "@google/genai";

/**
 * Couche d'abstraction des fournisseurs IA. Toutes les fonctions IA de
 * l'app (import devis, analyse de prix, plan de renouvellement) passent
 * par aiJson() : un prompt, un PDF optionnel, un schéma de réponse — le
 * fournisseur configuré par l'organisation fait le reste.
 */

export type AiProvider = "GEMINI" | "OPENAI" | "ANTHROPIC";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  GEMINI: "Google Gemini",
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic Claude",
};

const MODELS: Record<AiProvider, string> = {
  GEMINI: "gemini-3-flash-preview",
  OPENAI: "gpt-5-mini",
  ANTHROPIC: "claude-haiku-4-5-20251001",
};

interface AiJsonRequest {
  prompt: string;
  pdf?: Buffer;
  // Schéma au format Gemini (Type.OBJECT...) — seul Gemini l'applique
  // nativement ; pour les autres il est sérialisé dans le prompt.
  geminiSchema: object;
}

// Retire une éventuelle clôture markdown autour du JSON
function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function geminiJson(cfg: AiConfig, req: AiJsonRequest): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  const parts: object[] = [];
  if (req.pdf) {
    parts.push({ inlineData: { mimeType: "application/pdf", data: req.pdf.toString("base64") } });
  }
  parts.push({ text: req.prompt });

  const response = await ai.models.generateContent({
    model: MODELS.GEMINI,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: req.geminiSchema,
      temperature: 0,
    },
  });
  if (!response.text) throw new Error("Réponse Gemini vide");
  return parseJson(response.text);
}

// Consigne JSON pour les fournisseurs sans schéma de réponse natif ici
function jsonInstruction(req: AiJsonRequest): string {
  return `${req.prompt}

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte autour, pas de markdown), conforme à ce schéma :
${JSON.stringify(req.geminiSchema)}`;
}

async function openaiJson(cfg: AiConfig, req: AiJsonRequest): Promise<unknown> {
  const content: object[] = [];
  if (req.pdf) {
    content.push({
      type: "input_file",
      filename: "document.pdf",
      file_data: `data:application/pdf;base64,${req.pdf.toString("base64")}`,
    });
  }
  content.push({ type: "input_text", text: jsonInstruction(req) });

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.OPENAI,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status} : ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
  };
  const text = data.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === "output_text")?.text;
  if (!text) throw new Error("Réponse OpenAI vide");
  return parseJson(text);
}

async function anthropicJson(cfg: AiConfig, req: AiJsonRequest): Promise<unknown> {
  const content: object[] = [];
  if (req.pdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: req.pdf.toString("base64") },
    });
  }
  content.push({ type: "text", text: jsonInstruction(req) });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.ANTHROPIC,
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status} : ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Réponse Anthropic vide");
  return parseJson(text);
}

export async function aiJson(cfg: AiConfig, req: AiJsonRequest): Promise<unknown> {
  switch (cfg.provider) {
    case "GEMINI":
      return geminiJson(cfg, req);
    case "OPENAI":
      return openaiJson(cfg, req);
    case "ANTHROPIC":
      return anthropicJson(cfg, req);
  }
}
