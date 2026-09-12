"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Pencil, X } from "lucide-react";
import { Table, TBody, Td, Th, THead, TableEmpty, Tr } from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api-client";

// Taux indicatif : le suivi est tenu en dollars (barème des fournisseurs),
// l'affichage en euros parce que la refacturation l'est aussi.
const USD_TO_EUR = 0.92;

interface ByClient {
  clientId: string | null;
  clientName: string;
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface Call {
  id: string;
  createdAt: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  clientId: string | null;
  clientName: string;
  contractRef: string | null;
  quoteRef: string | null;
  userName: string | null;
}

interface UsageResponse {
  budgetUsd: number;
  monthUsedUsd: number;
  byClient: ByClient[];
  calls: Call[];
}

const FEATURE_LABELS: Record<string, string> = {
  QUOTE_IMPORT: "Import de devis",
  KEY_TEST: "Test de clé",
};

type PeriodKey = "month" | "prevMonth" | "quarter" | "year" | "all";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "month", label: "Mois courant" },
  { value: "prevMonth", label: "Mois précédent" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année" },
  { value: "all", label: "Tout" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Bornes UTC de la période choisie ; `from` nul = depuis toujours. */
function periodRange(period: PeriodKey): { from: string | null; to: string | null } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "month":
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: null };
    case "prevMonth":
      return {
        from: iso(new Date(Date.UTC(y, m - 1, 1))),
        // Dernier jour du mois précédent : jour 0 du mois courant.
        to: iso(new Date(Date.UTC(y, m, 0))),
      };
    case "quarter":
      return { from: iso(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))), to: null };
    case "year":
      return { from: iso(new Date(Date.UTC(y, 0, 1))), to: null };
    case "all":
      return { from: null, to: null };
  }
}

const eur = (usd: number) =>
  (usd * USD_TO_EUR).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const int = (n: number) => n.toLocaleString("fr-FR");

