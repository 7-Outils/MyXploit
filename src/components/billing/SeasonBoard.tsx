"use client";

/**
 * Planche de saison de l'échéancier : une rangée par ligne de facturation,
 * 12 colonnes-mois (premier mois de la saison à gauche), chaque facture
 * attendue dessinée comme un bloc couvrant sa période, coloré par statut.
 * Un trait vertical marque aujourd'hui.
 *
 * Partagée par Contrat › Facturation (éditable) et le bandeau de Finances
 * (lecture seule, dépliée).
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  HATCH,
  MONTHS_LONG,
  MONTHS_SHORT,
  STATUS_BLOCK,
  STATUS_LABELS,
  day,
  daysLate,
  expectedShortLabel,
  formatDate,
  formatEuro,
  formatEuroCompact,
  formatPeriod,
  lineSentence,
  type BillingLine,
  type ExpectedInvoice,
  type ExpectedStatus,
  type SeasonInfo,
} from "./shared";

// ─── Géométrie ──────────────────────────────────────────────────────────────

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Position d'une date en mois (fractionnaires) depuis le début de saison. */
function monthPos(d: Date, start: Date): number {
  return (
    (d.getFullYear() - start.getFullYear()) * 12 +
    d.getMonth() -
    start.getMonth() +
    (d.getDate() - 1) / daysInMonth(d) -
    (start.getDate() - 1) / daysInMonth(start)
  );
}

const pct = (months: number) => `${Math.max(0, Math.min(100, (months / 12) * 100))}%`;

/** Position (0-12) d'aujourd'hui dans la saison, ou null si hors saison. */
export function todayPos(season: SeasonInfo, today = new Date()): number | null {
  const s = day(season.start);
  const p = monthPos(new Date(today.getFullYear(), today.getMonth(), today.getDate()), s);
  return p >= 0 && p <= 12 ? p : null;
}

// ─── Info-bulle ─────────────────────────────────────────────────────────────

interface Tip {
  e: ExpectedInvoice;
  line?: BillingLine;
  x: number;
  y: number;
}

function TipCard({ tip }: { tip: Tip }) {
  const { e } = tip;
  const late = e.status === "EN_RETARD" ? daysLate(e.dueDate) : 0;
  const statusColor =
    e.status === "EN_RETARD" ? "text-red-700" : e.status === "RECUE" ? "text-ink" : "text-ink/50";
  return (
    <div
      className="pointer-events-none fixed z-[90] w-64 -translate-x-1/2 -translate-y-full border border-ink/15 bg-white px-3 py-2 text-xs animate-fade-in"
      style={{ left: tip.x, top: tip.y - 8 }}
      role="tooltip"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono font-semibold text-ink">{expectedShortLabel(e)}</span>
        <span className={cn("label-tech !tracking-wider", statusColor)}>{STATUS_LABELS[e.status]}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink/60">
        <span>Période</span>
        <span className="text-right font-mono tabular-nums text-ink">{formatPeriod(e.periodStart, e.periodEnd)}</span>
        <span>Limite</span>
        <span className={cn("text-right font-mono tabular-nums", e.status === "EN_RETARD" ? "text-red-700" : "text-ink")}>
          {formatDate(e.dueDate)}
          {late > 0 && ` (+${late} j)`}
        </span>
      </div>
      {(e.invoices ?? []).length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-ink/10 pt-1.5">
          {(e.invoices ?? []).map((inv) => (
            <div key={inv.id} className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-ink">{inv.reference || "sans réf."}</span>
              <span className="font-mono tabular-nums text-ink">{formatEuro(inv.amount)}</span>
            </div>
          ))}
          {(e.invoices ?? []).length > 1 && (
            <div className="flex justify-between border-t border-ink/10 pt-0.5 font-mono tabular-nums font-semibold text-ink">
              <span>Total</span>
              <span>{formatEuro(e.amount)}</span>
            </div>
          )}
        </div>
      )}
      {e.status === "RECUE" && <div className="mt-1.5 text-[10px] text-accent">Ouvrir dans Finances</div>}
    </div>
  );
}

// ─── Piste d'une ligne ──────────────────────────────────────────────────────

function blockContent(e: ExpectedInvoice, wide: boolean): ReactNode {
  if (e.status === "RECUE") return e.amount ? formatEuroCompact(e.amount) : "reçue";
  if (e.status === "EN_RETARD") {
    const d = daysLate(e.dueDate);
    return d > 0 ? `+${d} j` : "retard";
  }
  if (e.status === "ATTENDUE") {
    const due = day(e.dueDate);
    return wide ? `≤ ${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}` : "";
  }
  return wide && e.count > 1 ? `${e.index}/${e.count}` : "";
}

