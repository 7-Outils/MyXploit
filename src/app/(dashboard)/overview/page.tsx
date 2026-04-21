"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Receipt,
  Calendar,
  CalendarRange,
  Loader2,
  Wrench,
} from "lucide-react";
import { useUserProfile, PROFILE_CONFIG } from "@/contexts/UserProfileContext";
import { useContract } from "@/contexts/ContractContext";
import { Onboarding } from "@/components/dashboard/onboarding";
import type {
  Contract,
  Invoice,
  Meeting,
  Alert,
  Equipment,
  Quote,
  ExpiringContract,
  MissionStats,
  CurrentUser,
  RecentActivity,
  WorkloadEntry,
} from "@/components/overview/types";
import { QUICK_ACTIONS } from "@/components/overview/constants";
import { StatsCards } from "@/components/overview/StatsCards";
import { AdminDashboard } from "@/components/overview/sections/AdminDashboard";
import { ActivitySection } from "@/components/overview/sections/ActivitySection";

export default function OverviewPage() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { selectedContract } = useContract();
  const contractId = selectedContract?.id;
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([]);
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cq = contractId ? `contractId=${contractId}` : "";
        const [userRes, contractsRes, invoicesRes, meetingsRes, alertsRes, equipmentsRes, quotesRes, expiringRes, sitesRes] =
          await Promise.all([
            fetch("/api/auth/me"),
            fetch("/api/contracts"),
            fetch(`/api/invoices${cq ? `?${cq}` : ""}`),
            fetch(`/api/meetings${cq ? `?${cq}` : ""}`),
            fetch(`/api/alerts${cq ? `?${cq}` : ""}`),
            fetch(`/api/equipments${cq ? `?${cq}` : ""}`),
            fetch(`/api/quotes${cq ? `?${cq}` : ""}`),
            fetch("/api/contracts/expiring?months=6"),
            fetch(contractId ? `/api/contracts/${contractId}/sites` : "/api/sites"),
          ]);

        const [userData, contractsData, invoicesData, meetingsData, alertsData, equipmentsData, quotesData, expiringData, sitesData] =
          await Promise.all([
            userRes.json(),
            contractsRes.json(),
            invoicesRes.json(),
            meetingsRes.json(),
            alertsRes.json(),
            equipmentsRes.json(),
            quotesRes.json(),
            expiringRes.json(),
            sitesRes.json(),
          ]);

        if (userData?.user) {
          setCurrentUser(userData.user);
        }
        setContracts(Array.isArray(contractsData) ? contractsData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setMeetings(Array.isArray(meetingsData) ? meetingsData : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        setEquipments(Array.isArray(equipmentsData) ? equipmentsData : []);
        setQuotes(Array.isArray(quotesData) ? quotesData : []);
        setExpiringContracts(expiringData?.contracts || []);

        // Fetch workload + mission stats si ADMIN
        if (userData?.user?.role === "ADMIN" || userData?.user?.role === "SUPER_ADMIN") {
          try {
            const [workloadRes, missionStatsRes] = await Promise.all([
              fetch("/api/admin/workload"),
              fetch("/api/missions/stats"),
            ]);
            if (workloadRes.ok) {
              const workloadData = await workloadRes.json();
              setWorkload(Array.isArray(workloadData) ? workloadData : []);
            }
            if (missionStatsRes.ok) {
              const msData = await missionStatsRes.json();
              setMissionStats(msData);
            }
          } catch {
            // Silently ignore errors
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractId]);

  // Calculs — filter by selected contract if any
  const activeContractsList = contractId
    ? contracts.filter((c) => c.id === contractId)
    : contracts.filter((c) => c.status === "ACTIF");
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
  const recentActivities: RecentActivity[] = [];

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

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  // Get quick actions based on profile
  const quickActions = profile ? QUICK_ACTIONS[profile] : QUICK_ACTIONS.CLIENT;
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="flex items-center justify-center py-20 text-text-secondary">
        <p>Sélectionnez un contrat pour voir les KPI.</p>
      </div>
    );
  }

  const start = new Date(selectedContract.startDate);
  const end = new Date(selectedContract.endDate);
  const now = Date.now();
  const span = end.getTime() - start.getTime();
  const progress =
    span > 0
      ? Math.min(100, Math.max(0, ((now - start.getTime()) / span) * 100))
      : 0;
  const daysLeft = Math.ceil((end.getTime() - now) / 86_400_000);
  const isExpired = daysLeft < 0;
  const isEndingSoon = !isExpired && daysLeft <= 90;

  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const statusLabel = isExpired
    ? `Expiré il y a ${Math.abs(daysLeft)} j`
    : `${daysLeft} j restants`;

  const barColor = isExpired
    ? "bg-red-400"
    : isEndingSoon
    ? "bg-amber-400"
    : "bg-accent";

  const statusColor = isExpired
    ? "text-red-700 bg-red-50"
    : isEndingSoon
    ? "text-amber-700 bg-amber-50"
    : "text-text-secondary bg-gray-50";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg border border-gray-100 text-xs">
        <div className="flex items-center gap-1.5 text-text-secondary shrink-0">
          <CalendarRange className="w-3.5 h-3.5" />
          <span>Période</span>
        </div>
        <span className="text-primary-dark tabular-nums font-medium shrink-0">
          {fmt(start)}
        </span>
        <div className="relative flex-1 h-1 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-primary-dark tabular-nums font-medium shrink-0">
          {fmt(end)}
        </span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
