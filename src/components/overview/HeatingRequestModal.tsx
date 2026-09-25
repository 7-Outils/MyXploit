"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";
import type { ContractRecipient } from "@/lib/contract-recipients";
import type { HeatingSite, HeatingSwitchType } from "./heating-types";

interface Props {
  contractId: string;
  type: HeatingSwitchType;
  today: string;
  sites: HeatingSite[];
  recipients: ContractRecipient[];
  onClose: () => void;
  onSent: () => void;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

export default function HeatingRequestModal({ contractId, type, today, sites, recipients, onClose, onSent }: Props) {
  const toast = useToast();
  const isStart = type === "ALLUMAGE";
  const eligible = useMemo(
    () => sites.filter((s) => (isStart ? s.status === "ARRETE" : s.status === "EN_CHAUFFE")),
    [sites, isStart]
  );

  const [date, setDate] = useState(isStart ? addDays(today, 3) : today);
  const [checkedSites, setCheckedSites] = useState<Record<string, boolean>>(
    () => Object.fromEntries(eligible.map((s) => [s.id, true]))
  );
  const [checkedRecipients, setCheckedRecipients] = useState<Record<string, boolean>>(
    () => Object.fromEntries(recipients.map((r) => [r.email, true]))
  );
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedSiteIds = eligible.filter((s) => checkedSites[s.id]).map((s) => s.id);
  const allSitesChecked = selectedSiteIds.length === eligible.length;

  const submit = async () => {
    // Exploitants cochés + adresses libres = destinataires, clients cochés = copie.
    const extraList = extra.split(",").map((e) => e.trim()).filter(Boolean);
    let to = [
      ...recipients.filter((r) => checkedRecipients[r.email] && r.side === "EXPLOITANT").map((r) => r.email),
      ...extraList,
    ];
    let cc = recipients.filter((r) => checkedRecipients[r.email] && r.side === "CLIENT").map((r) => r.email);
    if (to.length === 0 && cc.length > 0) {
      to = cc;
      cc = [];
    }
    if (to.length === 0) {
      toast.error("Aucun destinataire");
      return;
    }
    if (selectedSiteIds.length === 0) {
      toast.error("Aucun site sélectionné");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/contracts/${contractId}/heating-requests`, {
        type,
        requestedDate: date,
        siteIds: selectedSiteIds,
        to,
        cc,
        message,
      });
      toast.success(`Demande d'${isStart ? "allumage" : "arrêt"} envoyée`);
      onSent();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isStart ? "Demander l'allumage du chauffage" : "Demander l'arrêt du chauffage"}
      subtitle="Un email est envoyé à l'exploitant ; la date devient provisoire sur les sites jusqu'à confirmation."
      onClose={onClose}
      size="lg"
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="w-full justify-center">
            Annuler
          </Button>
          <Button type="button" onClick={submit} disabled={busy} className="w-full justify-center">
            {busy ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              "Envoyer la demande"
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label-tech mb-1 block">{isStart ? "Allumage à partir du" : "Arrêt à partir du"}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-ink/20 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Adresses supplémentaires</span>
            <input
              type="text"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="email@exploitant.fr, …"
              className="w-full border border-ink/20 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label-tech">
              Sites <span className="tabular-nums">({selectedSiteIds.length}/{eligible.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setCheckedSites(Object.fromEntries(eligible.map((s) => [s.id, !allSitesChecked])))}
              className="label-tech hover:text-accent"
            >
              {allSitesChecked ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          {eligible.length === 0 ? (
            <p className="text-sm text-ink/50 border border-ink/10 px-3 py-2">
              {isStart ? "Aucun site à l'arrêt." : "Aucun site en chauffe."}
            </p>
          ) : (
            <div className="border border-ink/10 max-h-56 overflow-y-auto divide-y divide-ink/5">
              {eligible.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!checkedSites[s.id]}
                    onChange={(e) => setCheckedSites({ ...checkedSites, [s.id]: e.target.checked })}
                    className="accent-ink"
                  />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-ink/40 text-xs">{s.city}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="label-tech mb-1 block">Destinataires</span>
          {recipients.length === 0 ? (
            <p className="text-sm text-ink/50 border border-ink/10 px-3 py-2">
              Aucun contact dans le carnet du contrat. Saisissez une adresse ci-dessus.
            </p>
          ) : (
            <div className="border border-ink/10 divide-y divide-ink/5">
              {recipients.map((r) => (
                <label key={r.email} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!checkedRecipients[r.email]}
                    onChange={(e) => setCheckedRecipients({ ...checkedRecipients, [r.email]: e.target.checked })}
                    className="accent-ink"
                  />
                  <span className="label-tech w-10 shrink-0">{r.side === "EXPLOITANT" ? "À" : "Cc"}</span>
                  <span className="truncate">{r.name}</span>
                  <span className="text-ink/40 font-mono text-xs truncate">{r.email}</span>
                  {r.role && <span className="ml-auto text-ink/40 text-xs shrink-0">{r.role}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="block">
          <span className="label-tech mb-1 block">Message (optionnel)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full border border-ink/20 px-3 py-2 text-sm resize-y focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}
