"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  CheckCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

interface OnboardingData {
  onboardingCompleted: boolean;
  organizationName: string;
  membersInvited: number;
  sitesCreated: number;
}

export function Onboarding() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        const res = await fetch("/api/organization/onboarding");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Silently ignore
      } finally {
        setLoading(false);
      }
    };
    fetchOnboarding();
  }, []);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch("/api/organization/onboarding-complete", { method: "POST" });
      if (res.ok) {
        setDismissed(true);
      }
    } catch {
      // Silently ignore
    } finally {
      setCompleting(false);
    }
  };

  if (loading || !data || data.onboardingCompleted || dismissed) {
    return null;
  }

  const step1Done = data.membersInvited > 0;
  const step2Done = data.sitesCreated > 0;

  return (
    <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent border border-accent/20 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Sparkles size={20} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bienvenue{data.organizationName ? ` ${data.organizationName}` : ""}</h2>
            <p className="text-sm text-gray-600">Configurez votre espace en quelques etapes</p>
          </div>
        </div>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Fermer"
        >
          {completing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Step 1: Invite team */}
        <div className={`p-4 rounded-xl border ${step1Done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${step1Done ? "bg-green-100" : "bg-blue-100"}`}>
              {step1Done ? <CheckCircle size={18} className="text-green-600" /> : <Users size={18} className="text-blue-600" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">
                {step1Done ? "Equipe invitee" : "Invitez votre equipe"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step1Done
                  ? `${data.membersInvited} membre(s) invite(s)`
                  : "Ajoutez vos ingenieurs pour qu'ils commencent a travailler"}
              </p>
              {!step1Done && (
                <Link
                  href="/team"
                  className="inline-flex items-center gap-1 text-sm text-accent font-medium mt-2 hover:underline"
                >
                  Inviter <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Import portfolio */}
        <div className={`p-4 rounded-xl border ${step2Done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${step2Done ? "bg-green-100" : "bg-blue-100"}`}>
              {step2Done ? <CheckCircle size={18} className="text-green-600" /> : <Building2 size={18} className="text-blue-600" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">
                {step2Done ? "Portefeuille importe" : "Importez votre portefeuille"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step2Done
                  ? `${data.sitesCreated} site(s) cree(s)`
                  : "Importez vos sites ou laissez votre equipe les creer"}
              </p>
              {!step2Done && (
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    href="/buildings?import=true"
                    className="inline-flex items-center gap-1 text-sm text-accent font-medium hover:underline"
                  >
                    Importer <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Passer cette etape
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {step1Done && step2Done && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">Tout est pret !</p>
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-4 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
          >
            {completing && <Loader2 size={14} className="animate-spin" />}
            Commencer
          </button>
        </div>
      )}
    </div>
  );
}
