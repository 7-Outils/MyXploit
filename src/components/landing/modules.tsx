"use client";

import { useState } from "react";
import {
  Building2,
  FileText,
  BarChart3,
  Receipt,
  Calculator,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    id: "sites",
    icon: Building2,
    title: "Sites & Patrimoine",
    description:
      "Gérez l'ensemble de votre patrimoine immobilier avec une vue centralisée de tous vos sites, équipements CVC et documents associés.",
    features: [
      "Fiche site complète avec données techniques",
      "Inventaire des équipements CVC",
      "Historique des consommations",
      "Gestion documentaire (GED)",
    ],
    image: "/modules/sites.png",
  },
  {
    id: "contracts",
    icon: FileText,
    title: "Contrats & Marchés",
    description:
      "Suivez vos marchés d'exploitation P1/P2/P3 avec un suivi précis des engagements contractuels et des performances.",
    features: [
      "Suivi des montants P1, P2, P3",
      "Calcul d'intéressement automatique",
      "Alertes échéances",
      "Gestion des pénalités",
    ],
    image: "/modules/contracts.png",
  },
  {
    id: "energy",
    icon: BarChart3,
    title: "Suivi Énergétique",
    description:
      "Analysez vos performances énergétiques en temps réel et identifiez les opportunités d'optimisation.",
    features: [
      "Dashboard multi-sites",
      "Comparaison réel vs référence (DJU)",
      "Alertes dérives automatiques",
      "Rapports de performance",
    ],
    image: "/modules/energy.png",
  },
  {
    id: "invoices",
    icon: Receipt,
    title: "Facturation",
    description:
      "Gérez le workflow complet de validation des factures avec un suivi budgétaire précis par contrat et par site.",
    features: [
      "Workflow de validation",
      "Suivi budgétaire temps réel",
      "Ventilation par poste",
      "Exports comptables",
    ],
    image: "/modules/invoices.png",
  },
  {
    id: "quotes",
    icon: Calculator,
    title: "Devis & Chiffrage",
    description:
      "Analysez et comparez les devis de vos prestataires pour garantir les meilleurs tarifs.",
    features: [
      "Base de prix de référence",
      "Comparaison automatique",
      "Alertes dépassements",
      "Historique négociations",
    ],
    image: "/modules/quotes.png",
  },
  {
    id: "meetings",
    icon: Calendar,
    title: "Réunions & Visites",
    description:
      "Planifiez vos réunions d'exploitation, documentez vos visites terrain et suivez les actions.",
    features: [
      "Planning intégré",
      "Comptes-rendus avec photos",
      "Suivi des actions",
      "Notifications automatiques",
    ],
    image: "/modules/meetings.png",
  },
];

export function Modules() {
  const [activeModule, setActiveModule] = useState(modules[0]);

  return (
    <section id="modules" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-dark mb-4">
            Des modules pensés pour votre{" "}
            <span className="gradient-text">métier</span>
          </h2>
          <p className="text-lg text-text-secondary">
            Chaque module a été conçu en collaboration avec des gestionnaires de
            patrimoine et des exploitants CVC pour répondre précisément à vos
            besoins quotidiens.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Module list */}
          <div className="lg:col-span-2 space-y-2">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200",
                  activeModule.id === module.id
                    ? "bg-accent text-white shadow-medium"
                    : "bg-background-secondary hover:bg-gray-100 text-primary-dark"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    activeModule.id === module.id
                      ? "bg-white/20"
                      : "bg-accent/10"
                  )}
                >
                  <module.icon
                    size={20}
                    className={
                      activeModule.id === module.id ? "text-white" : "text-accent"
                    }
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{module.title}</h3>
                </div>
                <ChevronRight
                  size={18}
                  className={cn(
                    "transition-transform",
                    activeModule.id === module.id ? "translate-x-1" : ""
                  )}
                />
              </button>
            ))}
          </div>

          {/* Module detail */}
          <div className="lg:col-span-3">
            <div className="bg-background-secondary rounded-2xl p-8 h-full">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center">
                  <activeModule.icon size={28} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary-dark">
                    {activeModule.title}
                  </h3>
                </div>
              </div>

              <p className="text-text-secondary mb-8 leading-relaxed">
                {activeModule.description}
              </p>

              <ul className="space-y-3 mb-8">
                {activeModule.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-text-primary">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Module preview placeholder */}
              <div className="bg-white rounded-xl border border-gray-200 h-48 flex items-center justify-center">
                <div className="text-center">
                  <activeModule.icon
                    size={48}
                    className="text-accent/30 mx-auto mb-2"
                  />
                  <p className="text-sm text-text-secondary">
                    Aperçu du module
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
