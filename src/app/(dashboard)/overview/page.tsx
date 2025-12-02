"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Building2,
  Receipt,
  AlertTriangle,
  TrendingDown,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";

interface Site {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  title: string;
  provider: string;
  endDate: string;
  status: string;
}

interface Invoice {
  id: string;
  reference: string;
  amount: number;
  status: string;
  contract: { provider: string } | null;
  createdAt: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  type: string;
}

interface Alert {
  id: string;
  message: string;
  severity: string;
  site: Site | null;
  createdAt: string;
  isRead: boolean;
}

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

export default function OverviewPage() {
  const { user } = useUser();
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sitesRes, contractsRes, invoicesRes, meetingsRes, alertsRes] =
          await Promise.all([
            fetch("/api/sites"),
            fetch("/api/contracts"),
            fetch("/api/invoices"),
            fetch("/api/meetings"),
            fetch("/api/alerts"),
          ]);

        const [sitesData, contractsData, invoicesData, meetingsData, alertsData] =
          await Promise.all([
            sitesRes.json(),
            contractsRes.json(),
            invoicesRes.json(),
            meetingsRes.json(),
            alertsRes.json(),
          ]);

        setSites(Array.isArray(sitesData) ? sitesData : []);
        setContracts(Array.isArray(contractsData) ? contractsData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setMeetings(Array.isArray(meetingsData) ? meetingsData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculs
  const activeContracts = contracts.filter((c) => c.status === "ACTIF").length;
  const pendingInvoices = invoices.filter((i) => i.status === "EN_ATTENTE");
  const totalPendingAmount = pendingInvoices.reduce(
    (sum, i) => sum + i.amount,
    0
  );
  const activeAlerts = alerts.filter((a) => !a.isRead);
  const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");
  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date) >= new Date()
  );

  // Activités récentes (basées sur les données réelles)
  const recentActivities: Array<{
    id: string;
    type: string;
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    time: string;
  }> = [];

  // Ajouter les alertes récentes
  activeAlerts.slice(0, 2).forEach((alert) => {
    recentActivities.push({
      id: `alert-${alert.id}`,
      type: "alert",
      icon: AlertTriangle,
      iconBg: alert.severity === "CRITICAL" ? "bg-red-100" : "bg-yellow-100",
      iconColor: alert.severity === "CRITICAL" ? "text-red-600" : "text-yellow-600",
      title: "Alerte " + alert.severity.toLowerCase(),
      description: alert.message,
      time: new Date(alert.createdAt).toLocaleDateString("fr-FR"),
    });
  });

  // Ajouter les factures récentes
  invoices.slice(0, 2).forEach((invoice) => {
    recentActivities.push({
      id: `invoice-${invoice.id}`,
      type: "invoice",
      icon: Receipt,
      iconBg: invoice.status === "VALIDEE" ? "bg-green-100" : "bg-yellow-100",
      iconColor: invoice.status === "VALIDEE" ? "text-green-600" : "text-yellow-600",
      title: `Facture ${invoice.reference}`,
      description: `${invoice.contract?.provider || "Fournisseur"} - ${invoice.amount.toLocaleString()}€`,
      time: new Date(invoice.createdAt).toLocaleDateString("fr-FR"),
    });
  });

  // Ajouter les réunions à venir
  upcomingMeetings.slice(0, 2).forEach((meeting) => {
    recentActivities.push({
      id: `meeting-${meeting.id}`,
      type: "meeting",
      icon: Calendar,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      title: meeting.title,
      description: `${meeting.type} - ${new Date(meeting.date).toLocaleDateString("fr-FR")}`,
      time: new Date(meeting.date).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  });

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
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          Vue d&apos;ensemble
        </h1>
        <p className="text-text-secondary">
          Bienvenue{user?.firstName ? `, ${user.firstName}` : ""}. Voici le résumé de votre patrimoine.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Sites gérés"
          value={sites.length.toString()}
          icon={Building2}
          iconColor="text-accent"
        />
        <StatsCard
          title="Contrats actifs"
          value={activeContracts.toString()}
          icon={FileText}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Factures en attente"
          value={pendingInvoices.length.toString()}
          change={`${(totalPendingAmount / 1000).toFixed(0)}k€ à valider`}
          changeType="neutral"
          icon={Receipt}
          iconColor="text-yellow-600"
        />
        <StatsCard
          title="Alertes actives"
          value={activeAlerts.length.toString()}
          change={criticalAlerts.length > 0 ? `${criticalAlerts.length} critiques` : "Aucune critique"}
          changeType={criticalAlerts.length > 0 ? "negative" : "positive"}
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

        {/* Top sites */}
        <ChartCard title="Vos sites" subtitle={`${sites.length} sites gérés`}>
          {sites.length === 0 ? (
            <div className="text-center py-8">
              <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-text-secondary">Aucun site</p>
              <Link href="/sites" className="text-sm text-accent hover:underline">
                Ajouter un site
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {sites.slice(0, 5).map((site, index) => (
                <div key={site.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-xs font-medium text-accent">
                      {index + 1}
                    </span>
                    <span className="text-sm text-primary-dark truncate max-w-[140px]">
                      {site.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      <TrendingDown size={12} className="inline text-green-600" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Activity & Quick Actions */}
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
          {recentActivities.length === 0 ? (
            <p className="text-center text-text-secondary py-8">
              Aucune activité récente
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivities.slice(0, 4).map((activity) => (
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
          )}
        </ChartCard>

        {/* Quick Actions */}
        <ChartCard title="Actions rapides">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/sites"
              className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Building2 size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Ajouter un site
              </span>
            </Link>
            <Link
              href="/invoices"
              className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Receipt size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Saisir facture
              </span>
            </Link>
            <Link
              href="/contracts"
              className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
            >
              <FileText size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Nouveau contrat
              </span>
            </Link>
            <Link
              href="/meetings"
              className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Calendar size={24} className="text-accent" />
              <span className="text-sm text-text-secondary">
                Planifier réunion
              </span>
            </Link>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
