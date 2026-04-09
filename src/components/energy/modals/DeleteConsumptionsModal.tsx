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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="text-red-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-primary-dark">Supprimer les consommations</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 rounded-xl p-4">
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
              className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
