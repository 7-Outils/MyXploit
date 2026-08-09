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
              {expandedSections.mandatory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <AlertTriangle className="text-red-600" size={14} />
              <span>Travaux obligatoires ({result.mandatoryWorks.length})</span>
            </button>
          }
          subtitle={`Urgence haute ou critique — Total : ${result.summary.totalMandatoryWorksCost.toLocaleString()} €`}
        >
          {expandedSections.mandatory && (
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {result.mandatoryWorks.map((work) => (
                <div
                  key={work.equipmentId}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-1 ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.bgColor || "bg-ink/15"}`} />
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {EQUIPMENT_TYPE_LABELS[work.equipmentType] || work.equipmentType}
                      </p>
                      <p className="text-xs text-ink/50">{work.siteName}</p>
                      {work.notes.length > 0 && (
                        <p className="mt-0.5 text-xs text-red-600">{work.notes[0]}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                      {URGENCY_CONFIG[work.urgency as keyof typeof URGENCY_CONFIG]?.label}
                    </span>
                    <p className="font-mono text-base font-semibold tabular-nums text-ink">
                      {work.replacementCost.toLocaleString()} €
                    </p>
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
              {expandedSections.renewals ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Calendar className="text-ink/40" size={14} />
              <span>Plan de renouvellement ({result.renewals.length})</span>
            </button>
          }
          subtitle={`Renouvellements prévus sur ${duration} ans`}
        >
          {expandedSections.renewals && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="label-tech px-3 py-2 text-left font-normal">Équipement</th>
                    <th className="label-tech px-3 py-2 text-left font-normal">Site</th>
                    <th className="label-tech px-3 py-2 text-center font-normal">Année</th>
                    <th className="label-tech px-3 py-2 text-center font-normal">Urgence</th>
                    <th className="label-tech px-3 py-2 text-right font-normal">Coût</th>
                    <th className="label-tech px-3 py-2 text-right font-normal">Provision/an</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {result.renewals.map((renewal) => (
                    <tr key={renewal.equipmentId} className="hover:bg-ink/[0.02]">
                      <td className="px-3 py-2 font-medium text-ink">
                        {EQUIPMENT_TYPE_LABELS[renewal.equipmentType] || renewal.equipmentType}
                      </td>
                      <td className="px-3 py-2 text-ink/50">{renewal.siteName}</td>
                      <td className="px-3 py-2 text-center font-mono tabular-nums text-ink">
                        {renewal.renewalYear || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.color}`}>
                          {URGENCY_CONFIG[renewal.urgency as keyof typeof URGENCY_CONFIG]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium tabular-nums text-ink">
                        {renewal.replacementCost.toLocaleString()} €
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink/60">
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
