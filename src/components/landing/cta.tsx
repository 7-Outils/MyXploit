"use client";

import { ArrowRight, Phone, Mail } from "lucide-react";
import { Reveal } from "./reveal";

const inputClass =
  "w-full bg-transparent border-0 border-b border-white/25 px-0 py-3 text-paper placeholder-white/30 focus:outline-none focus:border-accent-light focus:ring-0 transition-colors";

export function CTA() {
  return (
    <section id="contact" className="bg-ink py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-16">
          {/* Éditorial */}
          <Reveal className="lg:col-span-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-light mb-6">
              Contact
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-paper mb-8">
              Parlons de vos marchés.
            </h2>
            <p className="text-lg text-white/60 leading-relaxed mb-12">
              Présentez-nous votre patrimoine et vos contrats en cours : nous
              vous montrons, sur vos propres données, ce que MyXploit peut en
              faire. Mise en place et prise en main accompagnées.
            </p>

            <div className="space-y-4 border-t border-white/10 pt-8">
              <a
                href="tel:+33612019478"
                className="flex items-center gap-3 text-white/60 hover:text-accent-light transition-colors"
              >
                <Phone size={16} />
                <span className="font-mono text-sm">06 12 01 94 78</span>
              </a>
              <a
                href="mailto:admin@myxploit.fr"
                className="flex items-center gap-3 text-white/60 hover:text-accent-light transition-colors"
              >
                <Mail size={16} />
                <span className="font-mono text-sm">admin@myxploit.fr</span>
              </a>
            </div>
          </Reveal>

          {/* Formulaire */}
          <Reveal delay={120} className="lg:col-span-7">
            <form className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
                    Prénom
                  </label>
                  <input type="text" className={inputClass} placeholder="Jean" />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="jean.dupont@collectivite.fr"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
                  Organisation
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Région / Ville / Exploitant"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">
                  Message
                </label>
                <textarea
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Décrivez votre patrimoine et vos contrats…"
                />
              </div>

              <button
                type="submit"
                className="group inline-flex items-center gap-3 bg-paper px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-accent-light"
              >
                Envoyer ma demande
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
