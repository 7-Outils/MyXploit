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
  Wrench,
  BarChart3,
  ClipboardCheck,
  Target,
  Euro,
  CheckCircle,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { useUserProfile, PROFILE_CONFIG } from "@/contexts/UserProfileContext";

interface ContractSite {
  id: string;
  site: {
    id: string;
    name: string;
  };
}

interface Contract {
  id: string;
  title: string;
  provider: string;
  endDate: string;
  status: string;
  contractSites: ContractSite[];
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
  title: string;
  message: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  site: { id: string; name: string } | null;
  createdAt: string;
  isRead: boolean;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: string;
  site: { name: string };
}

interface Quote {
  id: string;
  reference: string;
  title: string;
  amountHT: number;
  status: string;
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

// Profile-specific welcome messages
const WELCOME_MESSAGES = {
  CLIENT: "Voici le résumé de votre patrimoine et vos contrats.",
  AMO: "Voici le tableau de bord de pilotage de vos marchés.",
  EXPLOITANT: "Voici le résumé de vos interventions et équipements.",
};

// Profile-specific quick actions
const QUICK_ACTIONS = {
  CLIENT: [
    { href: "/contracts", icon: FileText, label: "Voir contrats" },
    { href: "/invoices", icon: Receipt, label: "Factures" },
    { href: "/energy", icon: BarChart3, label: "Performance" },
    { href: "/meetings", icon: Calendar, label: "Réunions" },
  ],
  AMO: [
    { href: "/energy", icon: Target, label: "Performance NC/N'B" },
    { href: "/contracts", icon: FileText, label: "Auditer contrats" },
    { href: "/sites", icon: Building2, label: "Patrimoine" },
    { href: "/meetings", icon: Calendar, label: "Planifier visite" },
  ],
  EXPLOITANT: [
    { href: "/equipments", icon: Wrench, label: "Équipements" },
    { href: "/quotes", icon: Receipt, label: "Mes devis" },
    { href: "/sites", icon: Building2, label: "Sites" },
    { href: "/energy", icon: BarChart3, label: "Relevés" },
  ],
};

export default function OverviewPage() {
  const { user } = useUser();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contractsRes, invoicesRes, meetingsRes, alertsRes, equipmentsRes, quotesRes] =
          await Promise.all([
            fetch("/api/contracts"),
            fetch("/api/invoices"),
            fetch("/api/meetings"),
            fetch("/api/alerts"),
            fetch("/api/equipments"),
            fetch("/api/quotes"),
          ]);

        const [contractsData, invoicesData, meetingsData, alertsData, equipmentsData, quotesData] =
          await Promise.all([
            contractsRes.json(),
            invoicesRes.json(),
            meetingsRes.json(),
            alertsRes.json(),
            equipmentsRes.json(),
            quotesRes.json(),
          ]);

        setContracts(Array.isArray(contractsData) ? contractsData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setMeetings(Array.isArray(meetingsData) ? meetingsData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        setEquipments(Array.isArray(equipmentsData) ? equipmentsData : []);
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculs
  const activeContractsList = contracts.filter((c) => c.status === "ACTIF");
  const activeContracts = activeContractsList.length;

  // Sites des contrats actifs uniquement (dédupliqués par id)
  const sitesFromActiveContracts = activeContractsList.flatMap((c) => c.contractSites.map((cs) => cs.site));
  const uniqueSiteIds = new Set(sitesFromActiveContracts.map((s) => s.id));
  const uniqueSitesFromActiveContracts = Array.from(uniqueSiteIds).map(
    (id) => sitesFromActiveContracts.find((s) => s.id === id)!
  );

  const pendingInvoices = invoices.filter((i) => i.status === "EN_ATTENTE");
  const totalPendingAmount = pendingInvoices.reduce(
    (sum, i) => sum + i.amount,
    0
  );
  const activeAlerts = alerts.filter((a) => !a.isRead);
  const criticalAlerts = alerts.filter((a) => a.priority === "CRITIQUE");
  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date) >= new Date()
  );

  // Equipments stats
  const equipmentInMaintenance = equipments.filter((e) => e.status === "MAINTENANCE" || e.status === "PANNE");
  const operationalEquipments = equipments.filter((e) => e.status === "OPERATIONNEL");

