"use client";

import { Calculator, Plus, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

const quotes = [
  {
    id: 1,
    title: "Remplacement chaudière",
    site: "Lycée Jean Moulin",
    supplier: "ENGIE Solutions",
    amount: 45000,
    date: "10/12/2024",
    status: "pending",
    comparison: "+5%",
  },
  {
    id: 2,
    title: "Installation PAC",
    site: "Mairie centrale",
    supplier: "Dalkia",
    amount: 78000,
    date: "05/12/2024",
    status: "accepted",
    comparison: "-8%",
  },
  {
    id: 3,
    title: "Maintenance CTA",
    site: "Complexe sportif",
    supplier: "Veolia",
    amount: 12500,
    date: "01/12/2024",
    status: "rejected",
    comparison: "+15%",
  },
];

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            Devis & Chiffrage
          </h1>
          <p className="text-text-secondary">
            Analysez et comparez les devis de vos prestataires
          </p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          Nouveau devis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Devis en cours"
          value="8"
          icon={FileText}
          iconColor="text-accent"
        />
        <StatsCard
          title="Montant total"
          value="235k€"
          icon={Calculator}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Économies négociées"
          value="18k€"
          change="Ce trimestre"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Taux d'acceptation"
          value="72%"
          icon={FileText}
          iconColor="text-yellow-600"
        />
      </div>

      {/* Quotes List */}
      <ChartCard title={`${quotes.length} devis récents`}>
        <div className="space-y-4">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="flex items-center justify-between p-4 bg-background-secondary rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Calculator size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-medium text-primary-dark">{quote.title}</p>
                  <p className="text-sm text-text-secondary">
                    {quote.site} • {quote.supplier}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-semibold text-primary-dark">
                    {quote.amount.toLocaleString()} €
                  </p>
                  <p
                    className={`text-sm ${
                      quote.comparison.startsWith("+")
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {quote.comparison} vs référence
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    quote.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : quote.status === "accepted"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {quote.status === "pending"
                    ? "En attente"
                    : quote.status === "accepted"
                    ? "Accepté"
                    : "Refusé"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
