import { ChartCard } from "@/components/dashboard/chart-card";
import { DimensioningResult } from "@/components/dimensioning/types";

interface BudgetSectionProps {
  result: DimensioningResult;
  duration: number;
}

export function BudgetSection({ result, duration }: BudgetSectionProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Annuel */}
      <ChartCard title="Budget annuel" subtitle="Répartition P2/P3">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="font-medium text-primary-dark">P2 - Petit entretien</p>
              <p className="text-sm text-gray-500">{result.summary.totalHoursP2} heures/an</p>
            </div>
            <p className="text-xl font-bold text-blue-600">
              {result.summary.totalP2Annual.toLocaleString()} €
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg">
            <div>
              <p className="font-medium text-primary-dark">P3 GE - Gros entretien</p>
              <p className="text-sm text-gray-500">Maintenance lourde annuelle</p>
            </div>
            <p className="text-xl font-bold text-accent">
              {result.summary.totalP3GEAnnual.toLocaleString()} €
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
            <div>
              <p className="font-medium text-primary-dark">P3 R - Renouvellement</p>
              <p className="text-sm text-gray-500">
                Provision pour {result.summary.renewalsCount} renouvellements
              </p>
            </div>
            <p className="text-xl font-bold text-purple-600">
              {result.summary.totalP3RAnnual.toLocaleString()} €
            </p>
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <p className="font-bold text-lg text-primary-dark">TOTAL ANNUEL</p>
            <p className="text-2xl font-bold text-primary-dark">
              {result.summary.totalAnnual.toLocaleString()} €
            </p>
          </div>
        </div>
      </ChartCard>

      {/* Sur durée du marché */}
      <ChartCard title={`Budget sur ${duration} ans`} subtitle="Total marché">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p className="text-primary-dark">P2 Total</p>
            <p className="font-bold">{result.summary.totalP2Contract.toLocaleString()} €</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p className="text-primary-dark">P3 GE Total</p>
            <p className="font-bold">{result.summary.totalP3GEContract.toLocaleString()} €</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <p className="text-primary-dark">P3 R Total</p>
            <p className="font-bold">{result.summary.totalP3RContract.toLocaleString()} €</p>
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <p className="font-bold text-lg text-primary-dark">TOTAL MARCHE</p>
            <p className="text-2xl font-bold text-accent">
              {result.summary.totalContract.toLocaleString()} €
            </p>
          </div>

          {/* Visual bar */}
          <div className="mt-4">
            <div className="h-6 rounded-full overflow-hidden flex">
              <div
                className="bg-blue-500 h-full"
                style={{
                  width: `${(result.summary.totalP2Contract / result.summary.totalContract) * 100}%`,
                }}
                title="P2"
              />
              <div
                className="bg-accent h-full"
                style={{
                  width: `${(result.summary.totalP3GEContract / result.summary.totalContract) * 100}%`,
                }}
                title="P3 GE"
              />
              <div
                className="bg-purple-500 h-full"
                style={{
                  width: `${(result.summary.totalP3RContract / result.summary.totalContract) * 100}%`,
                }}
                title="P3 R"
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                P2 ({Math.round((result.summary.totalP2Contract / result.summary.totalContract) * 100)}%)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-accent rounded" />
                P3 GE ({Math.round((result.summary.totalP3GEContract / result.summary.totalContract) * 100)}%)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded" />
                P3 R ({Math.round((result.summary.totalP3RContract / result.summary.totalContract) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
