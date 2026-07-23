"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const modules = [
  {
    id: "sites",
    title: "Sites & Patrimoine",
    description:
      "L'ensemble de votre patrimoine immobilier avec une vue centralisée de tous vos sites, équipements CVC et documents associés.",
    features: [
      "Fiche site complète avec données techniques",
      "Inventaire des équipements CVC",
      "Historique des consommations",
      "Gestion documentaire (GED)",
    ],
  },
  {
    id: "contracts",
    title: "Contrats & Marchés",
    description:
      "Vos marchés d'exploitation P1/P2/P3 avec un suivi précis des engagements contractuels et des performances.",
    features: [
      "Suivi des montants P1, P2, P3",
      "Calcul d'intéressement automatique",
      "Alertes échéances",
      "Gestion des pénalités",
    ],
  },
  {
    id: "energy",
    title: "Suivi énergétique",
    description:
      "Vos performances énergétiques analysées en continu pour identifier les opportunités d'optimisation.",
    features: [
      "Dashboard multi-sites",
      "Comparaison réel vs référence (DJU)",
      "Alertes dérives automatiques",
      "Rapports de performance",
    ],
  },
  {
    id: "invoices",
    title: "Facturation",
    description:
      "Le workflow complet de validation des factures avec un suivi budgétaire précis par contrat et par site.",
    features: [
      "Workflow de validation",
      "Suivi budgétaire temps réel",
      "Ventilation par poste",
      "Exports comptables",
    ],
  },
  {
    id: "quotes",
    title: "Devis & Chiffrage",
    description:
      "Les devis de vos prestataires analysés et comparés pour garantir les meilleurs tarifs.",
    features: [
      "Base de prix de référence",
      "Comparaison automatique",
      "Alertes dépassements",
      "Historique négociations",
    ],
  },
  {
    id: "meetings",
    title: "Réunions & Visites",
    description:
      "Les réunions d'exploitation planifiées, les visites terrain documentées, les actions suivies.",
    features: [
      "Planning intégré",
      "Comptes-rendus avec photos",
      "Suivi des actions",
      "Notifications automatiques",
    ],
  },
];

export function Modules() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = modules[activeIndex];

  return (
    <section id="modules" className="bg-white py-24 border-t border-ink/15">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="max-w-2xl mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6">
            Sommaire — Modules
          </p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink">
            Six modules, un seul dossier d&apos;exploitation.
          </h2>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-12">
          {/* Sommaire */}
          <div className="lg:col-span-5">
            {modules.map((module, index) => (
              <button
                key={module.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "w-full flex items-baseline gap-5 border-t border-ink/15 py-5 text-left transition-colors",
                  index === modules.length - 1 && "border-b",
                  activeIndex === index
                    ? "text-ink"
                    : "text-ink/40 hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-xs w-8 shrink-0",
                    activeIndex === index ? "text-accent" : "text-inherit"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "font-display text-2xl font-medium tracking-tight",
                    activeIndex === index && "underline decoration-accent decoration-2 underline-offset-8"
                  )}
                >
                  {module.title}
                </span>
              </button>
            ))}
          </div>

          {/* Fiche module */}
          <div className="lg:col-span-7">
            <div
              key={active.id}
              className="border border-ink/15 bg-paper h-full flex flex-col animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-ink/15 px-6 py-3">
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">
                  Module {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(modules.length).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
                  {active.id}
                </span>
              </div>

              <div className="p-6 sm:p-10 flex-1">
                <h3 className="font-display text-3xl font-medium tracking-tight text-ink mb-4">
                  {active.title}
                </h3>
                <p className="text-text-secondary leading-relaxed mb-10 max-w-lg">
                  {active.description}
                </p>

                <ul>
                  {active.features.map((feature, index) => (
                    <li
                      key={feature}
                      className="flex items-baseline gap-4 border-t border-ink/10 py-3.5"
                    >
                      <span className="font-mono text-[11px] text-accent shrink-0">
                        {String(activeIndex + 1).padStart(2, "0")}.
                        {index + 1}
                      </span>
                      <span className="text-sm text-ink">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
