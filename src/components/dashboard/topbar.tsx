"use client";

import { Bell, Search, User, ChevronDown } from "lucide-react";
import { useState } from "react";

export function Topbar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifications = [
    {
      id: 1,
      title: "Alerte consommation",
      message: "Dérive détectée sur Lycée Voltaire",
      time: "Il y a 5 min",
      unread: true,
    },
    {
      id: 2,
      title: "Facture validée",
      message: "Facture P2 - Décembre 2024",
      time: "Il y a 2h",
      unread: true,
    },
    {
      id: 3,
      title: "Réunion planifiée",
      message: "Réunion exploitation - 15/12",
      time: "Hier",
      unread: false,
    },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un site, contrat, facture..."
            className="w-full pl-10 pr-4 py-2 bg-background-secondary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 border border-transparent focus:border-accent/30"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-large border border-gray-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <h3 className="font-semibold text-primary-dark">
                  Notifications
                </h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-2 ${
                      notif.unread
                        ? "border-accent bg-accent/5"
                        : "border-transparent"
                    }`}
                  >
                    <p className="text-sm font-medium text-primary-dark">
                      {notif.title}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-gray-100">
                <button className="text-sm text-accent hover:underline">
                  Voir toutes les notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
              <User size={16} className="text-accent" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-primary-dark">
                Jean Dupont
              </p>
              <p className="text-xs text-text-secondary">Gestionnaire</p>
            </div>
            <ChevronDown size={16} className="text-gray-400 hidden sm:block" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-large border border-gray-100 py-2 z-50">
              <a
                href="/settings"
                className="block px-4 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary-dark"
              >
                Mon profil
              </a>
              <a
                href="/settings"
                className="block px-4 py-2 text-sm text-text-secondary hover:bg-gray-50 hover:text-primary-dark"
              >
                Paramètres
              </a>
              <hr className="my-2 border-gray-100" />
              <button className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
