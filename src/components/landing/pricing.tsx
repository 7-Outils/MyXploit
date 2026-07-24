"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const plans = [
  {
    name: "Starter",
    description: "Pour les petites collectivités",
    price: "490",
    period: "€ HT / mois",
    features: [
      "Jusqu'à 25 sites",
      "3 utilisateurs",
      "Module Sites & Patrimoine",
      "Module Suivi énergétique",
      "Support email",
      "Export Excel",
    ],
    cta: "Commencer",
    popular: false,
  },
  {
    name: "Professional",
    description: "Pour les collectivités et exploitants",
    price: "990",
    period: "€ HT / mois",
    features: [
      "Jusqu'à 100 sites",
      "10 utilisateurs",
      "Tous les modules inclus",
      "Gestion multi-contrats",
      "Support prioritaire",
      "Export PDF & Excel",
      "API disponible",
    ],
    cta: "Demander une démo",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Pour les grands comptes",
    price: "Sur mesure",
    period: "",
    features: [
      "Sites illimités",
      "Utilisateurs illimités",
      "Tous les modules inclus",
      "SSO / SAML",
      "Support dédié",
      "Formation sur site",
      "Intégrations personnalisées",
      "SLA garanti",
    ],
    cta: "Nous contacter",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-paper py-24 border-t border-ink/15">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="max-w-2xl mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-6">
            Barème — Tarifs
          </p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink mb-6">
            Un barème simple, sans surprise.
          </h2>
          <p className="text-lg text-text-secondary">
            Tous les plans incluent les mises à jour et le support. Engagement
            annuel.
          </p>
        </Reveal>

        <Reveal>
          <div className="grid lg:grid-cols-3 border border-ink/15 divide-y lg:divide-y-0 lg:divide-x divide-ink/15 bg-white">
            {plans.map((plan, index) => (
              <div key={plan.name} className="flex flex-col">
                {/* Cartouche */}
                <div className="flex items-center justify-between border-b border-ink/15 px-8 py-3">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">
                    Formule {String(index + 1).padStart(2, "0")}
                  </span>
                  {plan.popular && (
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
                      Recommandé
                    </span>
                  )}
                </div>

                <div className="p-8 flex flex-col flex-1">
                  <h3 className="font-display text-2xl font-medium text-ink mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-text-secondary mb-8">
                    {plan.description}
                  </p>

                  <div className="mb-8">
                    <span className="font-display text-5xl font-medium text-ink">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="font-mono text-xs text-ink/50 ml-2">
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <ul className="mb-10 flex-1">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-baseline gap-3 border-t border-ink/10 py-2.5 text-sm text-text-secondary"
                      >
                        <span className="text-accent">—</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="#contact"
                    className={cn(
                      "inline-flex justify-center px-6 py-3.5 text-sm font-medium transition-colors",
                      plan.popular
                        ? "bg-ink text-paper hover:bg-accent"
                        : "border border-ink/25 text-ink hover:border-accent hover:text-accent"
                    )}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
