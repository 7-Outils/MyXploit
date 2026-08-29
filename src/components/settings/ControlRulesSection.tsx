"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Check, ClipboardCheck, Loader2, Pencil, Plus, X, Trash2 } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  TYPE_GROUPS,
  equipmentTypeLabels,
} from "@/components/exploitation/constants";

/**
 * Règles de contrôle réglementaire par type d'équipement.
 * Elles alimentent la fiche équipement (section « Contrôles réglementaires »)
 * et la conformité de la Synthèse Équipements.
 */

interface ControlRule {
  id: string;
  equipmentType: string;
  name: string;
  frequencyMonths: number;
}

const emptyForm = { equipmentType: "", name: "", frequencyMonths: "12" };

const inputClass =
  "border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";

function typeLabel(type: string): string {
  return equipmentTypeLabels[type] || type;
}

export default function ControlRulesSection() {
  const { data, isLoading, mutate } = useSWR<ControlRule[]>(
    "/api/control-rules",
    fetcher
  );
  const rules = useMemo(() => data ?? [], [data]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Les types hérités des anciens imports ne figurent pas dans les familles de
  // la fiche : on les ajoute au select dès qu'une règle les utilise, sinon
  // l'édition les effacerait.
  const extraTypes = useMemo(() => {
    const known = new Set(TYPE_GROUPS.flatMap((group) => group.types));
    return [...new Set(rules.map((r) => r.equipmentType))]
      .filter((type) => !known.has(type))
      .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), "fr"));
  }, [rules]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const startEdit = (rule: ControlRule) => {
    setEditingId(rule.id);
    setForm({
      equipmentType: rule.equipmentType,
      name: rule.name,
      frequencyMonths: String(rule.frequencyMonths),
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.equipmentType || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        editingId ? `/api/control-rules/${editingId}` : "/api/control-rules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipmentType: form.equipmentType,
            name: form.name.trim(),
            frequencyMonths: Number(form.frequencyMonths),
          }),
        }
      );
      if (res.ok) {
        reset();
        mutate();
      } else {
        const result = await res.json().catch(() => ({}));
        setError(result.error || "Erreur lors de l'enregistrement");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (rule: ControlRule) => {
    if (
      !confirm(
        `Supprimer « ${rule.name} » ? Les contrôles enregistrés seront supprimés avec la règle.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/control-rules/${rule.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (editingId === rule.id) reset();
        mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-ink/40" />
          Contrôles réglementaires
        </span>
      }
    >
      <p className="mb-4 text-sm text-ink/50">
        Ce qui doit être contrôlé, par type d&apos;équipement, et à quelle
        fréquence. La fiche équipement propose ces contrôles à l&apos;écran et la
        Synthèse Équipements en déduit les retards.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 panel p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1.5fr_auto_auto]">
          <select
            value={form.equipmentType}
            onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}
            required
            className={inputClass}
          >
            <option value="">Type d&apos;équipement *</option>
            {TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.types.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </optgroup>
            ))}
            {extraTypes.length > 0 && (
              <optgroup label="Autres types">
                {extraTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nom du contrôle *"
            required
            className={inputClass}
          />
          <input
            type="number"
            min={1}
            max={120}
            value={form.frequencyMonths}
            onChange={(e) =>
              setForm({ ...form, frequencyMonths: e.target.value })
            }
            placeholder="Mois"
            required
            className={`${inputClass} w-24`}
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              disabled={busy || !form.equipmentType || !form.name.trim()}
              title={editingId ? "Enregistrer" : "Ajouter la règle"}
              className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : editingId ? (
                <Check size={16} />
              ) : (
                <Plus size={16} />
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={reset}
                title="Annuler la modification"
                className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/60 transition-colors hover:bg-ink/[0.02]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : rules.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/50">
          Aucune règle de contrôle définie.
        </p>
      ) : (
        <div className="divide-y divide-ink/10 border border-ink/10">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.02]"
            >
              <span className="w-48 flex-shrink-0 truncate text-sm text-ink/60">
                {typeLabel(rule.equipmentType)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {rule.name}
              </span>
              <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink/50">
                {rule.frequencyMonths} mois
              </span>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(rule)}
                  title="Modifier"
                  className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rule)}
                  disabled={busy}
                  title="Supprimer"
                  className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
