"use client";

import Link from "next/link";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { SiteDetail } from "@/components/buildings/types";
import {
  SITE_TYPE_LABELS,
  ENERGY_CONFIG,
  INSULATION_LABELS,
  GLAZING_LABELS,
  VENTILATION_LABELS,
} from "@/components/buildings/constants";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function GeneralTab({
  site,
  onRefresh,
}: {
  site: SiteDetail;
  onRefresh: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Informations générales */}
      <ChartCard title="Informations générales">
        <div className="space-y-4">
          <InfoRow label="Nom" value={site.name} />
          <InfoRow
            label="Type"
            value={SITE_TYPE_LABELS[site.type] || site.type}
          />
          <InfoRow
            label="Adresse"
            value={`${site.address}, ${site.city} ${site.postalCode}`}
          />
          <InfoRow
            label="Énergie"
            value={ENERGY_CONFIG[site.energyType]?.label || site.energyType}
          />
          {site.stationMeteo && (
            <InfoRow label="Station météo" value={site.stationMeteo} />
          )}
        </div>
      </ChartCard>

      {/* Caractéristiques du bâtiment */}
      <ChartCard title="Caractéristiques du bâtiment">
        <div className="space-y-4">
          {site.constructionYear && (
            <InfoRow
              label="Année de construction"
              value={String(site.constructionYear)}
            />
          )}
          <InfoRow
            label="Surface totale"
            value={
              site.surface ? `${site.surface.toLocaleString()} m²` : "-"
            }
          />
          <InfoRow
            label="Surface chauffée"
            value={
              site.surfaceChauffee
                ? `${site.surfaceChauffee.toLocaleString()} m²`
                : "-"
            }
          />
          <InfoRow
            label="Volume chauffé"
            value={
              site.volumeChauffee
                ? `${site.volumeChauffee.toLocaleString()} m³`
                : "-"
            }
          />
          {site.numberOfFloors && (
            <InfoRow
              label="Nombre d'étages"
              value={String(site.numberOfFloors)}
            />
          )}
          {site.buildingHeight && (
            <InfoRow
              label="Hauteur"
              value={`${site.buildingHeight} m`}
            />
          )}
          {site.insulationLevel && (
            <InfoRow
              label="Isolation"
              value={INSULATION_LABELS[site.insulationLevel] || site.insulationLevel}
            />
          )}
          {site.glazingType && (
            <InfoRow
              label="Vitrage"
              value={GLAZING_LABELS[site.glazingType] || site.glazingType}
            />
          )}
          {site.ventilationType && (
            <InfoRow
              label="Ventilation"
              value={VENTILATION_LABELS[site.ventilationType] || site.ventilationType}
            />
          )}
        </div>
      </ChartCard>

      {/* Références énergie */}
      <ChartCard title="Références énergie">
        <div className="space-y-4">
          {site.pce && <InfoRow label="PCE (gaz)" value={site.pce} />}
          {site.pdl && <InfoRow label="PDL (élec)" value={site.pdl} />}
          {site.rae && <InfoRow label="RAE" value={site.rae} />}
          {site.nb != null && (
            <InfoRow
              label="Niveau de Base"
              value={`${site.nb} ${site.nbUnit === "PCS" ? "MWh PCS" : "MWh utile"}`}
            />
          )}
          {site.djuContractuel != null && (
            <InfoRow
              label="DJU contractuels"
              value={`${site.djuContractuel}`}
            />
          )}
        </div>
      </ChartCard>

      {/* Contrats liés */}
      <ChartCard title="Contrats associés">
        <div className="space-y-3">
          {site.contractSites.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun contrat lié</p>
          ) : (
            site.contractSites.map((cs) => (
              <Link
                key={cs.id}
                href={`/contracts/${cs.contract.id}`}
                className="block p-3 rounded-lg border border-gray-100 hover:border-accent/30 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cs.contract.reference}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cs.contract.title} - {cs.contract.provider}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {cs.hasP1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        P1
                      </span>
                    )}
                    {cs.hasP2 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                        P2
                      </span>
                    )}
                    {cs.hasP3 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium">
                        P3
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Type : {cs.contractType}
                </p>
              </Link>
            ))
          )}
        </div>
      </ChartCard>
    </div>
  );
}
