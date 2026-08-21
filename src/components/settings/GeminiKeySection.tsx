"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

export default function GeminiKeySection() {
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
          setKeySet(!!org.geminiKeySet);
          setLast4(org.geminiKeyLast4 ?? null);
          setFallback(!!org.geminiFallback);
        }
      })
      .catch(() => {});
  };

  useEffect(refresh, []);

  const save = async (value: string | null) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey: value }),
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

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <KeyRound size={14} className="text-ink/40" />
          Clé API Gemini
        </span>
      }
    >
      <p className="mb-4 text-sm text-ink/50">
        Clé Google Gemini de votre organisation, utilisée pour l&apos;import IA des devis,
        l&apos;analyse des prix et l&apos;import des plans de renouvellement. Créez-la sur{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          aistudio.google.com
        </a>{" "}
        — la facturation est portée par votre compte Google.
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
          Clé enregistrée
        </div>
      )}

      <div className="mb-3 text-sm">
        {keySet ? (
          <span className="text-ink">
            Clé configurée{last4 && <span className="font-mono text-ink/60"> ····{last4}</span>}
          </span>
        ) : fallback ? (
          <span className="text-ink/60">
            Aucune clé propre — la clé partagée de la plateforme est utilisée en secours.
          </span>
        ) : (
          <span className="text-amber-700">Aucune clé configurée : les fonctions IA sont désactivées.</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={keySet ? "Nouvelle clé pour remplacer l'actuelle" : "AIza..."}
          autoComplete="off"
          className="h-9 flex-1 border border-ink/20 bg-white px-3 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => save(input)}
          disabled={busy || input.trim().length < 20}
          title="Enregistrer la clé"
          className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        {keySet && (
          <button
            onClick={() => { if (confirm("Supprimer la clé API de l'organisation ?")) save(null); }}
            disabled={busy}
            title="Supprimer la clé"
            className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </ChartCard>
  );
}
