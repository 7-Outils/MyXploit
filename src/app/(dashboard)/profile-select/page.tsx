"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Building2, ClipboardCheck, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserProfile, PROFILE_CONFIG, UserProfileType } from "@/contexts/UserProfileContext";

const PROFILE_ICONS = {
  EXPLOITANT: Wrench,
  CLIENT: Building2,
  AMO: ClipboardCheck,
};

const PROFILE_COLORS = {
  EXPLOITANT: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    selected: "border-orange-500 bg-orange-50 ring-2 ring-orange-500",
    icon: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
  },
  CLIENT: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    selected: "border-blue-500 bg-blue-50 ring-2 ring-blue-500",
    icon: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  AMO: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    selected: "border-purple-500 bg-purple-50 ring-2 ring-purple-500",
    icon: "text-purple-600",
    badge: "bg-purple-100 text-purple-700",
  },
};

export default function ProfileSelectPage() {
  const router = useRouter();
  const { user, profile: currentProfile, setProfile, isLoading } = useUserProfile();
  const [selectedProfile, setSelectedProfile] = useState<UserProfileType>(currentProfile);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedProfile) return;

    setSaving(true);
    await setProfile(selectedProfile);
    setSaving(false);

    // Redirect to appropriate page
    const config = PROFILE_CONFIG[selectedProfile];
    router.push(config.defaultRoute);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-primary-dark mb-3">
            Bienvenue{user?.firstName ? `, ${user.firstName}` : ""} !
          </h1>
          <p className="text-lg text-text-secondary">
            Sélectionnez votre profil pour personnaliser votre expérience
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Vous pourrez changer de profil à tout moment depuis les paramètres
          </p>
        </div>

        {/* Profile Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {(Object.keys(PROFILE_CONFIG) as Array<keyof typeof PROFILE_CONFIG>).map((profileKey) => {
            const config = PROFILE_CONFIG[profileKey];
            const Icon = PROFILE_ICONS[profileKey];
            const colors = PROFILE_COLORS[profileKey];
            const isSelected = selectedProfile === profileKey;

            return (
              <button
                key={profileKey}
                onClick={() => setSelectedProfile(profileKey)}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
                  isSelected ? colors.selected : `${colors.border} hover:${colors.bg}`
                }`}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className={`w-6 h-6 ${colors.icon}`} />
                  </div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-7 h-7 ${colors.icon}`} />
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-primary-dark mb-1">{config.label}</h3>
                <p className="text-text-secondary mb-4">{config.description}</p>

                {/* Focus areas */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Focus principal</p>
                  <div className="flex flex-wrap gap-2">
                    {config.focus.map((item) => (
                      <span
                        key={item}
                        className={`text-xs px-2 py-1 rounded-full ${colors.badge}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={!selectedProfile || saving}
            className="min-w-[200px]"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                Continuer
                <ArrowRight size={20} className="ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Skip option if already has profile */}
        {currentProfile && (
          <div className="text-center mt-4">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-text-secondary hover:text-accent underline"
            >
              Garder mon profil actuel ({PROFILE_CONFIG[currentProfile].label})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
