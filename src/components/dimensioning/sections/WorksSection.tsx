import { AlertTriangle, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/pricing/equipment-pricing";
import { DimensioningResult } from "@/components/dimensioning/types";
import { URGENCY_CONFIG } from "@/components/dimensioning/constants";

interface WorksSectionProps {
  result: DimensioningResult;
  duration: number;
  expandedSections: { mandatory: boolean; renewals: boolean };
  toggleSection: (section: "mandatory" | "renewals") => void;
}

export function WorksSection({ result, duration, expandedSections, toggleSection }: WorksSectionProps) {
  return (
    <>
      {/* Mandatory works */}
      {result.mandatoryWorks.length > 0 && (
        <ChartCard
          title={
            <button
              onClick={() => toggleSection("mandatory")}
              className="flex items-center gap-2"
            >
              {expandedSections.mandatory ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <AlertTriangle className="text-red-500" size={20} />
              <span>Travaux obligatoires ({result.mandatoryWorks.length})</span>
            </button>
          }
          subtitle={`Urgence haute ou critique - Total: ${result.summary.totalMandatoryWorksCost.toLocaleString()} €`}
        >
          {expandedSections.mandatory && (
            <div className="space-y-3">
              {result.mandatoryWorks.map((work) => (
                <div
                  key={work.equipmentId}
                  className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-10 rounded ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.bgColor || "bg-gray-300"}`} />
                    <div>
                      <p className="font-medium text-primary-dark">
                        {EQUIPMENT_TYPE_LABELS[work.equipmentType] || work.equipmentType}
                      </p>
                      <p className="text-sm text-gray-500">{work.siteName}</p>
                      {work.notes.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">{work.notes[0]}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-red-600">
                      {work.replacementCost.toLocaleString()} €
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                      {URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      )}

      {/* All renewals */}
      {result.renewals.length > 0 && (
        <ChartCard
          title={
            <button
              onClick={() => toggleSection("renewals")}
              className="flex items-center gap-2"
            >
              {expandedSections.renewals ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <Calendar className="text-purple-500" size={20} />
              <span>Plan de renouvellement ({result.renewals.length})</span>
            </button>
          }
          subtitle={`Renouvellements prévus sur ${duration} ans`}
        >
          {expandedSections.renewals && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Équipement
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Site
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Année
                    </th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Urgence
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Coût
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">
                      Provision/an
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.renewals.map((renewal) => (
                    <tr key={renewal.equipmentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-primary-dark">
                          {EQUIPMENT_TYPE_LABELS[renewal.equipmentType] || renewal.equipmentType}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{renewal.siteName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium">{renewal.renewalYear || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                          {URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {renewal.replacementCost.toLocaleString()} €
                      </td>
                      <td className="px-4 py-3 text-right text-purple-600">
                        {renewal.annualProvision.toLocaleString()} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}
    </>
  );
}