export default function AdminAiUsagePage() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);

  // Édition du plafond
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = periodRange(period);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      // « Tout » : une date suffisamment basse vaut absence de borne.
      if (!from) params.set("from", "2000-01-01");
      setData(await api.get<UsageResponse>(`/api/admin/ai-usage?${params.toString()}`));
    } catch (e) {
      setError(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const saveBudget = async () => {
    const value = Number(budgetInput.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 10000) {
      setError("Plafond invalide (entre 0 et 10000 $)");
      return;
    }
    setSavingBudget(true);
    setError(null);
    try {
      await api.patch("/api/organization", { aiMonthlyBudgetUsd: value });
      setEditingBudget(false);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingBudget(false);
    }
  };

  const totals = useMemo(() => {
    if (!data) return null;
    return data.byClient.reduce(
      (acc, r) => ({
        calls: acc.calls + r.calls,
        failed: acc.failed + r.failed,
        inputTokens: acc.inputTokens + r.inputTokens,
        outputTokens: acc.outputTokens + r.outputTokens,
        costUsd: acc.costUsd + r.costUsd,
      }),
      { calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
    );
  }, [data]);

  const ratio = data && data.budgetUsd > 0 ? data.monthUsedUsd / data.budgetUsd : 0;
  const barColor = ratio >= 1 ? "bg-red-600" : ratio >= 0.8 ? "bg-amber-500" : "bg-accent";

  const clientCalls = (clientId: string | null) =>
    data ? data.calls.filter((c) => c.clientId === clientId) : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
          >
            <ArrowLeft size={16} />
            Administration
          </Link>
          <h1 className="text-xl font-semibold text-ink">Consommation IA</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Appels aux fournisseurs IA, ventilés par client pour la refacturation
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value as PeriodKey);
            setOpenClient(null);
          }}
          className="h-9 border border-ink/20 bg-white px-3 text-sm focus:border-accent focus:outline-none"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Plafond du mois : le seul chiffre qui bloque des appels */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="label-tech">Ce mois</span>
            <span className="font-mono text-lg tabular-nums text-ink">
              {data ? `${eur(data.monthUsedUsd)} €` : "…"}
            </span>
            <span className="text-sm text-ink/40">/ plafond</span>
            {editingBudget ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveBudget();
                    if (e.key === "Escape") setEditingBudget(false);
                  }}
                  className="h-9 w-24 border border-ink/20 bg-white px-2 text-right font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                />
                <span className="text-sm text-ink/40">$</span>
                <button
                  onClick={saveBudget}
                  disabled={savingBudget}
                  title="Enregistrer le plafond"
                  className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {savingBudget ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                </button>
                <button
                  onClick={() => setEditingBudget(false)}
                  title="Annuler"
                  className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:border-accent hover:text-accent"
                >
                  <X size={16} />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="font-mono text-lg tabular-nums text-ink/60">
                  {data ? `${data.budgetUsd} $` : "…"}
                </span>
                <button
                  onClick={() => {
                    setBudgetInput(data ? String(data.budgetUsd) : "");
                    setEditingBudget(true);
                  }}
                  disabled={!data}
                  title="Modifier le plafond mensuel"
                  className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <Pencil size={16} />
                </button>
              </span>
            )}
          </div>
          {ratio >= 1 && (
            <span className="font-mono text-[11px] uppercase tracking-widest text-red-600">
              Plafond atteint — appels IA refusés
            </span>
          )}
        </div>
        <div className="mt-3 h-1 w-full bg-ink/10">
          <div
            className={`h-1 ${barColor}`}
            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink/40">
          Montants convertis au taux indicatif 1 $ = {USD_TO_EUR.toFixed(2).replace(".", ",")} €. Le
          plafond est exprimé en dollars, comme le barème des fournisseurs.
        </p>
      </div>

      {/* Ventilation par client */}
      <Table>
        <THead>
          <Th>Client</Th>
          <Th align="right">Appels</Th>
          <Th align="right">Échecs</Th>
          <Th align="right">Tokens entrée</Th>
          <Th align="right">Tokens sortie</Th>
          <Th align="right">Coût</Th>
        </THead>
        <TBody>
          {loading && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink/40">
                …
              </td>
            </tr>
          )}
          {!loading && data && data.byClient.length === 0 && (
            <TableEmpty colSpan={6} message="Aucun appel IA sur la période" />
          )}
          {!loading &&
            data?.byClient.map((row) => {
              const key = row.clientId ?? "__none__";
              const open = openClient === key;
              const detail = open ? clientCalls(row.clientId) : [];
              return [
                <Tr
                  key={key}
                  onClick={() => setOpenClient(open ? null : key)}
                  className={open ? "bg-ink/[0.03]" : undefined}
                >
                  <Td className="font-medium text-ink">{row.clientName}</Td>
                  <Td align="right" className="font-mono">
                    {int(row.calls)}
                  </Td>
                  <Td align="right" className={`font-mono ${row.failed > 0 ? "text-red-600" : ""}`}>
                    {int(row.failed)}
                  </Td>
                  <Td align="right" className="font-mono">
                    {int(row.inputTokens)}
                  </Td>
                  <Td align="right" className="font-mono">
                    {int(row.outputTokens)}
                  </Td>
                  <Td align="right" className="font-mono text-ink">
                    {eur(row.costUsd)} €
                  </Td>
                </Tr>,
                open ? (
                  <tr key={`${key}-detail`} className="bg-ink/[0.02]">
                    <td colSpan={6} className="px-4 py-3">
                      {detail.length === 0 ? (
                        <p className="text-sm text-ink/40">
                          Détail indisponible : au-delà des 500 appels les plus récents.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-ink/10">
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Date
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Utilisateur
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Fonctionnalité
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Contrat
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Devis
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-left">
                                  Modèle
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-right">
                                  Tokens
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 pr-4 text-right">
                                  Coût
                                </th>
                                <th className="label-tech whitespace-nowrap py-1.5 text-center">
                                  Statut
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/10">
                              {detail.map((c) => (
                                <tr key={c.id}>
                                  <td className="whitespace-nowrap py-1.5 pr-4 font-mono text-xs tabular-nums text-ink/60">
                                    {new Date(c.createdAt).toLocaleString("fr-FR", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                                  </td>
                                  <td className="py-1.5 pr-4 text-sm text-ink/80">
                                    {c.userName ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-4 text-sm text-ink/80">
                                    {FEATURE_LABELS[c.feature] ?? c.feature}
                                  </td>
                                  <td className="py-1.5 pr-4 font-mono text-xs text-ink/60">
                                    {c.contractRef ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-4 font-mono text-xs text-ink/60">
                                    {c.quoteRef ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-4 font-mono text-xs text-ink/60">
                                    {c.model}
                                  </td>
                                  <td className="whitespace-nowrap py-1.5 pr-4 text-right font-mono text-xs tabular-nums text-ink/60">
                                    {int(c.inputTokens)} / {int(c.outputTokens)}
                                  </td>
                                  <td className="whitespace-nowrap py-1.5 pr-4 text-right font-mono text-xs tabular-nums text-ink">
                                    {eur(c.costUsd)} €
                                  </td>
                                  <td
                                    className="py-1.5 text-center text-sm"
                                    title={c.error ?? undefined}
                                  >
                                    {c.ok ? (
                                      <span className="text-green-700">✓</span>
                                    ) : (
                                      <span className="text-red-600">✗</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          {!loading && totals && data && data.byClient.length > 0 && (
            <Tr className="border-t-2 border-ink/20 bg-white">
              <Td className="font-semibold text-ink">Total</Td>
              <Td align="right" className="font-mono font-semibold text-ink">
                {int(totals.calls)}
              </Td>
              <Td
                align="right"
                className={`font-mono font-semibold ${totals.failed > 0 ? "text-red-600" : "text-ink"}`}
              >
                {int(totals.failed)}
              </Td>
              <Td align="right" className="font-mono font-semibold text-ink">
                {int(totals.inputTokens)}
              </Td>
              <Td align="right" className="font-mono font-semibold text-ink">
                {int(totals.outputTokens)}
              </Td>
              <Td align="right" className="font-mono font-semibold text-ink">
                {eur(totals.costUsd)} €
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
    </div>
  );
}
