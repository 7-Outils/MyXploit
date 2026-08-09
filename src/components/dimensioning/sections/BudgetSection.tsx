import { ChartCard } from "@/components/dashboard/chart-card";
import { DimensioningResult } from "@/components/dimensioning/types";

interface BudgetSectionProps {
  result: DimensioningResult;
  duration: number;
}

export function BudgetSection({ result, duration }: BudgetSectionProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Annuel */}
      <ChartCard title="Budget annuel" subtitle="Répartition P2/P3">
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">P2 — Petit entretien</p>
              <p className="font-mono text-xs tabular-nums text-ink/50">
                {result.summary.totalHoursP2} heures/an
              </p>
            </div>
            <p className="font-mono text-base font-semibold tabular-nums text-ink">
              {result.summary.totalP2Annual.toLocaleString()} €
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">P3 GE — Gros entretien</p>
              <p className="text-xs text-ink/50">Maintenance lourde annuelle</p>
            </div>
            <p className="font-mono text-base font-semibold tabular-nums text-ink">
              {result.summary.totalP3GEAnnual.toLocaleString()} €
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">P3 R — Renouvellement</p>
              <p className="text-xs text-ink/50">
                Provision pour {result.summary.renewalsCount} renouvellements
              </p>
            </div>
            <p className="font-mono text-base font-semibold tabular-nums text-ink">
              {result.summary.totalP3RAnnual.toLocaleString()} €
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="label-tech">Total annuel</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-ink">
            {result.summary.totalAnnual.toLocaleString()} €
          </p>
        </div>
      </ChartCard>

      {/* Sur durée du marché */}
      <ChartCard title={`Budget sur ${duration} ans`} subtitle="Total marché">
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {[
            ["P2 total", result.summary.totalP2Contract],
            ["P3 GE total", result.summary.totalP3GEContract],
            ["P3 R total", result.summary.totalP3RContract],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between gap-4 py-2.5">
              <p className="text-sm text-ink">{label}</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                {(value as number).toLocaleString()} €
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="label-tech">Total marché</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-accent">
            {result.summary.totalContract.toLocaleString()} €
          </p>
        </div>

        {/* Répartition : barre empilée encre / accent */}
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden border border-ink/10">
            <div
              className="h-full bg-ink"
              style={{
                width: `${(result.summary.totalP2Contract / result.summary.totalContract) * 100}%`,
              }}
              title="P2"
            />
            <div
              className="h-full bg-accent"
              style={{
                width: `${(result.summary.totalP3GEContract / result.summary.totalContract) * 100}%`,
              }}
              title="P3 GE"
            />
            <div
              className="h-full bg-accent/35"
              style={{
                width: `${(result.summary.totalP3RContract / result.summary.totalContract) * 100}%`,
              }}
              title="P3 R"
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-widest text-ink/50">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-ink" />
              P2 ({Math.round((result.summary.totalP2Contract / result.summary.totalContract) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-accent" />
              P3 GE ({Math.round((result.summary.totalP3GEContract / result.summary.totalContract) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-accent/35" />
              P3 R ({Math.round((result.summary.totalP3RContract / result.summary.totalContract) * 100)}%)
            </span>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
