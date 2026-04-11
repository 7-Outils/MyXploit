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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeterId || !indexValue) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/sites/${selectedSiteId}/meters/${selectedMeterId}/readings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readingDate,
            indexValue: parseFloat(indexValue),
            source: "MANUEL",
            notes: notes || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-primary-dark">Saisir un relevé</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Site *
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              required
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Compteur */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Compteur *
            </label>
            {loadingMeters ? (
              <div className="flex items-center gap-2 py-2.5 text-sm text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Chargement des compteurs...
              </div>
            ) : meters.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Date du relevé *
                </label>
                <input
                  type="date"
                  required
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Index compteur ({selectedMeter.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={indexValue}
                  onChange={(e) => setIndexValue(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Ex: 15230.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Optionnel"
                />
              </div>
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
