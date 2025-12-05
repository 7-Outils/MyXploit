"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Zap,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { TelereleveCard } from "@/components/energy/TelereleveCard";

interface Site {
  id: string;
  name: string;
  type: string;
}

interface Consumption {
  id: string;
  type: "ELECTRICITE" | "GAZ" | "EAU" | "FIOUL" | "CHALEUR";
  value: number;
  unit: string;
  period: string;
  site: Site;
}

interface Alert {
  id: string;
  type: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  title: string;
  message: string;
  site: Site | null;
  createdAt: string;
  isRead: boolean;
}

export default function EnergyPage() {
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    type: "ELECTRICITE",
    value: "",
    unit: "kWh",
    period: "",
    siteId: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [consumptionsRes, alertsRes, sitesRes] = await Promise.all([
        fetch("/api/consumptions"),
        fetch("/api/alerts"),
        fetch("/api/sites"),
      ]);
      const [consumptionsData, alertsData, sitesData] = await Promise.all([
        consumptionsRes.json(),
        alertsRes.json(),
        sitesRes.json(),
      ]);
      setConsumptions(Array.isArray(consumptionsData) ? consumptionsData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setSites(sitesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/consumptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        await fetchData();
        setShowModal(false);
        setFormData({
          type: "ELECTRICITE",
          value: "",
          unit: "kWh",
          period: "",
          siteId: "",
        });
      }
    } catch (error) {
      console.error("Error creating consumption:", error);
    } finally {
      setCreating(false);
    }
  };

  // Calculer les statistiques
  const totalElec = consumptions
    .filter((c) => c.type === "ELECTRICITE")
    .reduce((sum, c) => sum + c.value, 0);
  const totalGaz = consumptions
    .filter((c) => c.type === "GAZ")
    .reduce((sum, c) => sum + c.value, 0);
  const activeAlerts = alerts.filter((a) => !a.isRead);
  const criticalAlerts = alerts.filter((a) => a.priority === "CRITIQUE");

  // Données pour le graphique (agrégées par mois)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

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
          <Button onClick={() => setShowModal(true)}>
            <Plus size={18} className="mr-2" />
            Saisir conso
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Électricité"
          value={`${(totalElec / 1000).toFixed(0)} MWh`}
          icon={Zap}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Gaz"
          value={`${(totalGaz / 1000).toFixed(0)} MWh`}
          icon={TrendingDown}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Relevés"
          value={consumptions.length.toString()}
          icon={BarChart3}
          iconColor="text-accent"
        />
        <StatsCard
          title="Alertes actives"
          value={activeAlerts.length.toString()}
          change={`${criticalAlerts.length} critiques`}
          changeType={criticalAlerts.length > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      {/* Télérelève */}
      <TelereleveCard />

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
          {activeAlerts.length === 0 ? (
            <p className="text-text-secondary text-center py-8">
              Aucune alerte active
            </p>
          ) : (
            <div className="space-y-4">
              {activeAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.priority === "CRITIQUE"
                      ? "bg-red-50 border-red-500"
                      : alert.priority === "HAUTE"
                      ? "bg-yellow-50 border-yellow-500"
                      : "bg-blue-50 border-blue-500"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-primary-dark">
                        {alert.title}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {alert.message}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        alert.priority === "CRITIQUE"
                          ? "bg-red-100 text-red-600"
                          : alert.priority === "HAUTE"
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {alert.priority}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-2">
                    {new Date(alert.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Recent consumptions */}
      {consumptions.length > 0 && (
        <ChartCard title="Derniers relevés">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Site
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Type
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Période
                  </th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">
                    Valeur
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumptions.slice(0, 10).map((consumption) => (
                  <tr key={consumption.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-primary-dark">
                      {consumption.site?.name || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          consumption.type === "ELECTRICITE"
                            ? "bg-yellow-100 text-yellow-700"
                            : consumption.type === "GAZ"
                            ? "bg-blue-100 text-blue-700"
                            : consumption.type === "EAU"
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {consumption.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {new Date(consumption.period).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium text-primary-dark">
                      {consumption.value.toLocaleString()} {consumption.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Saisir une consommation
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Site *
                </label>
                <select
                  required
                  value={formData.siteId}
                  onChange={(e) =>
                    setFormData({ ...formData, siteId: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Type d&apos;énergie *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      let unit = "kWh";
                      if (type === "EAU") unit = "m³";
                      if (type === "FIOUL") unit = "L";
                      setFormData({ ...formData, type, unit });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="ELECTRICITE">Électricité</option>
                    <option value="GAZ">Gaz</option>
                    <option value="EAU">Eau</option>
                    <option value="FIOUL">Fioul</option>
                    <option value="CHALEUR">Réseau de chaleur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Période *
                  </label>
                  <input
                    type="month"
                    required
                    value={formData.period}
                    onChange={(e) =>
                      setFormData({ ...formData, period: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Valeur *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.value}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="12500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-dark mb-1">
                    Unité
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
