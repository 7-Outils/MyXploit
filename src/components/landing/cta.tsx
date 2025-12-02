"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Mail } from "lucide-react";

export function CTA() {
  return (
    <section id="contact" className="py-24 bg-primary-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent-light/10 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Prêt à transformer votre{" "}
              <span className="text-accent-light">gestion énergétique</span> ?
            </h2>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
              Rejoignez les collectivités et exploitants qui ont déjà adopté
              MyExploit. Notre équipe vous accompagne dans la mise en place et
              la prise en main de la plateforme.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="group bg-accent hover:bg-accent/90">
                Demander une démo gratuite
                <ArrowRight
                  size={18}
                  className="ml-2 group-hover:translate-x-1 transition-transform"
                />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Voir une vidéo
              </Button>
            </div>
          </div>

          {/* Right - Contact form */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-6">
              Contactez-nous
            </h3>

            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Prénom
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="jean.dupont@collectivite.fr"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Organisation
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Région / Ville / Exploitant"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  placeholder="Décrivez votre besoin..."
                />
              </div>

              <Button type="submit" size="lg" className="w-full">
                Envoyer ma demande
              </Button>
            </form>

            {/* Contact info */}
            <div className="mt-8 pt-6 border-t border-white/20 flex flex-wrap gap-6">
              <a
                href="tel:+33100000000"
                className="flex items-center gap-2 text-gray-300 hover:text-accent-light transition-colors"
              >
                <Phone size={18} />
                <span>01 00 00 00 00</span>
              </a>
              <a
                href="mailto:contact@myexploit.fr"
                className="flex items-center gap-2 text-gray-300 hover:text-accent-light transition-colors"
              >
                <Mail size={18} />
                <span>contact@myexploit.fr</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
