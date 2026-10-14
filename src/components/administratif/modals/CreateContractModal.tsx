"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";

interface CreateContractModalProps {
  onClose: () => void;
  clientId?: string;
}

const input =
  "w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";

/**
 * Création d'un contrat : aucun champ obligatoire. On ouvre le dossier avec
 * ce qu'on sait, le reste se complète dans la fiche ou arrive avec l'AE.
 */
export default function CreateContractModal({ onClose, clientId }: CreateContractModalProps) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ reference: "", provider: "", startDate: "", endDate: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error("La date de fin est antérieure à la date de début");
      return;
    }
    setCreating(true);
    try {
      const created = await api.post<{ id: string }>("/api/contracts", {
        reference: form.reference || null,
        provider: form.provider || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isPublic: true, // Secteur public par défaut (collectivités), modifiable dans la fiche
        clientId: clientId || null,
      });
      if (created?.id && typeof window !== "undefined") {
        localStorage.setItem("myxploit-selected-contract-id", created.id);
      }
      onClose();
      window.location.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setCreating(false);
    }
  };

  return (
    <Modal
      title="Nouveau contrat"
      subtitle="Tous les champs sont facultatifs, ils se complètent ensuite dans la fiche."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => handleSubmit()} disabled={creating}>
            {creating && <Loader2 size={14} className="mr-2 animate-spin" />}
            Créer
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label-tech mb-1 block">Référence du marché</label>
          <input type="text" autoFocus value={form.reference} onChange={set("reference")} className={`${input} font-mono`} placeholder="2024-MC-012" />
        </div>
        <div>
          <label className="label-tech mb-1 block">Titulaire (exploitant)</label>
          <input type="text" value={form.provider} onChange={set("provider")} className={input} placeholder="Dalkia, Engie Solutions, Idex…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-tech mb-1 block">Début</label>
            <input type="date" value={form.startDate} onChange={set("startDate")} className={`${input} font-mono tabular-nums`} />
          </div>
          <div>
            <label className="label-tech mb-1 block">Fin</label>
            <input type="date" value={form.endDate} onChange={set("endDate")} min={form.startDate || undefined} className={`${input} font-mono tabular-nums`} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
