"use client";

import { BarChart3, TrendingDown, TrendingUp, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";

const monthlyData = [
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

const alerts = [
  {
    id: 1,
    site: "Lycée Voltaire",
    type: "Dérive chauffage",
    deviation: "+18%",
    since: "3 jours",
    severity: "high",
  },
  {
    id: 2,
    site: "Mairie centrale",
    type: "Consommation anormale",
    deviation: "+12%",
    since: "1 semaine",
    severity: "medium",
  },
  {
    id: 3,
    site: "Gymnase Sud",
    type: "Pic de consommation",
    deviation: "+25%",
    since: "2 jours",
    severity: "high",
  },
];

export default function EnergyPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Suivi énergétique
          </h1>
          <p className="text-text-secondary">
            Analysez vos consommations et détectez les dérives
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Exporter rapport</Button>
          <Button>Analyser</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Consommation YTD"
          value="2.4 GWh"
          change="-8.5% vs réf."
          changeType="positive"
          icon={Zap}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Économies réalisées"
          value="185k€"
          change="+12% vs N-1"
          changeType="positive"
          icon={TrendingDown}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Performance DJU"
          value="94%"
          change="Objectif atteint"
          changeType="positive"
          icon={BarChart3}
          iconColor="text-accent"
        />
        <StatsCard
          title="Alertes actives"
          value="3"
          change="2 critiques"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard
          title="Consommation mensuelle"
          subtitle="Réel vs Référence DJU (MWh)"
          className="lg:col-span-2"
          action={
            <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/20">
              <option>2024</option>
              <option>2023</option>
              <option>2022</option>
            </select>
          }
        >
          <SimpleBarChart data={monthlyData} height={250} />
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
              <span className="text-text-secondary">Consommation réelle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-200 rounded" />
              <span className="text-text-secondary">Référence DJU</span>
            </div>
          </div>
        </ChartCard>

        {/* Alerts */}
        <ChartCard
          title="Alertes dérives"
          action={
            <button className="text-sm text-accent hover:underline">
              Voir toutes
            </button>
          }
        >
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === "high"
                    ? "bg-red-50 border-red-500"
                    : "bg-yellow-50 border-yellow-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-primary-dark">
                      {alert.site}
                    </p>
                    <p className="text-sm text-text-secondary">{alert.type}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      alert.severity === "high"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {alert.deviation}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-2">
                  Depuis {alert.since}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Performance by site type */}
      <ChartCard title="Performance par type de bâtiment">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { type: "Scolaire", performance: 92, trend: -5 },
            { type: "Administratif", performance: 88, trend: -3 },
            { type: "Sportif", performance: 78, trend: +2 },
            { type: "Culturel", performance: 95, trend: -8 },
          ].map((item) => (
            <div
              key={item.type}
              className="bg-background-secondary rounded-xl p-4 text-center"
            >
              <p className="text-sm text-text-secondary mb-2">{item.type}</p>
              <p className="text-3xl font-bold text-primary-dark">
                {item.performance}%
              </p>
              <p
                className={`text-sm mt-1 flex items-center justify-center gap-1 ${
                  item.trend < 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {item.trend < 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                {Math.abs(item.trend)}% vs N-1
              </p>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
