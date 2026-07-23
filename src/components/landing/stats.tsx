"use client";

import { Reveal } from "./reveal";

const facts = [
  {
    value: "6",
    label: "Modules métier",
    description: "du patrimoine aux réunions d'exploitation",
  },
  {
    value: "P1—P5",
    label: "Postes contractuels",
    description: "énergie, conduite, gros entretien, travaux",
  },
  {
    value: "DJU",
    label: "Correction climatique",
    description: "objectifs recalés sur la rigueur réelle",
  },
  {
    value: "PDF",
    label: "Rapports d'exploitation",
    description: "au standard des bureaux d'études",
  },
];

export function Stats() {
  return (
    <section className="bg-ink py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-white/10 lg:divide-x">
          {facts.map((fact, index) => (
            <Reveal
              key={fact.label}
              delay={index * 80}
              className="py-8 lg:py-2 lg:px-10 first:lg:pl-0 last:lg:pr-0"
            >
              <div className="font-display text-5xl font-medium text-paper mb-4">
                {fact.value}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-accent-light mb-2">
                {fact.label}
              </div>
              <div className="text-sm text-white/50 leading-relaxed">
                {fact.description}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
