"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  Wrench,
  ChevronRight,
  Loader2,
  Calculator,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface ExpiringContract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  startDate: string;
  endDate: string;
  status: string;
  daysUntilExpiry: number;
  monthsUntilExpiry: number;
  urgency: "EXPIRED" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  siteCount: number;
  equipmentCount: number;
  sites: Array<{
    id: string;
    name: string;
    city: string;
    type: string;
    equipmentCount: number;
    hasP2: boolean;
    hasP3: boolean;
  }>;
}

interface Stats {
  total: number;
  expired: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const URGENCY_CONFIG = {
  EXPIRED: {
    label: "Expiré",
    color: "bg-gray-100 text-gray-700 border-gray-300",
    bgColor: "bg-gray-500",
    icon: Clock,
  },
  CRITICAL: {
    label: "Critique",
    color: "bg-red-100 text-red-700 border-red-300",
    bgColor: "bg-red-500",
    icon: AlertTriangle,
  },
  HIGH: {
    label: "Haute",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    bgColor: "bg-orange-500",
    icon: AlertTriangle,
  },
  MEDIUM: {
    label: "Moyenne",
    color: "bg-yellow-100 text-yellow-700 border-yellow-300",
    bgColor: "bg-yellow-500",
    icon: Bell,
  },
  LOW: {
    label: "Basse",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    bgColor: "bg-blue-500",
    icon: Calendar,
  },
};

export default function RenewalsPage() {
  const [contracts, setContracts] = useState<ExpiringContract[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [months]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/expiring?months=${months}&includeExpired=true`);
      const data = await response.json();
      if (response.ok) {
        setContracts(data.contracts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((c) => {
    if (filter === "all") return true;
    return c.urgency === filter;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getExpiryText = (days: number) => {
    if (days < 0) {
      return `Expiré depuis ${Math.abs(days)} jours`;
    }
    if (days === 0) {
      return "Expire aujourd'hui";
    }
    if (days === 1) {
      return "Expire demain";
    }
    if (days < 30) {
      return `Expire dans ${days} jours`;
    }
    if (days < 60) {
      return `Expire dans ~1 mois`;
    }
    return `Expire dans ${Math.ceil(days / 30)} mois`;
  };

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
          <h1 className="text-2xl font-bold text-primary-dark">Renouvellements de contrats</h1>
          <p className="text-text-secondary">
            Contrats arrivant à échéance dans les {months} prochains mois
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
            <option value={18}>18 mois</option>
            <option value={24}>24 mois</option>
          </select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw size={18} className="mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Total"
            value={stats.total.toString()}
            change="contrats à renouveler"
            changeType="neutral"
            icon={FileText}
            iconColor="text-gray-600"
          />
          <StatsCard
            title="Critiques"
            value={stats.critical.toString()}
            change="< 30 jours"
            changeType={stats.critical > 0 ? "negative" : "positive"}
            icon={AlertTriangle}
            iconColor="text-red-600"
          />
          <StatsCard
            title="Urgents"
            value={stats.high.toString()}
            change="< 3 mois"
            changeType={stats.high > 0 ? "negative" : "neutral"}
            icon={AlertTriangle}
            iconColor="text-orange-600"
          />
          <StatsCard
            title="À planifier"
            value={stats.medium.toString()}
            change="< 6 mois"
            changeType="neutral"
            icon={Bell}
            iconColor="text-yellow-600"
          />
          <StatsCard
            title="À surveiller"
            value={stats.low.toString()}
            change="> 6 mois"
            changeType="positive"
            icon={Calendar}
            iconColor="text-blue-600"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary-dark text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Tous ({stats?.total || 0})
        </button>
        {stats && stats.expired > 0 && (
          <button
            onClick={() => setFilter("EXPIRED")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "EXPIRED"
                ? "bg-gray-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Expirés ({stats.expired})
          </button>
        )}
        <button
          onClick={() => setFilter("CRITICAL")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "CRITICAL"
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}
        >
          Critiques ({stats?.critical || 0})
        </button>
        <button
          onClick={() => setFilter("HIGH")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "HIGH"
              ? "bg-orange-600 text-white"
              : "bg-orange-50 text-orange-600 hover:bg-orange-100"
          }`}
        >
          Urgents ({stats?.high || 0})
        </button>
        <button
          onClick={() => setFilter("MEDIUM")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "MEDIUM"
              ? "bg-yellow-600 text-white"
              : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
          }`}
        >
          Moyens ({stats?.medium || 0})
        </button>
      </div>

      {/* Contract list */}
      {filteredContracts.length > 0 ? (
        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            const config = URGENCY_CONFIG[contract.urgency];
            const Icon = config.icon;

            return (
              <ChartCard key={contract.id}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Urgency indicator */}
                  <div className={`w-2 h-full lg:h-20 rounded ${config.bgColor} self-stretch hidden lg:block`} />

                  {/* Contract info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${config.color.includes("red") ? "text-red-500" : config.color.includes("orange") ? "text-orange-500" : config.color.includes("yellow") ? "text-yellow-500" : "text-gray-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-primary-dark truncate">{contract.title}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{contract.reference} • {contract.provider}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Calendar size={14} />
                            {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <Building2 size={14} />
                            {contract.siteCount} site{contract.siteCount > 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <Wrench size={14} />
                            {contract.equipmentCount} équipement{contract.equipmentCount > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expiry info */}
                  <div className="lg:text-right">
                    <p className={`font-semibold ${contract.daysUntilExpiry < 0 ? "text-gray-600" : contract.daysUntilExpiry <= 30 ? "text-red-600" : contract.daysUntilExpiry <= 90 ? "text-orange-600" : "text-primary-dark"}`}>
                      {getExpiryText(contract.daysUntilExpiry)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Fin le {formatDate(contract.endDate)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 lg:flex-col">
                    <Link
                      href={`/dimensioning?contractId=${contract.id}`}
                      className="flex-1 lg:flex-none"
                    >
                      <Button variant="outline" size="sm" className="w-full">
                        <Calculator size={16} className="mr-1" />
                        Dimensionner
                      </Button>
                    </Link>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="flex-1 lg:flex-none"
                    >
                      <Button size="sm" className="w-full">
                        Voir détails
                        <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Sites preview */}
                {contract.sites.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Sites inclus :</p>
                    <div className="flex flex-wrap gap-2">
                      {contract.sites.slice(0, 5).map((site) => (
                        <span
                          key={site.id}
                          className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                        >
                          {site.name} ({site.equipmentCount} éq.)
                        </span>
                      ))}
                      {contract.sites.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
                          +{contract.sites.length - 5} autres
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </ChartCard>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">
            Aucun contrat à renouveler
          </h3>
          <p className="text-text-secondary max-w-md mx-auto">
            {filter !== "all"
              ? "Aucun contrat ne correspond à ce filtre."
              : `Aucun contrat n'arrive à échéance dans les ${months} prochains mois.`}
          </p>
        </div>
      )}
    </div>
  );
}
