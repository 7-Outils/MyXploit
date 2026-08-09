import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DimensioningResult } from "@/components/dimensioning/types";

interface SiteDetailSectionProps {
  result: DimensioningResult;
  expanded: boolean;
  toggleSection: () => void;
}

export function SiteDetailSection({ result, expanded, toggleSection }: SiteDetailSectionProps) {
  return (
    <ChartCard
      title={
        <button
          onClick={toggleSection}
          className="flex items-center gap-2"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Building2 className="text-ink/40" size={14} />
          <span>Détail par site ({result.bySite.length})</span>
        </button>
      }
    >
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="label-tech px-3 py-2 text-left font-normal">Site</th>
                <th className="label-tech px-3 py-2 text-center font-normal">Équip.</th>
                <th className="label-tech px-3 py-2 text-right font-normal">P2/an</th>
                <th className="label-tech px-3 py-2 text-right font-normal">Heures</th>
                <th className="label-tech px-3 py-2 text-right font-normal">P3 GE/an</th>
                <th className="label-tech px-3 py-2 text-right font-normal">P3 R/an</th>
                <th className="label-tech px-3 py-2 text-right font-normal">Total/an</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/[0.06]">
              {result.bySite.map((site) => (
                <tr key={site.siteId} className="hover:bg-ink/[0.02]">
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink">{site.siteName}</p>
                    {site.renewalsCount > 0 && (
                      <span className="text-xs text-amber-600">
                        {site.renewalsCount} renouvellement(s)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-mono tabular-nums text-ink/50">
                    {site.equipmentCount}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {Math.round(site.p2Annual).toLocaleString()} €
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/50">
                    {site.hoursP2.toFixed(1)} h
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {Math.round(site.p3GEAnnual).toLocaleString()} €
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {Math.round(site.p3RAnnual).toLocaleString()} €
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-ink">
                    {Math.round(site.p2Annual + site.p3GEAnnual + site.p3RAnnual).toLocaleString()} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}
