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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <FolderPlus className="text-accent" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary-dark">Créer un projet</h2>
              <p className="text-sm text-text-secondary">Sauvegarder ce dimensionnement</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Nom du projet / Marché
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ex: Marché Chauffage Lycées 2025-2033"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-primary-dark mb-2">Résumé du dimensionnement</p>
            <div className="space-y-1 text-gray-600">
              <p>{result.summary.siteCount} sites • {result.summary.equipmentCount} équipements</p>
              <p>Durée: {duration} ans ({startYear} - {startYear + duration})</p>
              <p className="font-medium text-accent">
                Budget total: {result.summary.totalContract.toLocaleString()} € HT
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Un contrat sera créé avec les sites et le dimensionnement calculé.
          </p>
        </div>

        <div className="p-6 border-t flex gap-3">
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
