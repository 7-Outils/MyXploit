"use client";

import { Building2, Plus, Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

const sites = [
  {
    id: 1,
    name: "Lycée Jean Moulin",
    address: "12 rue de la République, 75001 Paris",
    type: "Établissement scolaire",
    surface: 8500,
    equipments: 12,
    consumption: 125000,
    status: "normal",
  },
  {
    id: 2,
    name: "Mairie centrale",
    address: "Place de l'Hôtel de Ville, 75004 Paris",
    type: "Administratif",
    surface: 4200,
    equipments: 8,
    consumption: 98500,
    status: "alert",
  },
  {
    id: 3,
    name: "Complexe sportif Marcel Cerdan",
    address: "45 avenue des Sports, 75012 Paris",
    type: "Sportif",
    surface: 12000,
    equipments: 15,
    consumption: 87200,
    status: "normal",
  },
  {
    id: 4,
    name: "Médiathèque François Mitterrand",
    address: "8 rue des Livres, 75013 Paris",
    type: "Culturel",
    surface: 3200,
    equipments: 6,
    consumption: 45600,
    status: "normal",
  },
  {
    id: 5,
    name: "École primaire Pasteur",
    address: "23 rue Pasteur, 75015 Paris",
    type: "Établissement scolaire",
    surface: 2100,
    equipments: 4,
    consumption: 32100,
    status: "warning",
  },
];

export default function SitesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Sites & Patrimoine
          </h1>
          <p className="text-text-secondary">
            Gérez l&apos;ensemble de vos sites et équipements CVC
          </p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Ajouter un site
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un site..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
          />
        </div>
        <Button variant="outline">
          <Filter size={18} className="mr-2" />
          Filtres
        </Button>
        <Button variant="outline">
          <Download size={18} className="mr-2" />
          Exporter
        </Button>
      </div>

      {/* Sites Table */}
      <ChartCard title={`${sites.length} sites`} className="overflow-hidden">
        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-y border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Site
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Surface
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Équipements
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Conso. annuelle
                </th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map((site) => (
                <tr
                  key={site.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Building2 size={18} className="text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-primary-dark">
                          {site.name}
                        </p>
                        <p className="text-sm text-text-secondary truncate max-w-[200px]">
                          {site.address}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {site.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {site.surface.toLocaleString()} m²
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {site.equipments}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary-dark">
                    {(site.consumption / 1000).toFixed(0)} MWh
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        site.status === "normal"
                          ? "bg-green-100 text-green-700"
                          : site.status === "warning"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {site.status === "normal"
                        ? "Normal"
                        : site.status === "warning"
                        ? "Attention"
                        : "Alerte"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
