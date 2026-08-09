"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteConsumptionsModal({
  contractName,
  onDelete,
  onClose,
}: {
  contractName: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full border border-ink/15 bg-white shadow-large max-w-md">
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <Trash2 className="text-red-600" size={18} />
            <h2 className="text-base font-semibold text-ink">Supprimer les consommations</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="border border-red-600/20 bg-red-50 p-3">
            <p className="text-sm text-red-800">
              <strong>Attention :</strong> Cette action est irréversible. Toutes les consommations du contrat seront supprimées.
            </p>
          </div>

          <p className="text-sm text-text-secondary">
            Vous êtes sur le point de supprimer toutes les consommations du contrat <strong>&quot;{contractName}&quot;</strong>.
          </p>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
              Annuler
            </Button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex flex-1 items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Supprimer tout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
