"use client";

import { Reveal } from "./reveal";

const features = [
  {
    title: "Gestion du patrimoine",
    description:
      "Centralisez toutes les informations de vos sites : équipements CVC, surfaces, documents, historiques d'interventions.",
  },
  {
    title: "Suivi des contrats",
    description:
      "Pilotez vos marchés P1/P2/P3, suivez les échéances, calculez l'intéressement et gérez les pénalités.",
  },
  {
    title: "Performance énergétique",
    description:
      "Analysez vos consommations, comparez au référentiel DJU, détectez les dérives avant qu'elles ne coûtent.",
  },
  {
    title: "Gestion des factures",
    description:
      "Workflow de validation complet, suivi budgétaire par contrat et par site, alertes en cas de dépassement.",
  },
  {
    title: "Chiffrage & devis",
    description:
      "Analysez les devis fournisseurs, comparez les prix, constituez un historique de référence.",
  },
  {
    title: "Réunions d'exploitation",
    description:
      "Planifiez les réunions, rédigez les comptes-rendus, suivez les actions jusqu'à leur clôture.",
  },
  {
    title: "Alertes",
    description:
      "Notifications automatiques sur les dérives de consommation, échéances contractuelles et anomalies.",
  },
  {
    title: "Exports & rapports",
    description:
      "Rapports PDF au standard bureau d'études, exports Excel, données accessibles par API.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-paper py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* En-tête de section, aligné à gauche */}
        <Reveal className="max-w-2xl mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6">
            Index — Fonctions
          </p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink">
            Tout le cycle d&apos;exploitation, dans un seul dossier.
          </h2>
        </Reveal>

        {/* Index numéroté */}
        <div className="grid md:grid-cols-2 gap-x-16">
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={(index % 2) * 80}
              className="group border-t border-ink/15 py-7"
            >
              <div className="flex items-baseline gap-6">
                <span className="font-mono text-xs text-accent w-8 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink mb-2 transition-colors group-hover:text-accent">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed max-w-md">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
