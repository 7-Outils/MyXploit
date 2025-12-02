"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    description: "Pour les petites collectivités",
    price: "490",
    period: "/mois",
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
    period: "/mois",
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
    <section id="pricing" className="py-24 bg-background-secondary">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-dark mb-4">
            Des tarifs{" "}
            <span className="gradient-text">transparents et adaptés</span>
          </h2>
          <p className="text-lg text-text-secondary">
            Choisissez la formule qui correspond à vos besoins. Tous nos plans
            incluent les mises à jour et le support.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative bg-white rounded-2xl p-8 border-2 transition-all duration-300",
                plan.popular
                  ? "border-accent shadow-large scale-105 lg:scale-110"
                  : "border-gray-100 hover:border-accent/30 hover:shadow-medium"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-sm font-medium px-4 py-1 rounded-full">
                  Recommandé
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-primary-dark mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-primary-dark">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-text-secondary ml-1">
                      {plan.period}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={12} className="text-accent" />
                    </div>
                    <span className="text-sm text-text-secondary">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "default" : "outline"}
                className="w-full"
                size="lg"
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <p className="text-center text-sm text-text-secondary mt-12">
          Tous les prix sont HT. Engagement annuel.{" "}
          <a href="#" className="text-accent hover:underline">
            Voir les conditions générales
          </a>
        </p>
      </div>
    </section>
  );
}
