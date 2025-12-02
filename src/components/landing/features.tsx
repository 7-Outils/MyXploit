"use client";

import {
  Building2,
  FileText,
  BarChart3,
  Receipt,
  Calculator,
  Users,
  Bell,
  Download,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Gestion du patrimoine",
    description:
      "Centralisez toutes les informations de vos sites : équipements CVC, surfaces, documents, historiques d'interventions.",
  },
  {
    icon: FileText,
    title: "Suivi des contrats",
    description:
      "Pilotez vos marchés P1/P2/P3, suivez les échéances, calculez l'intéressement et gérez les pénalités.",
  },
  {
    icon: BarChart3,
    title: "Performance énergétique",
    description:
      "Analysez vos consommations en temps réel, comparez avec les références DJU, détectez les dérives.",
  },
  {
    icon: Receipt,
    title: "Gestion des factures",
    description:
      "Workflow de validation complet, suivi budgétaire par contrat et par site, alertes dépassements.",
  },
  {
    icon: Calculator,
    title: "Chiffrage & Devis",
    description:
      "Analysez les devis fournisseurs, comparez les prix, constituez un historique de référence.",
  },
  {
    icon: Users,
    title: "Suivi des réunions",
    description:
      "Planifiez vos réunions d'exploitation, rédigez les comptes-rendus, suivez les actions.",
  },
  {
    icon: Bell,
    title: "Alertes intelligentes",
    description:
      "Notifications automatiques sur les dérives de consommation, échéances contractuelles et anomalies.",
  },
  {
    icon: Download,
    title: "Exports & Rapports",
    description:
      "Générez des rapports PDF professionnels, exportez vos données en Excel, API disponible.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-background-secondary">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-dark mb-4">
            Tout ce dont vous avez besoin pour{" "}
            <span className="gradient-text">piloter vos marchés</span>
          </h2>
          <p className="text-lg text-text-secondary">
            Une plateforme complète conçue pour les gestionnaires de patrimoine
            et les exploitants CVC. Simplifiez votre quotidien, optimisez vos
            performances.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-white rounded-2xl p-6 hover-lift border border-gray-100"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent group-hover:scale-110 transition-all duration-300">
                <feature.icon
                  size={24}
                  className="text-accent group-hover:text-white transition-colors"
                />
              </div>
              <h3 className="text-lg font-semibold text-primary-dark mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
