"use client";

import { TrendingUp, Building2, Users, Award } from "lucide-react";

const stats = [
  {
    icon: Building2,
    value: "500+",
    label: "Sites gérés",
    description: "sur notre plateforme",
  },
  {
    icon: TrendingUp,
    value: "15%",
    label: "Économies moyennes",
    description: "sur la facture énergétique",
  },
  {
    icon: Users,
    value: "50+",
    label: "Clients actifs",
    description: "collectivités et exploitants",
  },
  {
    icon: Award,
    value: "98%",
    label: "Satisfaction",
    description: "taux de renouvellement",
  },
];

export function Stats() {
  return (
    <section className="py-20 bg-primary-dark">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <stat.icon size={28} className="text-accent-light" />
              </div>
              <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-lg font-semibold text-accent-light mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-gray-400">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
