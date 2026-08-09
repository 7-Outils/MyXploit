"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Site } from "@/components/energy/types";

interface Meter {
  id: string;
  name: string;
  reference: string | null;
  fluid: string;
  unit: string;
  type: string;
}

interface Props {
  sites: Site[];
  onClose: () => void;
  onSaved: () => void;
}

const FLUID_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  EAU_CHAUDE: "ECS (Eau chaude)",
  EAU_FROIDE: "Eau froide",
  CHALEUR: "Chaleur",
  FIOUL: "Fioul",
};

export function CreateReadingModal({ sites, onClose, onSaved }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id || "");
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loadingMeters, setLoadingMeters] = useState(false);
  const [selectedMeterId, setSelectedMeterId] = useState("");
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [indexValue, setIndexValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isReset, setIsReset] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch meters when site changes
  useEffect(() => {
    if (!selectedSiteId) {
      setMeters([]);
      return;
    }
    let cancelled = false;
    setLoadingMeters(true);
    setSelectedMeterId("");

    fetch(`/api/sites/${selectedSiteId}/meters`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Meter[]) => {
        if (cancelled) return;
        setMeters(data || []);
        if (data?.length > 0) setSelectedMeterId(data[0].id);
      })
      .catch(() => {
        if (!cancelled) setMeters([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeters(false);
      });

    return () => { cancelled = true; };
  }, [selectedSiteId]);

  const selectedMeter = meters.find((m) => m.id === selectedMeterId);

  const submitReading = async (confirmAnomaly = false) => {
    const response = await fetch(
      `/api/sites/${selectedSiteId}/meters/${selectedMeterId}/readings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingDate,
          indexValue: parseFloat(indexValue),
          source: "MANUEL",
          isReset,
          confirmAnomaly,
          notes: notes || null,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 409 && data.anomaly) {
      if (confirm(data.message)) {
        return submitReading(true);
      }
      return false;
    }

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de l'enregistrement");
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeterId || !indexValue) return;

    setSaving(true);
    try {
      const ok = await submitReading(false);
      if (ok) {
        onSaved();
        onClose();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full border border-ink/15 bg-white shadow-large max-w-md">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-semibold text-ink">Saisir un relevé</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Site */}
          <div>
            <label className="label-tech mb-1.5 block">
              Site *
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              required
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Compteur */}
          <div>
            <label className="label-tech mb-1.5 block">
              Compteur *
            </label>
            {loadingMeters ? (
              <div className="flex items-center gap-2 py-2.5 text-sm text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Chargement des compteurs...
              </div>
            ) : meters.length === 0 ? (
              <p className="border border-amber-600/20 bg-amber-50 p-3 text-sm text-amber-700">
                Aucun compteur configuré sur ce site.{" "}
                <a
                  href={`/buildings/${selectedSiteId}?tab=meters`}
                  className="underline font-medium hover:text-amber-800"
                >
                  Configurer les compteurs
                </a>
              </p>
            ) : (
              <select
                value={selectedMeterId}
                onChange={(e) => setSelectedMeterId(e.target.value)}
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                required
              >
                {meters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {FLUID_LABELS[m.fluid] || m.fluid} ({m.unit})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date + Index */}
          {selectedMeter && (
            <>
              <div>
                <label className="label-tech mb-1.5 block">
                  Date du relevé *
                </label>
                <input
                  type="date"
                  required
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="label-tech mb-1.5 block">
                  Index compteur ({selectedMeter.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={indexValue}
                  onChange={(e) => setIndexValue(e.target.value)}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink font-mono tabular-nums focus:border-accent focus:outline-none"
                  placeholder="Ex: 15230.5"
                />
              </div>

              <div>
                <label className="label-tech mb-1.5 block">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  placeholder="Optionnel"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2 border border-amber-600/20 bg-amber-50 p-3">
                <input
                  type="checkbox"
                  checked={isReset}
                  onChange={(e) => setIsReset(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-600"
                />
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Nouveau compteur (réinitialisation)</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Cochez si le compteur a été remplacé. Ce relevé sera traité comme le premier d&apos;un nouveau compteur.
                  </p>
                </div>
              </label>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || !selectedMeterId || !indexValue}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
