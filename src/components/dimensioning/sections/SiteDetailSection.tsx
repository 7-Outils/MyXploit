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
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Building2 className="text-accent" size={20} />
          <span>Détail par site ({result.bySite.length})</span>
        </button>
      }
    >
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Site
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Équip.
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  P2/an
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Heures
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  P3 GE/an
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  P3 R/an
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                  Total/an
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.bySite.map((site) => (
                <tr key={site.siteId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary-dark">{site.siteName}</p>
                    {site.renewalsCount > 0 && (
                      <span className="text-xs text-orange-600">
                        {site.renewalsCount} renouvellement(s)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{site.equipmentCount}</td>
                  <td className="px-4 py-3 text-right">{Math.round(site.p2Annual).toLocaleString()} €</td>
                  <td className="px-4 py-3 text-right text-gray-500">{site.hoursP2.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right">{Math.round(site.p3GEAnnual).toLocaleString()} €</td>
                  <td className="px-4 py-3 text-right text-purple-600">
                    {Math.round(site.p3RAnnual).toLocaleString()} €
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
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