interface TrackProps {
  season: SeasonInfo;
  expected: ExpectedInvoice[];
  line?: BillingLine;
  onTip?: (tip: Tip | null) => void;
  /** Aperçu (formulaire) : blocs en pointillé accent, sans statut. */
  preview?: boolean;
  /** Décale l'animation d'apparition (cascade entre rangées). */
  delayBase?: number;
  height?: string;
}

export function Track({ season, expected, line, onTip, preview, delayBase = 0, height = "h-11" }: TrackProps) {
  const start = day(season.start);
  const today = todayPos(season);

  return (
    <div className={cn("relative", height)}>
      {/* Grille des mois */}
      <div className="absolute inset-0 grid grid-cols-12">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={cn("border-l border-ink/[0.06]", i % 2 === 1 && "bg-ink/[0.015]")} />
        ))}
      </div>

      {expected.map((e, i) => {
        const pS = day(e.periodStart);
        const pE = day(e.periodEnd);
        const pEnd1 = new Date(pE.getFullYear(), pE.getMonth(), pE.getDate() + 1);
        const left = monthPos(pS, start);
        const right = monthPos(pEnd1, start);
        const widthMonths = right - left;
        const wide = widthMonths >= 2;
        const content = preview ? "" : blockContent(e, wide);
        const style = {
          left: `calc(${pct(left)} + 2px)`,
          width: `calc(${pct(widthMonths)} - 4px)`,
          animationDelay: `${delayBase + i * 35}ms`,
          ...(e.status === "ATTENDUE" && !preview ? HATCH : {}),
        };
        const cls = cn(
          "absolute inset-y-2 flex origin-left animate-grow-x items-center justify-center overflow-hidden px-1 font-mono text-[10px] tabular-nums leading-none whitespace-nowrap outline-none transition-[filter,box-shadow]",
          preview ? "border border-dashed border-accent/60 bg-accent/[0.04]" : STATUS_BLOCK[e.status],
          "focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1"
        );
        const handlers = onTip
          ? {
              onMouseEnter: (ev: React.MouseEvent<HTMLElement>) => {
                const r = ev.currentTarget.getBoundingClientRect();
                onTip({ e, line, x: r.left + r.width / 2, y: r.top });
              },
              onMouseLeave: () => onTip(null),
              onFocus: (ev: React.FocusEvent<HTMLElement>) => {
                const r = ev.currentTarget.getBoundingClientRect();
                onTip({ e, line, x: r.left + r.width / 2, y: r.top });
              },
              onBlur: () => onTip(null),
            }
          : {};
        return (
          <div key={e.key}>
            {e.status === "RECUE" && !preview ? (
              <Link
                href="/financier?tab=facturation"
                className={cn(cls, "hover:bg-accent hover:border-accent")}
                style={style}
                aria-label={`${expectedShortLabel(e)} — ${formatEuro(e.amount)}`}
                {...handlers}
              >
                {content}
              </Link>
            ) : (
              <div
                className={cls}
                style={style}
                tabIndex={onTip ? 0 : undefined}
                aria-label={`${expectedShortLabel(e)} — ${STATUS_LABELS[e.status]}`}
                {...handlers}
              >
                {content}
              </div>
            )}
          </div>
        );
      })}

      {/* Aujourd'hui */}
      {today != null && (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: pct(today) }} />
      )}
    </div>
  );
}

// ─── En-tête des mois ───────────────────────────────────────────────────────

export function MonthHeader({ season }: { season: SeasonInfo }) {
  const start = day(season.start);
  const now = new Date();
  const today = todayPos(season);
  return (
    <div className="relative grid h-9 grid-cols-12">
      {Array.from({ length: 12 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const isNow = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        const showYear = i === 0 || d.getMonth() === 0;
        return (
          <div
            key={i}
            title={`${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`}
            className={cn(
              "flex flex-col justify-end border-l border-ink/[0.06] px-1.5 pb-1 font-mono text-[10px] uppercase tracking-wider",
              isNow ? "text-accent" : "text-ink/45"
            )}
          >
            <span className={cn("leading-none", showYear ? "text-ink/35" : "text-transparent")}>{d.getFullYear()}</span>
            <span className="mt-0.5 leading-none">{MONTHS_SHORT[d.getMonth()].replace(".", "")}</span>
          </div>
        );
      })}
      {today != null && (
        <div className="pointer-events-none absolute inset-y-0" style={{ left: pct(today) }}>
          <span className="absolute bottom-0 h-2 w-px bg-accent" />
        </div>
      )}
    </div>
  );
}

