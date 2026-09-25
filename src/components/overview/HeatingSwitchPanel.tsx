"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Check, Flame, Power, X } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { useToast } from "@/components/ui/toast";
import { api, getErrorMessage } from "@/lib/api-client";
import { HEATING_START_THRESHOLD, HEATING_STOP_THRESHOLD } from "@/lib/heating-season";
import HeatingRequestModal from "./HeatingRequestModal";
import HeatingConfirmModal from "./HeatingConfirmModal";
import { fmtDay, fmtTemp, type HeatingStatusResponse, type HeatingSwitchType } from "./heating-types";

interface Props {
  contractId: string;
}

const iconBtn =
  "h-9 w-9 flex items-center justify-center border border-ink/20 text-ink/60 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:pointer-events-none";
const iconBtnPrimary =
  "h-9 w-9 flex items-center justify-center bg-ink text-paper hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none";

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
      headline = `Installations à l'arrêt · ${counts.arrete}/${counts.total}`;
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
      headline = `Installations allumées · ${counts.enChauffe}/${counts.total}`;
    } else {
      headline = `${counts.enChauffe}/${counts.total} allumées`;
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
    detail = weather ? (
      <>
        T° moy 5 j <strong className="font-mono tabular-nums text-ink">{fmtTemp(weather.observedMean5d)}</strong>
        {" · "}prévision 7 j <strong className="font-mono tabular-nums text-ink">{fmtTemp(weather.forecastMean7d)}</strong>
        {" · "}seuils <span className="font-mono tabular-nums">{HEATING_START_THRESHOLD} / {HEATING_STOP_THRESHOLD}</span>
      </>
    ) : (
      <>Météo indisponible (pas de coordonnées ni de station sur les sites).</>
    );
  }

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

        {weather && weather.days.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-ink/10 grid gap-1" style={{ gridTemplateColumns: `repeat(${weather.days.length}, minmax(0, 1fr))` }}>
            {weather.days.map((d) => (
              <div key={d.date} className={`text-center ${d.isForecast ? "text-ink/40" : "text-ink/70"}`} title={d.isForecast ? "Prévision" : "Observé"}>
                <div className="label-tech !text-[9px] !tracking-wider">{fmtDay(d.date)}</div>
                <div className="font-mono tabular-nums text-[11px] leading-tight">
                  {Math.round(d.tMin)}<span className="text-ink/30">/</span>{Math.round(d.tMax)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-ink/40 tabular-nums">
            {counts.enChauffe} en chauffe · {counts.arrete} à l&apos;arrêt
            {counts.allumagePrevu > 0 && ` · ${counts.allumagePrevu} allumage prévu`}
            {counts.arretPrevu > 0 && ` · ${counts.arretPrevu} arrêt prévu`}
          </span>
          <Link href={`/exploitation?tab=saisons&contractId=${contractId}`} className="label-tech hover:text-accent">
            Saisons de chauffe
          </Link>
        </div>
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
