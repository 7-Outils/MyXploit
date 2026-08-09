"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wrench,
  Target,
  Calculator,
  ChevronRight,
  Settings,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

type Tool = {
  id: string;
  name: string;
  description: string;
  icon: typeof Wrench;
  href: string;
  color: string;
  available: boolean;
};

const tools: Tool[] = [
  {
    id: "dimensionnement",
    name: "Dimensionnement",
    description: "Calculateur de puissance chaufferie, P2, P3 et pool analysis",
    icon: Target,
    href: "/dimensioning",
    color: "text-accent",
    available: true,
  },
  {
    id: "estimateur-conso",
    name: "Estimateur conso",
    description: "Estimation des consommations énergétiques prévisionnelles",
    icon: Calculator,
    href: "#",
    color: "text-ink/40",
    available: false,
  },
  {
    id: "comparateur-offres",
    name: "Comparateur offres",
    description: "Analyse comparative des offres exploitants",
    icon: Settings,
    href: "#",
    color: "text-ink/40",
    available: false,
  },
];

export default function OutilsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-ink">Boîte à outils</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Outils de calcul et d&apos;analyse pour l&apos;AMO
        </p>
      </div>

      {/* Tools grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div key={tool.id}>
            {tool.available ? (
              <Link href={tool.href} className="block h-full">
                <div className="panel group h-full p-4 transition-colors hover:border-accent/40">
                  <div className="mb-3 flex items-start justify-between">
                    <tool.icon size={20} className={tool.color} />
                    <ChevronRight
                      size={16}
                      className="text-ink/25 transition-colors group-hover:text-accent"
                    />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-ink">{tool.name}</h3>
                  <p className="text-xs text-text-secondary">{tool.description}</p>
                </div>
              </Link>
            ) : (
              <div className="panel h-full p-4">
                <div className="mb-3 flex items-start justify-between">
                  <tool.icon size={20} className="text-ink/25" />
                  <span className="label-tech border border-ink/10 px-1.5 py-0.5 text-ink/40">
                    Bientôt
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-ink/40">{tool.name}</h3>
                <p className="text-xs text-ink/40">{tool.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick access to dimensioning presets */}
      <ChartCard title="Accès rapides — Dimensionnement">
        <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Puissance chaufferie", preset: "power" },
            { name: "Calcul P2", preset: "p2" },
            { name: "Calcul P3", preset: "p3" },
            { name: "Pool Analysis", preset: "pool" },
          ].map((item) => (
            <Link
              key={item.preset}
              href={`/dimensioning?preset=${item.preset}`}
              className="bg-white px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.02] hover:text-accent"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
