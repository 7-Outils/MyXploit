import { FolderPlus, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DimensioningResult } from "@/components/dimensioning/types";

interface SaveProjectModalProps {
  result: DimensioningResult;
  duration: number;
  startYear: number;
  projectName: string;
  setProjectName: (name: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function SaveProjectModal({
  result,
  duration,
  startYear,
  projectName,
  setProjectName,
  saving,
  onSave,
  onClose,
}: SaveProjectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full max-w-md border border-ink/15 bg-white shadow-large">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="text-accent" size={18} />
            <div>
              <h2 className="text-base font-semibold text-ink">Créer un projet</h2>
              <p className="text-sm text-ink/50">Sauvegarder ce dimensionnement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="label-tech mb-1.5 block">
              Nom du projet / marché
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ex: Marché Chauffage Lycées 2025-2033"
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>

          <div className="border border-ink/10 px-4 py-3 text-sm">
            <p className="label-tech mb-2">Résumé du dimensionnement</p>
            <div className="space-y-1 text-ink/60">
              <p className="font-mono tabular-nums">
                {result.summary.siteCount} sites · {result.summary.equipmentCount} équipements
              </p>
              <p className="font-mono tabular-nums">
                Durée : {duration} ans ({startYear} – {startYear + duration})
              </p>
              <p className="font-mono font-medium tabular-nums text-accent">
                Budget total : {result.summary.totalContract.toLocaleString()} € HT
              </p>
            </div>
          </div>

          <p className="text-xs text-ink/50">
            Un contrat sera créé avec les sites et le dimensionnement calculé.
          </p>
        </div>

        <div className="flex gap-3 border-t border-ink/10 px-5 py-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!projectName.trim() || saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Créer le projet
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