// ─── Planche ────────────────────────────────────────────────────────────────

export function LineLabel({ line }: { line: BillingLine }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-ink">{line.label}</div>
      <div className="truncate font-mono text-[10px] uppercase tracking-wider text-ink/45">{lineSentence(line)}</div>
    </div>
  );
}

interface SeasonBoardProps {
  season: SeasonInfo;
  lines: BillingLine[];
  expectedByLine: Map<string, ExpectedInvoice[]>;
  /** Actions au survol de la rangée (éditer, supprimer). */
  renderActions?: (line: BillingLine) => ReactNode;
  /** Rangée en cours d'édition : remplacée par ce nœud. */
  editingId?: string | null;
  renderEditor?: (line: BillingLine) => ReactNode;
  /** Rangées tout juste ajoutées : brève surbrillance. */
  freshIds?: Set<string>;
  footer?: ReactNode;
  labelWidth?: number;
}

export function SeasonBoard({
  season,
  lines,
  expectedByLine,
  renderActions,
  editingId,
  renderEditor,
  freshIds,
  footer,
  labelWidth = 260,
}: SeasonBoardProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const cols = `${labelWidth}px minmax(0,1fr) 64px`;

  const tally = useMemo(() => {
    const t = new Map<string, { got: number; n: number; late: number }>();
    for (const l of lines) {
      const list = expectedByLine.get(l.id) ?? [];
      t.set(l.id, {
        got: list.filter((e) => e.status === "RECUE").length,
        n: list.length,
        late: list.filter((e) => e.status === "EN_RETARD").length,
      });
    }
    return t;
  }, [lines, expectedByLine]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        {/* En-tête */}
        <div className="grid border-b border-ink/10" style={{ gridTemplateColumns: cols }}>
          <div className="label-tech flex items-end px-4 pb-1.5">Ligne</div>
          <MonthHeader season={season} />
          <div className="label-tech flex items-end justify-end px-3 pb-1.5">Reçu</div>
        </div>

        {/* Rangées */}
        <div className="divide-y divide-ink/[0.07]" key={season.key}>
          {lines.map((line, row) => {
            if (editingId === line.id && renderEditor) {
              return <div key={line.id}>{renderEditor(line)}</div>;
            }
            const t = tally.get(line.id) ?? { got: 0, n: 0, late: 0 };
            const pending = line.id.startsWith("tmp-");
            return (
              <div
                key={line.id}
                className={cn(
                  "group grid items-stretch transition-colors hover:bg-ink/[0.015]",
                  freshIds?.has(line.id) && "animate-row-flash",
                  pending && "opacity-60"
                )}
                style={{ gridTemplateColumns: cols }}
              >
                <div className="flex min-w-0 items-center justify-between gap-1 py-1.5 pl-4 pr-2">
                  <LineLabel line={line} />
                  {renderActions && !pending && (
                    <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {renderActions(line)}
                    </div>
                  )}
                </div>
                <Track
                  season={season}
                  expected={expectedByLine.get(line.id) ?? []}
                  line={line}
                  onTip={setTip}
                  delayBase={row * 60}
                />
                <div
                  className={cn(
                    "flex items-center justify-end px-3 font-mono text-xs tabular-nums",
                    t.late > 0 ? "text-red-700" : t.n > 0 && t.got === t.n ? "text-ink" : "text-ink/50"
                  )}
                  title={`${t.got} reçue(s) sur ${t.n} attendue(s) cette saison`}
                >
                  {t.got}/{t.n}
                </div>
              </div>
            );
          })}
        </div>
        {footer}
      </div>
      {tip && <TipCard tip={tip} />}
    </div>
  );
}

// ─── Légende ────────────────────────────────────────────────────────────────

export function BoardLegend() {
  const item = (status: ExpectedStatus, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-4", STATUS_BLOCK[status])} style={status === "ATTENDUE" ? HATCH : undefined} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-ink/50">
      {item("RECUE", "Reçue")}
      {item("ATTENDUE", "Attendue")}
      {item("EN_RETARD", "En retard")}
      {item("A_VENIR", "À venir")}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-px bg-accent" />
        Aujourd&apos;hui
      </span>
    </div>
  );
}
