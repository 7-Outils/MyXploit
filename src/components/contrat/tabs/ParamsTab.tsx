"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

interface Props {
  contractId: string;
  djuContractuel: number | null;
  onUpdated: () => void;
}

export function ParamsContent({ contractId, djuContractuel, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(djuContractuel?.toString() || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ djuContractuel: value ? parseFloat(value) : null }),
      });
      if (res.ok) {
        setEditing(false);
        onUpdated();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChartCard title="Paramètres du contrat">
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-primary-dark">DJU Contractuels (DJC)</p>
            <p className="text-xs text-text-secondary">Base de référence pour le calcul N&apos;B = NB × (DJR / DJC)</p>
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24 h-8 px-2 text-sm border rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="2400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
              <span className="text-xs text-text-secondary">DJU</span>
              <button onClick={save} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary-dark">
                {djuContractuel ? `${djuContractuel.toLocaleString("fr-FR")} DJU` : "Non renseigné"}
              </span>
              <button
                onClick={() => { setValue(djuContractuel?.toString() || ""); setEditing(true); }}
                className="p-1.5 text-gray-400 hover:text-accent hover:bg-gray-100 rounded"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
