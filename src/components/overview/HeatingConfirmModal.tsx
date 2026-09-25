"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";
import type { HeatingPendingRequest, HeatingSite } from "./heating-types";

interface Props {
  contractId: string;
  request: HeatingPendingRequest;
  sites: HeatingSite[];
  onClose: () => void;
  onConfirmed: () => void;
}

export default function HeatingConfirmModal({ contractId, request, sites, onClose, onConfirmed }: Props) {
  const toast = useToast();
  const isStart = request.type === "ALLUMAGE";
  const pending = useMemo(
    () => sites.filter((s) => request.pendingSiteIds.includes(s.id)),
    [sites, request.pendingSiteIds]
  );

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [dates, setDates] = useState<Record<string, string>>(
    () => Object.fromEntries(pending.map((s) => [s.id, request.requestedDate]))
  );
  const [busy, setBusy] = useState(false);

  const selected = pending.filter((s) => checked[s.id]);
  const allChecked = pending.length > 0 && selected.length === pending.length;

  const submit = async () => {
    if (selected.length === 0) {
      toast.error("Cochez au moins un site");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ confirmed: number; remaining: number; closed: boolean }>(
        `/api/contracts/${contractId}/heating-requests/${request.id}/confirm`,
        { sites: selected.map((s) => ({ siteId: s.id, date: dates[s.id] })) }
      );
      toast.success(
        res.closed
          ? `${isStart ? "Allumage" : "Arrêt"} confirmé sur tous les sites`
          : `${res.confirmed} site${res.confirmed > 1 ? "s" : ""} confirmé${res.confirmed > 1 ? "s" : ""}, ${res.remaining} en attente`
      );
      onConfirmed();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isStart ? "Confirmer l'allumage" : "Confirmer l'arrêt"}
      subtitle="Cochez les sites confirmés par l'exploitant et ajustez la date réelle si besoin."
      onClose={onClose}
      size="md"
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="w-full justify-center">
            Plus tard
          </Button>
          <Button type="button" onClick={submit} disabled={busy || selected.length === 0} className="w-full justify-center">
            {busy ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              `Confirmer${selected.length > 0 ? ` (${selected.length})` : ""}`
            )}
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className="label-tech">
          Sites en attente <span className="tabular-nums">({pending.length})</span>
        </span>
        <button
          type="button"
          onClick={() => setChecked(Object.fromEntries(pending.map((s) => [s.id, !allChecked])))}
          className="label-tech hover:text-accent"
        >
          {allChecked ? "Tout décocher" : "Tout cocher"}
        </button>
      </div>
      <div className="border border-ink/10 max-h-80 overflow-y-auto divide-y divide-ink/5">
        {pending.map((s) => (
          <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <input
              type="checkbox"
              checked={!!checked[s.id]}
              onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })}
              className="accent-ink"
            />
            <span className="flex-1 truncate">{s.name}</span>
            <input
              type="date"
              value={dates[s.id] ?? request.requestedDate}
              onChange={(e) => setDates({ ...dates, [s.id]: e.target.value })}
              className="border border-ink/20 px-2 py-1 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
