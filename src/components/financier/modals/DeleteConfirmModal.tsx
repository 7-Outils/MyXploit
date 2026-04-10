"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

export function DeleteConfirmModal({ onClose, onConfirm, deleting }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-primary-dark mb-2">Supprimer la facture ?</h3>
        <p className="text-text-secondary mb-6">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>
            Annuler
          </Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={onConfirm} disabled={deleting}>
            {deleting ? <Loader2 size={18} className="animate-spin" /> : "Supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
