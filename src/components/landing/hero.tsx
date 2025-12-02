"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

const stats = [
  { value: "500+", label: "Sites gérés" },
  { value: "15%", label: "Économies moyennes" },
  { value: "98%", label: "Satisfaction client" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/5" />

      {/* Decorative elements */}
      <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-light/10 rounded-full blur-3xl -z-10" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
              <Zap size={16} />
              <span>Nouvelle version disponible</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-dark leading-tight mb-6 animate-slide-up">
              Pilotez vos marchés{" "}
              <span className="gradient-text">d&apos;exploitation CVC</span> en
              toute sérénité
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              La plateforme tout-en-un pour le suivi de performance énergétique
              de vos bâtiments publics. Optimisez vos contrats, maîtrisez vos
              consommations, pilotez vos prestataires.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-12 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button size="lg" className="group">
                Demander une démo
                <ArrowRight
                  size={18}
                  className="ml-2 group-hover:translate-x-1 transition-transform"
                />
              </Button>
              <Button variant="outline" size="lg">
                Découvrir les fonctionnalités
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 lg:gap-12 animate-slide-up" style={{ animationDelay: "0.3s" }}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-accent mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-text-secondary">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - Dashboard preview */}
          <div className="relative lg:pl-8 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="relative">
              {/* Main dashboard card */}
              <div className="bg-white rounded-2xl shadow-large p-6 border border-gray-100">
                {/* Dashboard header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-primary-dark">
                      Vue d&apos;ensemble
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Décembre 2024
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-background-secondary rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={18} className="text-accent" />
                      <span className="text-sm text-text-secondary">Sites</span>
                    </div>
                    <div className="text-2xl font-bold text-primary-dark">
                      127
                    </div>
                  </div>
                  <div className="bg-background-secondary rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={18} className="text-green-500" />
                      <span className="text-sm text-text-secondary">
                        Économies
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-primary-dark">
                      -12.4%
                    </div>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="bg-background-secondary rounded-xl p-4 h-32 flex items-end gap-1">
                  {[40, 65, 45, 80, 55, 70, 60, 75, 50, 85, 65, 90].map(
                    (height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-accent to-accent-light rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Floating notification card */}
              <div className="absolute -left-8 top-1/2 bg-white rounded-xl shadow-medium p-4 border border-gray-100 max-w-[200px] animate-slide-in-right">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary-dark">
                      Alerte résolue
                    </p>
                    <p className="text-xs text-text-secondary">
                      Lycée Voltaire - PAC
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted by logos */}
      <div className="absolute bottom-0 left-0 right-0 bg-background-secondary/50 backdrop-blur-sm border-t border-gray-100 py-6">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-sm text-text-secondary mb-4">
            Ils nous font confiance
          </p>
          <div className="flex justify-center items-center gap-8 lg:gap-16 opacity-60 grayscale">
            {["ENGIE", "Dalkia", "Veolia", "IDEX", "Région IDF"].map((name) => (
              <div
                key={name}
                className="text-lg font-bold text-text-secondary hover:opacity-100 hover:grayscale-0 transition-all"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
