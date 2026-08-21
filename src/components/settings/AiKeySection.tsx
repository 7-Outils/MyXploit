"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

type Provider = "GEMINI" | "OPENAI" | "ANTHROPIC";

const PROVIDERS: { value: Provider; label: string; keyUrl: string; keyHint: string }[] = [
  { value: "GEMINI", label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey", keyHint: "AIza..." },
  { value: "OPENAI", label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys", keyHint: "sk-..." },
  { value: "ANTHROPIC", label: "Anthropic Claude", keyUrl: "https://console.anthropic.com/settings/keys", keyHint: "sk-ant-..." },
];

export default function AiKeySection() {
  const [provider, setProvider] = useState<Provider>("GEMINI");
  const [keySet, setKeySet] = useState(false);
  const [last4, setLast4] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refresh = () => {
    fetch("/api/organization")
      .then((res) => (res.ok ? res.json() : null))
      .then((org) => {
        if (org) {
          setProvider((org.aiProvider as Provider) ?? "GEMINI");
          setKeySet(!!org.aiKeySet);
          setLast4(org.aiKeyLast4 ?? null);
          setFallback(!!org.aiFallback);
        }
      })
      .catch(() => {});
  };

  useEffect(refresh, []);

  const save = async (body: { aiProvider?: Provider; aiApiKey?: string | null }) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'enregistrement");
        return;
      }
      setInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setBusy(false);
    }
  };

  const current = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <KeyRound size={14} className="text-ink/40" />
          Fournisseur IA
        </span>
      }
    >
      <p className="mb-4 text-sm text-ink/50">
        Fournisseur et clé API de votre organisation, utilisés pour l&apos;import IA des devis,
        l&apos;analyse des prix et l&apos;import des plans de renouvellement. La facturation est
        portée par votre compte chez le fournisseur choisi.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 flex items-center gap-2 border border-green-600/20 bg-green-50 p-3 text-sm text-green-700">
          <Check size={16} />
          Enregistré
        </div>
      )}

      <div className="mb-3 text-sm">
        {keySet ? (
          <span className="text-ink">
            {current.label} — clé configurée
            {last4 && <span className="font-mono text-ink/60"> ····{last4}</span>}
          </span>
        ) : fallback ? (
          <span className="text-ink/60">
            Aucune clé propre — la clé Gemini partagée de la plateforme est utilisée en secours.
          </span>
        ) : (
          <span className="text-amber-700">Aucune clé configurée : les fonctions IA sont désactivées.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={provider}
          onChange={(e) => {
            const next = e.target.value as Provider;
            setProvider(next);
            // Changer de fournisseur sans re-saisir de clé n'a pas de sens :
            // on n'enregistre le fournisseur qu'avec la clé, sauf si une clé
            // existe déjà (on suppose qu'elle correspond au nouveau choix).
            if (keySet) save({ aiProvider: next });
          }}
          className="h-9 border border-ink/20 bg-white px-3 text-sm focus:border-accent focus:outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={keySet ? "Nouvelle clé pour remplacer l'actuelle" : current.keyHint}
          autoComplete="off"
          className="h-9 min-w-48 flex-1 border border-ink/20 bg-white px-3 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => save({ aiProvider: provider, aiApiKey: input })}
            disabled={busy || input.trim().length < 20}
            title="Enregistrer le fournisseur et la clé"
            className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          {keySet && (
            <button
              onClick={() => { if (confirm("Supprimer la clé API de l'organisation ?")) save({ aiApiKey: null }); }}
              disabled={busy}
              title="Supprimer la clé"
              className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/40">
        Créer une clé :{" "}
        <a href={current.keyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {current.keyUrl.replace("https://", "")}
        </a>
      </p>
    </ChartCard>
  );
}
