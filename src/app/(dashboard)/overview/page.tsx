"use client";

import {
  Building2,
  Zap,
  Receipt,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";

const consumptionData = [
  { label: "Jan", value: 850, target: 900 },
  { label: "Fév", value: 920, target: 880 },
  { label: "Mar", value: 780, target: 800 },
  { label: "Avr", value: 650, target: 700 },
  { label: "Mai", value: 520, target: 550 },
  { label: "Jun", value: 480, target: 500 },
  { label: "Jul", value: 420, target: 450 },
  { label: "Aoû", value: 410, target: 440 },
  { label: "Sep", value: 550, target: 580 },
  { label: "Oct", value: 720, target: 750 },
  { label: "Nov", value: 880, target: 850 },
  { label: "Déc", value: 950, target: 920 },
];

const recentActivities = [
  {
    id: 1,
    type: "alert",
    icon: AlertTriangle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    title: "Alerte consommation",
    description: "Dérive de +15% détectée sur Lycée Voltaire",
    time: "Il y a 2h",
  },
  {
    id: 2,
    type: "invoice",
    icon: Receipt,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Facture validée",
    description: "Facture P2 Décembre - ENGIE - 12 450€",
    time: "Il y a 4h",
  },
  {
    id: 3,
    type: "contract",
    icon: FileText,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "Échéance contrat",
    description: "Renouvellement Lot 3 dans 30 jours",
    time: "Hier",
  },
  {
    id: 4,
    type: "meeting",
    icon: Calendar,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    title: "Réunion planifiée",
    description: "Réunion exploitation Q4 - 15/12/2024",
    time: "Il y a 2j",
  },
];

const topSites = [
  { name: "Lycée Jean Moulin", consumption: 125000, trend: -8 },
  { name: "Mairie centrale", consumption: 98500, trend: +3 },
  { name: "Complexe sportif", consumption: 87200, trend: -12 },
  { name: "Médiathèque", consumption: 45600, trend: +5 },
  { name: "École primaire Pasteur", consumption: 32100, trend: -2 },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          Vue d&apos;ensemble
        </h1>
        <p className="text-text-secondary">
          Bienvenue, Jean. Voici le résumé de votre patrimoine.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Sites gérés"
          value="127"
          change="3 nouveaux ce mois"
          changeType="positive"
          icon={Building2}
          iconColor="text-accent"
        />
        <StatsCard
          title="Consommation totale"
          value="2.4 GWh"
          change="-8.5% vs N-1"
          changeType="positive"
          icon={Zap}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Budget YTD"
          value="1.2M€"
          change="82% consommé"
          changeType="neutral"
          icon={Receipt}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Alertes actives"
          value="5"
          change="2 critiques"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <ChartCard
          title="Consommation énergétique"
          subtitle="Réel vs Référence (MWh)"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
                <span className="text-text-secondary">Réel</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 rounded" />
                <span className="text-text-secondary">Référence</span>
              </div>
            </div>
          }
        >
          <SimpleBarChart data={consumptionData} height={220} />
        </ChartCard>

        {/* Top consumers */}
        <ChartCard title="Top 5 consommateurs" subtitle="Ce mois">
          <div className="space-y-4">
            {topSites.map((site, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-xs font-medium text-accent">
                    {index + 1}
                  </span>
                  <span className="text-sm text-primary-dark truncate max-w-[140px]">
                    {site.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary-dark">
                    {(site.consumption / 1000).toFixed(0)}k
                  </span>
                  <span
                    className={`text-xs flex items-center ${
                      site.trend < 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {site.trend < 0 ? (
                      <TrendingDown size={12} />
                    ) : (
                      <TrendingUp size={12} />
                    )}
                    {Math.abs(site.trend)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Activity & Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <ChartCard
          title="Activité récente"
          action={
            <button className="text-sm text-accent hover:underline">
              Voir tout
            </button>
          }
        >
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.iconBg}`}
                >
                  <activity.icon size={18} className={activity.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-dark">
                    {activity.title}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {activity.description}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Quick Actions */}
        <ChartCard title="Actions rapides">
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors">
              <Building2 size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Ajouter un site
              </span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors">
              <Receipt size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Saisir facture
              </span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors">
              <FileText size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Générer rapport
              </span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors">
              <Calendar size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Planifier réunion
              </span>
            </button>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
