"use client";

import { User, Building, Users, Bell, Shield, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

const settingsSections = [
  {
    id: "profile",
    icon: User,
    title: "Mon profil",
    description: "Gérez vos informations personnelles et mot de passe",
  },
  {
    id: "organization",
    icon: Building,
    title: "Organisation",
    description: "Paramètres de votre entreprise ou collectivité",
  },
  {
    id: "users",
    icon: Users,
    title: "Utilisateurs",
    description: "Gérez les accès et les rôles de votre équipe",
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    description: "Configurez vos préférences de notifications",
  },
  {
    id: "security",
    icon: Shield,
    title: "Sécurité",
    description: "Authentification à deux facteurs et sessions actives",
  },
  {
    id: "integrations",
    icon: Plug,
    title: "Intégrations",
    description: "Connectez MyExploit à vos outils existants",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Paramètres</h1>
        <p className="text-text-secondary">
          Configurez votre compte et vos préférences
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsSections.map((section) => (
          <div
            key={section.id}
            className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-soft hover:border-accent/20 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent group-hover:scale-110 transition-all">
              <section.icon
                size={24}
                className="text-accent group-hover:text-white transition-colors"
              />
            </div>
            <h3 className="font-semibold text-primary-dark mb-1">
              {section.title}
            </h3>
            <p className="text-sm text-text-secondary">{section.description}</p>
          </div>
        ))}
      </div>

      {/* Profile Section */}
      <ChartCard title="Informations du compte">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Nom complet
            </label>
            <input
              type="text"
              defaultValue="Jean Dupont"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              defaultValue="jean.dupont@collectivite.fr"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Rôle
            </label>
            <select className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30">
              <option>Gestionnaire</option>
              <option>Administrateur</option>
              <option>Lecteur</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Organisation
            </label>
            <input
              type="text"
              defaultValue="Région Île-de-France"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button>Enregistrer les modifications</Button>
        </div>
      </ChartCard>
    </div>
  );
}
