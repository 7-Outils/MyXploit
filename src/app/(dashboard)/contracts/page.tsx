"use client";

import { FileText, Plus, Calendar, Euro, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

const contracts = [
  {
    id: 1,
    name: "Marché exploitation Lot 1 - Nord",
    holder: "ENGIE Solutions",
    startDate: "01/01/2023",
    endDate: "31/12/2026",
    p1: 450000,
    p2: 120000,
    p3: 80000,
    sites: 45,
    status: "active",
  },
  {
    id: 2,
    name: "Marché exploitation Lot 2 - Sud",
    holder: "Dalkia",
    startDate: "01/01/2022",
    endDate: "31/12/2025",
    p1: 380000,
    p2: 95000,
    p3: 65000,
    sites: 38,
    status: "active",
  },
  {
    id: 3,
    name: "Marché exploitation Lot 3 - Est",
    holder: "Veolia",
    startDate: "01/01/2021",
    endDate: "31/12/2024",
    p1: 290000,
    p2: 75000,
    p3: 50000,
    sites: 28,
    status: "expiring",
  },
];

export default function ContractsPage() {
  const totalP1 = contracts.reduce((sum, c) => sum + c.p1, 0);
  const totalP2 = contracts.reduce((sum, c) => sum + c.p2, 0);
  const totalP3 = contracts.reduce((sum, c) => sum + c.p3, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Contrats</h1>
          <p className="text-text-secondary">
            Gérez vos marchés d&apos;exploitation P1/P2/P3
          </p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Nouveau contrat
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Contrats actifs"
          value={contracts.length.toString()}
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Budget P1 (énergie)"
          value={`${(totalP1 / 1000).toFixed(0)}k€`}
          icon={Euro}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Budget P2 (maintenance)"
          value={`${(totalP2 / 1000).toFixed(0)}k€`}
          icon={Euro}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Budget P3 (travaux)"
          value={`${(totalP3 / 1000).toFixed(0)}k€`}
          icon={Euro}
          iconColor="text-green-600"
        />
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        {contracts.map((contract) => (
          <ChartCard key={contract.id} title="" className="hover:shadow-soft transition-shadow cursor-pointer">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 -mt-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={24} className="text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-primary-dark">
                      {contract.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        contract.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {contract.status === "active" ? "Actif" : "Expire bientôt"}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Titulaire : {contract.holder}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {contract.startDate} → {contract.endDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={14} />
                      {contract.sites} sites
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-text-secondary">P1</p>
                  <p className="font-semibold text-primary-dark">
                    {(contract.p1 / 1000).toFixed(0)}k€
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">P2</p>
                  <p className="font-semibold text-primary-dark">
                    {(contract.p2 / 1000).toFixed(0)}k€
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">P3</p>
                  <p className="font-semibold text-primary-dark">
                    {(contract.p3 / 1000).toFixed(0)}k€
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Voir détails
                </Button>
              </div>
            </div>
          </ChartCard>
        ))}
      </div>
    </div>
  );
}
