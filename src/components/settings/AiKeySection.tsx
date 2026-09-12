"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, PlugZap, Sparkles } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

// Un seul opérateur, une seule clé IA : celle de la plateforme
// (GEMINI_API_KEY sur Vercel). Rien à saisir ici, seulement l'état et un test.
export default function AiSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("gemini-3.8-flash");
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/organization")
      .then((res) => (res.ok ? res.json() : null))
      .then((org) => {
        if (org) {
          setConfigured(!!org.aiConfigured);
          if (org.aiModel) setModel(org.aiModel);
        }
      })
      .catch(() => {});
  }, []);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/organization/ai-test", { method: "POST" });
      const data = await res.json();
      setTest({ ok: !!data.ok, message: data.message ?? (data.ok ? "Clé valide" : "Échec") });
    } catch {
      setTest({ ok: false, message: "Erreur de connexion au serveur" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={14} className="text-ink/40" />
          Intelligence artificielle
        </span>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {configured === false ? (
            <span className="text-amber-700">
              Clé de la plateforme absente — GEMINI_API_KEY à définir sur Vercel
            </span>
          ) : (
            <span className="text-ink">
              Google Gemini · <span className="font-mono text-ink/70">{model}</span> · clé de la plateforme
            </span>
          )}
        </div>
        <button
          onClick={runTest}
          disabled={testing}
          title="Tester la clé auprès de Google"
          className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/60 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {testing ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
        </button>
      </div>

      {test && (
        <div
          className={`mt-3 flex items-center gap-2 border p-3 text-sm ${
            test.ok
              ? "border-green-600/20 bg-green-50 text-green-700"
              : "border-red-600/20 bg-red-50 text-red-700"
          }`}
        >
          {test.ok ? <Check size={16} /> : <AlertCircle size={16} />}
          {test.message}
        </div>
      )}

      <p className="mt-3 text-xs text-ink/40">
        La consommation est suivie par client dans{" "}
        {isAdmin ? (
          <Link href="/admin/ai-usage" className="text-accent hover:underline">
            Admin › Consommation IA
          </Link>
        ) : (
          "Admin › Consommation IA"
        )}
        .
      </p>
    </ChartCard>
  );
}
