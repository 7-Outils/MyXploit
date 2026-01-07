"use client";

import { Quote } from "lucide-react";

const testimonials = [
  {
    content:
      "MyXploit nous a permis de réduire de 20% le temps passé sur le suivi de nos 80 sites. L'interface est intuitive et les rapports automatiques sont un vrai gain de temps.",
    author: "Marie Dupont",
    role: "Directrice Patrimoine",
    company: "Région Nouvelle-Aquitaine",
  },
  {
    content:
      "Enfin un outil qui comprend les spécificités des marchés d'exploitation CVC. Le suivi de l'intéressement et des pénalités est devenu simple et transparent.",
    author: "Pierre Martin",
    role: "Responsable Exploitation",
    company: "ENGIE Solutions",
  },
  {
    content:
      "La détection automatique des dérives de consommation nous a permis d'identifier plusieurs anomalies sur nos équipements. ROI positif dès la première année.",
    author: "Sophie Bernard",
    role: "Energy Manager",
    company: "Métropole de Lyon",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-dark mb-4">
            Ils ont choisi{" "}
            <span className="gradient-text">MyXploit</span>
          </h2>
          <p className="text-lg text-text-secondary">
            Découvrez comment nos clients optimisent leur gestion énergétique au
            quotidien.
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-background-secondary rounded-2xl p-8 relative hover-lift"
            >
              <Quote
                size={40}
                className="text-accent/20 absolute top-6 right-6"
              />
              <p className="text-text-secondary leading-relaxed mb-6 relative z-10">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-accent">
                    {testimonial.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-primary-dark">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {testimonial.role}
                  </div>
                  <div className="text-sm text-accent">{testimonial.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
