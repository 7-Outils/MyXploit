"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Mail, User, Building, Phone, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background-secondary flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-primary-dark mb-4">
            Demande envoyée !
          </h1>
          <p className="text-text-secondary mb-8">
            Nous avons bien reçu votre demande d&apos;accès. Notre équipe vous contactera dans les 24h pour organiser une démonstration.
          </p>
          <Link href="/">
            <Button variant="outline">Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/">
            <Logo size="lg" className="justify-center" />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary-dark mb-2">
            Demander un accès
          </h1>
          <p className="text-text-secondary">
            Remplissez le formulaire pour obtenir une démonstration personnalisée
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-soft">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Prénom
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Jean"
                  className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Nom
              </label>
              <input
                type="text"
                placeholder="Dupont"
                className="w-full px-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email professionnel
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                placeholder="vous@organisation.fr"
                className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Organisation
            </label>
            <div className="relative">
              <Building
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Nom de votre collectivité ou entreprise"
                className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Téléphone
            </label>
            <div className="relative">
              <Phone
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="tel"
                placeholder="06 00 00 00 00"
                className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Nombre de sites à gérer
            </label>
            <select className="w-full px-4 py-3 bg-background-secondary border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30">
              <option>Moins de 25</option>
              <option>25 - 100</option>
              <option>100 - 500</option>
              <option>Plus de 500</option>
            </select>
          </div>

          <Button type="submit" size="lg" className="w-full">
            Demander une démo
          </Button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-text-secondary">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
