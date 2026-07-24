"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Mail, Linkedin, Twitter } from "lucide-react";

const footerLinks = {
  product: {
    title: "Produit",
    links: [
      { name: "Fonctionnalités", href: "#features" },
      { name: "Modules", href: "#modules" },
      { name: "Tarifs", href: "#pricing" },
      { name: "Roadmap", href: "#" },
    ],
  },
  company: {
    title: "Entreprise",
    links: [
      { name: "À propos", href: "#" },
      { name: "Blog", href: "#" },
      { name: "Carrières", href: "#" },
      { name: "Contact", href: "#contact" },
    ],
  },
  resources: {
    title: "Ressources",
    links: [
      { name: "Documentation", href: "#" },
      { name: "Guides", href: "#" },
      { name: "API", href: "#" },
      { name: "Support", href: "#" },
    ],
  },
  legal: {
    title: "Légal",
    links: [
      { name: "Confidentialité", href: "#" },
      { name: "CGU", href: "#" },
      { name: "Mentions légales", href: "#" },
      { name: "RGPD", href: "#" },
    ],
  },
};

export function Footer() {
  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Logo and description */}
          <div className="col-span-2">
            <div className="mb-4">
              <Logo size="md" variant="white" />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              La plateforme de référence pour le pilotage des marchés
              d&apos;exploitation CVC et le suivi de performance énergétique.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="text-gray-400 hover:text-accent-light transition-colors"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-accent-light transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="mailto:admin@myxploit.fr"
                className="text-gray-400 hover:text-accent-light transition-colors"
              >
                <Mail size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-accent-light transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-mono text-xs text-gray-500">
              © {new Date().getFullYear()} MyXploit — Tous droits réservés
            </p>
            <p className="font-mono text-xs text-gray-500">
              Suivi d&apos;exploitation CVC · P1 P2 P3
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
