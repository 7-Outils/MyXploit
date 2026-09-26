"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Check, Flame, Power, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";
import HeatingRequestModal from "./HeatingRequestModal";
import HeatingConfirmModal from "./HeatingConfirmModal";
import { fmtTemp, type HeatingStatusResponse, type HeatingSwitchType } from "./heating-types";

interface Props {
  contractId: string;
}

const iconBtn =
  "h-9 w-9 flex items-center justify-center border border-ink/20 text-ink/60 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:pointer-events-none";
const iconBtnPrimary =
  "h-9 w-9 flex items-center justify-center bg-ink text-paper hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none";

const fmtWeekday = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

const fmtDateLong = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

export default function HeatingSwitchPanel({ contractId }: Props) {
  const toast = useToast();
  const { data, mutate } = useSWR<HeatingStatusResponse>(
    `/api/contracts/${contractId}/heating-status`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [requestType, setRequestType] = useState<HeatingSwitchType | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!data || data.counts.total === 0) return null;

  const { counts, weather, pendingRequest, season, sites } = data;
  const signal = weather?.signal ?? "NEUTRAL";
  const allOff = counts.enChauffe === 0 && counts.allumagePrevu === 0 && counts.arretPrevu === 0;
  const anyOn = counts.enChauffe > 0;

  // ─── Phrase d'état + ton + actions ─────────────────────────────────────────
  let headline: string;
  let rule = "border-l-2 border-l-ink";
  let emphasis = "text-ink";
  let detail: React.ReactNode = null;
  const actions: React.ReactNode[] = [];

  if (pendingRequest) {
    const isStart = pendingRequest.type === "ALLUMAGE";
    headline = `${isStart ? "Allumage" : "Arrêt"} demandé pour le ${fmtDateLong(pendingRequest.requestedDate)} · ${pendingRequest.confirmed}/${pendingRequest.total} ${isStart ? "allumés" : "arrêtés"}`;
    rule = "border-l-2 border-l-amber-600";
    emphasis = "text-amber-700";
    detail = (
      <>
        Envoyée le {new Date(pendingRequest.sentAt).toLocaleDateString("fr-FR")} à{" "}
        <span className="font-mono">{pendingRequest.sentTo.to.join(", ")}</span>
      </>
    );
    actions.push(
      <button key="confirm" onClick={() => setConfirmOpen(true)} title={isStart ? "Confirmer l'allumage" : "Confirmer l'arrêt"} className={iconBtnPrimary}>
        <Check size={16} />
      </button>,
      <button
        key="cancel"
        onClick={async () => {
          if (!confirm("Annuler la demande ? Les dates provisoires seront retirées.")) return;
          setCancelling(true);
          try {
            await api.del(`/api/contracts/${contractId}/heating-requests/${pendingRequest.id}`);
            toast.success("Demande annulée");
            mutate();
          } catch (e) {
            toast.error(getErrorMessage(e));
          } finally {
            setCancelling(false);
          }
        }}
        disabled={cancelling}
        title="Annuler la demande"
        className={iconBtn}
      >
        <X size={16} />
      </button>
    );
  } else if (allOff) {
    if (signal === "START") {
      headline = "Il est temps d'allumer";
      rule = "border-l-2 border-l-accent";
      emphasis = "text-accent";
    } else {
      headline = `${counts.total} site${counts.total > 1 ? "s" : ""} à l'arrêt`;
    }
    actions.push(
      <button key="start" onClick={() => setRequestType("ALLUMAGE")} title="Demander l'allumage" className={signal === "START" ? iconBtnPrimary : iconBtn}>
        <Flame size={16} />
      </button>
    );
  } else {
    if (signal === "STOP" && anyOn) {
      headline = "Il est temps d'arrêter";
      rule = "border-l-2 border-l-accent";
      emphasis = "text-accent";
    } else if (counts.enChauffe === counts.total) {
      headline = `${counts.total} site${counts.total > 1 ? "s" : ""} en chauffe`;
    } else {
      headline = `${counts.enChauffe} site${counts.enChauffe > 1 ? "s" : ""} en chauffe sur ${counts.total}`;
    }
    if (counts.arrete > 0) {
      actions.push(
        <button key="start" onClick={() => setRequestType("ALLUMAGE")} title="Demander l'allumage des sites à l'arrêt" className={iconBtn}>
          <Flame size={16} />
        </button>
      );
    }
    if (anyOn) {
      actions.push(
        <button key="stop" onClick={() => setRequestType("ARRET")} title="Demander l'arrêt" className={signal === "STOP" ? iconBtnPrimary : iconBtn}>
          <Power size={16} />
        </button>
      );
    }
  }

  if (!detail) {
    if (weather) {
      const obs = fmtTemp(weather.observedMean5d);
      const prev = fmtTemp(weather.forecastMean7d);
      const lead =
        signal === "START"
          ? "Conditions d'allumage atteintes"
          : signal === "STOP"
            ? "Conditions d'arrêt atteintes"
            : allOff
              ? "Pas d'allumage à prévoir"
              : "Pas d'arrêt à prévoir";
      detail = (
        <>
          {lead} : <strong className="font-mono tabular-nums text-ink">{obs}</strong> en moyenne ces 5 jours,{" "}
          <strong className="font-mono tabular-nums text-ink">{prev}</strong> prévus sur 7 jours.
        </>
      );
    } else {
      detail = <>Météo indisponible : aucun site n&apos;a de coordonnées ni de station météo.</>;
    }
  }

  const forecast = weather ? weather.days.filter((d) => d.isForecast).slice(0, 7) : [];

  return (
    <>
      <div className={`panel ${rule} px-4 py-3`}>
        <div className="flex items-start gap-3">
          <Flame size={16} className="text-ink/40 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="label-tech">Chauffage · {season}</span>
              <span className={`text-sm font-semibold tabular-nums ${emphasis}`}>{headline}</span>
            </div>
            <p className="text-[12px] text-ink/50 mt-1 leading-snug">{detail}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
        </div>

        {forecast.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-ink/10">
            <div className="flex items-center justify-between">
              <span className="label-tech">Prévision 7 jours · moyenne journalière</span>
              <Link href={`/exploitation?tab=saisons&contractId=${contractId}`} className="label-tech hover:text-accent">
                Saisons de chauffe
              </Link>
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {forecast.map((d) => (
                <div key={d.date} className="text-center border border-ink/10 py-1">
                  <div className="text-[10px] uppercase tracking-wide text-ink/40">{fmtWeekday(d.date)}</div>
                  <div className="font-mono tabular-nums text-sm text-ink leading-tight">{Math.round(d.tMean)}°</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {requestType && (
        <HeatingRequestModal
          contractId={contractId}
          type={requestType}
          today={data.today}
          sites={sites}
          recipients={data.recipients}
          onClose={() => setRequestType(null)}
          onSent={() => mutate()}
        />
      )}
      {confirmOpen && pendingRequest && (
        <HeatingConfirmModal
          contractId={contractId}
          request={pendingRequest}
          sites={sites}
          onClose={() => setConfirmOpen(false)}
          onConfirmed={() => mutate()}
        />
      )}
    </>
  );
}