  // Quotes stats
  const pendingQuotes = quotes.filter((q) => q.status === "ENVOYE" || q.status === "BROUILLON");
  const acceptedQuotes = quotes.filter((q) => q.status === "ACCEPTE" || q.status === "COMMANDE");

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
      iconBg: alert.priority === "CRITIQUE" ? "bg-red-100" : "bg-yellow-100",
      iconColor: alert.priority === "CRITIQUE" ? "text-red-600" : "text-yellow-600",
      title: alert.title,
      description: alert.message,
      time: new Date(alert.createdAt).toLocaleDateString("fr-FR"),
    });
  });

  // Add profile-specific activities
  if (profile === "EXPLOITANT") {
    // Ajouter les équipements en panne
    equipmentInMaintenance.slice(0, 2).forEach((eq) => {
      recentActivities.push({
        id: `equip-${eq.id}`,
        type: "equipment",
        icon: Wrench,
        iconBg: eq.status === "PANNE" ? "bg-red-100" : "bg-orange-100",
        iconColor: eq.status === "PANNE" ? "text-red-600" : "text-orange-600",
        title: eq.name || eq.type,
        description: `${eq.site.name} - ${eq.status}`,
        time: eq.status === "PANNE" ? "Urgent" : "À planifier",
      });
    });
  } else {
    // Ajouter les factures récentes pour CLIENT et AMO
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
  }

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

  // Get profile-specific stats cards
  const getStatsCards = () => {
    if (profile === "EXPLOITANT") {
      return (
        <>
          <StatsCard
            title="Équipements actifs"
            value={operationalEquipments.length.toString()}
            icon={Wrench}
            iconColor="text-orange-600"
          />
          <StatsCard
            title="En maintenance/panne"
            value={equipmentInMaintenance.length.toString()}
            change={equipmentInMaintenance.length > 0 ? "À traiter" : "Tout OK"}
            changeType={equipmentInMaintenance.length > 0 ? "negative" : "positive"}
            icon={AlertTriangle}
            iconColor="text-red-600"
          />
          <StatsCard
            title="Devis en cours"
            value={pendingQuotes.length.toString()}
            change={`${acceptedQuotes.length} acceptés`}
            changeType="positive"
            icon={Receipt}
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Sites gérés"
            value={uniqueSitesFromActiveContracts.length.toString()}
            icon={Building2}
            iconColor="text-accent"
          />
        </>
      );
    } else if (profile === "AMO") {
      return (
        <>
          <StatsCard
            title="Contrats pilotés"
            value={activeContracts.toString()}
            icon={ClipboardCheck}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Sites sous contrat"
            value={uniqueSitesFromActiveContracts.length.toString()}
            icon={Building2}
            iconColor="text-accent"
          />
          <StatsCard
            title="Alertes dérives"
            value={activeAlerts.length.toString()}
            change={criticalAlerts.length > 0 ? `${criticalAlerts.length} critiques` : "RAS"}
            changeType={criticalAlerts.length > 0 ? "negative" : "positive"}
            icon={Target}
            iconColor="text-red-600"
          />
          <StatsCard
            title="Réunions à venir"
            value={upcomingMeetings.length.toString()}
            icon={Calendar}
            iconColor="text-blue-600"
          />
        </>
      );
    } else {
      // CLIENT (default)
      return (
        <>
          <StatsCard
            title="Sites sous contrat"
            value={uniqueSitesFromActiveContracts.length.toString()}
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
            icon={Euro}
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
        </>
      );
    }
  };

  // Get quick actions based on profile
  const quickActions = profile ? QUICK_ACTIONS[profile] : QUICK_ACTIONS.CLIENT;
  const welcomeMessage = profile ? WELCOME_MESSAGES[profile] : WELCOME_MESSAGES.CLIENT;

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with profile badge */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Vue d&apos;ensemble
          </h1>
          <p className="text-text-secondary">
            Bienvenue{user?.firstName ? `, ${user.firstName}` : ""}. {welcomeMessage}
          </p>
        </div>
        {profile && (
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            profile === "EXPLOITANT" ? "bg-orange-100 text-orange-700" :
            profile === "AMO" ? "bg-purple-100 text-purple-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {PROFILE_CONFIG[profile].label}
          </div>
        )}
      </div>

      {/* Stats Grid - Profile specific */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {getStatsCards()}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <ChartCard
          title="Consommation énergétique"
          subtitle={profile === "AMO" ? "NC vs N'B (Performance)" : "Réel vs Référence (MWh)"}
          className="lg:col-span-2"
          action={
            <Link href="/energy" className="text-sm text-accent hover:underline">
              Voir détails
            </Link>
          }
        >
          <SimpleBarChart data={consumptionData} height={220} />
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
              <span className="text-text-secondary">{profile === "AMO" ? "NC (Réel)" : "Réel"}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 rounded" />
              <span className="text-text-secondary">{profile === "AMO" ? "N'B (Théorique)" : "Référence"}</span>
            </div>
          </div>
        </ChartCard>

        {/* Profile-specific side panel */}
        {profile === "EXPLOITANT" ? (
          <ChartCard title="Équipements à traiter" subtitle={`${equipmentInMaintenance.length} intervention(s)`}>
            {equipmentInMaintenance.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                <p className="text-sm text-text-secondary">Tous les équipements sont opérationnels</p>
              </div>
            ) : (
              <div className="space-y-4">
                {equipmentInMaintenance.slice(0, 5).map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${eq.status === "PANNE" ? "bg-red-500" : "bg-orange-500"}`} />
                      <div>
                        <span className="text-sm text-primary-dark truncate block max-w-[140px]">
                          {eq.name || eq.type}
                        </span>
                        <span className="text-xs text-gray-500">{eq.site.name}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${eq.status === "PANNE" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                      {eq.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        ) : (
          <ChartCard title="Sites sous contrat" subtitle={`${uniqueSitesFromActiveContracts.length} sites actifs`}>
            {uniqueSitesFromActiveContracts.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-text-secondary">Aucun site sous contrat actif</p>
                <Link href="/contracts" className="text-sm text-accent hover:underline">
                  Voir les contrats
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueSitesFromActiveContracts.slice(0, 5).map((site, index) => (
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
        )}
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

        {/* Quick Actions - Profile specific */}
        <ChartCard title="Actions rapides">
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors"
              >
                <action.icon size={24} className="text-accent" />
                <span className="text-sm text-text-secondary text-center">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
