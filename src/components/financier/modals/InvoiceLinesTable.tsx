"use client";

import { AlertTriangle } from "lucide-react";
import type { InvoiceLineDraft, Site } from "@/components/financier/types";

/** Écart toléré entre la somme des lignes et le total — aligné sur le serveur. */
const TOLERANCE = 0.05;

const euros = (value: number) =>
  value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface InvoiceLinesTableProps {
  lines: InvoiceLineDraft[];
  /** Sites du contrat, seuls rattachements possibles. */
  contractSites: Site[];
  /** Seul le site se modifie : le libellé et le montant sont ce qui est écrit sur le PDF. */
  onChangeSite: (index: number, siteId: string) => void;
  /** Total HT de la facture, pour dire si la répartition retombe dessus. */
  amountHT: number | null;
  disabled?: boolean;
}

/**
 * Répartition site par site lue sur la facture. Affichée telle quelle : on ne
 * corrige ni les libellés ni les montants, on ne rattache que les sites — et
 * une ligne non rattachée reste enregistrable (site hors périmètre, site
 * absent du contrat).
 */
export function InvoiceLinesTable({
  lines,
  contractSites,
  onChangeSite,
  amountHT,
  disabled = false,
}: InvoiceLinesTableProps) {
  if (lines.length === 0) return null;

  const linesTotal = lines.reduce((sum, l) => sum + l.amountHT, 0);
  const unmatched = lines.filter((l) => !l.siteId).length;
  const gap = amountHT === null ? null : linesTotal - amountHT;
  const consistent = gap !== null && Math.abs(gap) <= TOLERANCE;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="label-tech">Répartition par site</span>
        <span className="text-[11px] text-text-secondary">lue sur le PDF</span>
      </div>

      {unmatched > 0 && (
        <div className="flex items-start gap-2 border border-[#f0b429]/40 bg-[rgba(250,178,25,0.10)] px-3 py-2 text-[11px] text-[#8a6200]">
          <AlertTriangle size={13} className="mt-px flex-shrink-0" />
          <span>
            {unmatched} ligne{unmatched > 1 ? "s" : ""} ne correspond
            {unmatched > 1 ? "ent" : ""} à aucun site du contrat — site manquant
            ou facturation hors périmètre.
          </span>
        </div>
      )}

      <div className="border border-ink/10">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-ink/10">
                <th className="label-tech px-2 py-1.5 text-left">Site lu</th>
                <th className="label-tech px-2 py-1.5 text-left">Site rattaché</th>
                <th className="label-tech px-2 py-1.5 text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.label}-${index}`} className="border-t border-ink/[0.06]">
                  <td className="px-2 py-1 text-[12px] text-ink/70">
                    <span className="block max-w-[14rem] truncate" title={line.label}>
                      {line.label}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <select
                        value={line.siteId}
                        onChange={(e) => onChangeSite(index, e.target.value)}
                        disabled={disabled}
                        className={`h-7 w-full max-w-[13rem] border px-1 text-[12px] focus:border-accent focus:outline-none ${
                          line.siteId ? "border-ink/20" : "border-[#f0b429] bg-[rgba(250,178,25,0.08)]"
                        }`}
                      >
                        <option value="">— non rattaché —</option>
                        {contractSites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                        {/* Site rattaché absent de la liste (chargement) : on le
                            garde plutôt que de retomber sur « non rattaché ». */}
                        {line.siteId && !contractSites.some((s) => s.id === line.siteId) && (
                          <option value={line.siteId}>…</option>
                        )}
                      </select>
                      {line.siteId && line.matchedBy && (
                        <span
                          className="border border-ink/15 px-1 font-mono text-[9px] uppercase text-ink/45"
                          title={
                            line.matchedBy === "alias"
                              ? "Rapprochement mémorisé lors d'un import précédent"
                              : "Rapprochement déduit du libellé"
                          }
                        >
                          {line.matchedBy}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-[12px] tabular-nums text-ink">
                    {euros(line.amountHT)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 bg-ink/[0.02] px-2 py-1.5">
          <span className="text-[11px] text-ink/60">
            {lines.length} ligne{lines.length > 1 ? "s" : ""}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[12px] font-medium tabular-nums text-ink">
              {euros(linesTotal)} €
            </span>
            {gap === null ? null : consistent ? (
              <span className="text-[11px] text-green-700">= total ✓</span>
            ) : (
              <span className="text-[11px] text-[#8a6200]">
                ≠ total (écart {euros(Math.abs(gap))} €)
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
