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
    color: "text-blue-600",
    available: false,
  },
  {
    id: "comparateur-offres",
    name: "Comparateur offres",
    description: "Analyse comparative des offres exploitants",
    icon: Settings,
    href: "#",
    color: "text-purple-600",
    available: false,
  },
];

export default function OutilsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Boîte à outils</h1>
        <p className="text-text-secondary">Outils de calcul et d&apos;analyse pour l&apos;AMO</p>
      </div>

      {/* Tools grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <div key={tool.id}>
            {tool.available ? (
              <Link href={tool.href}>
                <div className="bg-white rounded-xl border border-gray-100 p-6 hover:border-accent hover:shadow-md transition-all group h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors`}>
                      <tool.icon size={24} className={tool.color} />
                    </div>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-accent transition-colors" />
                  </div>
                  <h3 className="font-semibold text-primary-dark mb-2">{tool.name}</h3>
                  <p className="text-sm text-text-secondary">{tool.description}</p>
                </div>
              </Link>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-6 opacity-50 h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <tool.icon size={24} className="text-gray-400" />
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Bientôt</span>
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">{tool.name}</h3>
                <p className="text-sm text-gray-400">{tool.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick access to dimensioning presets */}
      <ChartCard title="Accès rapides - Dimensionnement">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "Puissance chaufferie", preset: "power", color: "bg-orange-50 text-orange-700 border-orange-200" },
            { name: "Calcul P2", preset: "p2", color: "bg-blue-50 text-blue-700 border-blue-200" },
            { name: "Calcul P3", preset: "p3", color: "bg-green-50 text-green-700 border-green-200" },
            { name: "Pool Analysis", preset: "pool", color: "bg-purple-50 text-purple-700 border-purple-200" },
          ].map((item) => (
            <Link
              key={item.preset}
              href={`/dimensioning?preset=${item.preset}`}
              className={`p-4 rounded-xl border ${item.color} hover:shadow-md transition-all text-center font-medium`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
