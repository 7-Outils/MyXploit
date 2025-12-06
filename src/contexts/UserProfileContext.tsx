"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type UserProfileType = "EXPLOITANT" | "CLIENT" | "AMO" | null;

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  profile: UserProfileType;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

interface UserProfileContextType {
  user: UserData | null;
  profile: UserProfileType;
  isLoading: boolean;
  setProfile: (profile: UserProfileType) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

// Profile configurations
export const PROFILE_CONFIG = {
  EXPLOITANT: {
    label: "Exploitant",
    description: "Entreprise de maintenance CVC",
    color: "orange",
    icon: "Wrench",
    focus: ["Chiffrage AO", "Équipements", "Devis"],
    defaultRoute: "/equipments",
    navPriority: ["pricing", "equipments", "sites", "quotes", "energy", "contracts"],
  },
  CLIENT: {
    label: "Client",
    description: "Propriétaire / Gestionnaire de patrimoine",
    color: "blue",
    icon: "Building2",
    focus: ["Coûts", "Conformité contrat", "Performance"],
    defaultRoute: "/overview",
    navPriority: ["dashboard", "contracts", "energy", "invoices", "quotes", "sites"],
  },
  AMO: {
    label: "AMO",
    description: "Assistant à Maîtrise d'Ouvrage",
    color: "purple",
    icon: "ClipboardCheck",
    focus: ["Dimensionnement", "Audits", "Performance"],
    defaultRoute: "/dimensioning",
    navPriority: ["dimensioning", "dashboard", "energy", "contracts", "sites", "equipments"],
  },
};

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const setProfile = async (profile: UserProfileType) => {
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <UserProfileContext.Provider
      value={{
        user,
        profile: user?.profile || null,
        isLoading,
        setProfile,
        refreshUser,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}

export function useProfileConfig() {
  const { profile } = useUserProfile();
  if (!profile) return null;
  return PROFILE_CONFIG[profile];
}
