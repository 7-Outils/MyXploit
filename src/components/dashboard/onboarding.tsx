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
  FolderKanban,
  Plus,
} from "lucide-react";

const DEFAULT_MISSION_TYPES = [
  "Suivi de contrat",
  "Renouvellement de contrat",
  "Audit energetique",
  "Audit technique",
  "Audit GTC",
  "Etude de dimensionnement",
  "Etude de faisabilite",
  "Schema directeur",
  "Decret tertiaire",
  "DPE collectif",
  "CEE / Aides",
  "AMO Travaux",
  "Maitrise d'oeuvre",
  "Reseaux de chaleur",
  "Prise en charge exploitant",
];

interface OnboardingData {
  onboardingCompleted: boolean;
  organizationName: string;
  missionTypesConfigured: boolean;
  membersInvited: number;
  sitesCreated: number;
}

export function Onboarding() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Step 1: Mission types
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState("");
  const [savingTypes, setSavingTypes] = useState(false);
  const [typesSaved, setTypesSaved] = useState(false);

  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        const res = await fetch("/api/organization/onboarding");
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (json.missionTypesConfigured) {
            setTypesSaved(true);
          }
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

  const handleSaveMissionTypes = async () => {
    if (selectedTypes.length === 0) return;
    setSavingTypes(true);
    try {
      const res = await fetch("/api/mission-types/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: selectedTypes }),
      });
      if (res.ok) {
        setTypesSaved(true);
      }
    } catch {
      // ignore
    } finally {
      setSavingTypes(false);
    }
  };

  const handleAddCustomType = () => {
    const trimmed = customType.trim();
    if (trimmed && !selectedTypes.includes(trimmed)) {
      setSelectedTypes([...selectedTypes, trimmed]);
      setCustomType("");
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (loading || !data || data.onboardingCompleted || dismissed) {
    return null;
  }

  const step1Done = typesSaved || data.missionTypesConfigured;
  const step2Done = data.membersInvited > 0;
  const step3Done = data.sitesCreated > 0;

  return (
    <div className="border border-ink/10 bg-white p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-accent flex-shrink-0" />
          <div>
            <p className="label-tech mb-0.5">Prise en main</p>
            <h2 className="text-base font-semibold text-ink">Bienvenue{data.organizationName ? ` ${data.organizationName}` : ""}</h2>
            <p className="text-sm text-ink/50">Configurez votre espace en quelques etapes</p>
          </div>
        </div>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="h-9 w-9 flex items-center justify-center text-ink/40 hover:text-accent hover:bg-ink/[0.03]"
          title="Fermer"
        >
          {completing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
        </button>
      </div>

      <div className="space-y-3">
        {/* Step 1: Mission Types */}
        <div className={`p-4 border ${step1Done ? "border-green-600/20 bg-green-50" : "border-ink/10 bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
              {step1Done ? <CheckCircle size={16} className="text-green-600" /> : <FolderKanban size={16} className="text-ink/40" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink">
                {step1Done ? "Types de missions configures" : "Configurez vos types de missions"}
              </h3>
              <p className="text-xs text-ink/50 mt-0.5">
                {step1Done
                  ? "Vous pouvez en ajouter dans Parametres"
                  : "Cochez les missions que votre bureau d'etudes realise"}
              </p>

              {!step1Done && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_MISSION_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`text-xs px-3 py-1.5 border transition-colors ${
                          selectedTypes.includes(type)
                            ? "bg-accent/5 text-accent border-accent"
                            : "bg-white text-ink/70 border-ink/15 hover:border-accent hover:text-accent"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Custom type input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCustomType()}
                      placeholder="Ajouter un type personnalise..."
                      className="flex-1 border border-ink/20 bg-white px-3 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <button
                      onClick={handleAddCustomType}
                      disabled={!customType.trim()}
                      title="Ajouter"
                      className="h-8 w-8 flex items-center justify-center text-accent hover:bg-accent/5 disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {selectedTypes.length > 0 && (
                    <button
                      onClick={handleSaveMissionTypes}
                      disabled={savingTypes}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-ink text-paper text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {savingTypes && <Loader2 size={12} className="animate-spin" />}
                      Valider ({selectedTypes.length} type{selectedTypes.length > 1 ? "s" : ""})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2 & 3 grid */}
        <div className="grid md:grid-cols-2 gap-3">
          {/* Step 2: Invite team */}
          <div className={`p-4 border ${step2Done ? "border-green-600/20 bg-green-50" : "border-ink/10 bg-white"}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                {step2Done ? <CheckCircle size={16} className="text-green-600" /> : <Users size={16} className="text-ink/40" />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  {step2Done ? "Equipe invitee" : "Invitez votre equipe"}
                </h3>
                <p className="text-xs text-ink/50 mt-0.5">
                  {step2Done
                    ? `${data.membersInvited} membre(s) invite(s)`
                    : "Ajoutez vos ingenieurs pour commencer"}
                </p>
                {!step2Done && (
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

          {/* Step 3: Import portfolio */}
          <div className={`p-4 border ${step3Done ? "border-green-600/20 bg-green-50" : "border-ink/10 bg-white"}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-5 w-5 items-center justify-center flex-shrink-0">
                {step3Done ? <CheckCircle size={16} className="text-green-600" /> : <Building2 size={16} className="text-ink/40" />}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  {step3Done ? "Portefeuille importe" : "Importez votre portefeuille"}
                </h3>
                <p className="text-xs text-ink/50 mt-0.5">
                  {step3Done
                    ? `${data.sitesCreated} site(s) cree(s)`
                    : "Importez vos sites ou saisissez au fil de l'eau"}
                </p>
                {!step3Done && (
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
                      className="text-xs text-ink/40 hover:text-ink"
                    >
                      Passer cette etape
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {step1Done && step2Done && step3Done && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">Tout est pret !</p>
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-4 py-1.5 bg-ink text-paper text-sm hover:bg-accent disabled:opacity-50 flex items-center gap-2"
          >
            {completing && <Loader2 size={14} className="animate-spin" />}
            Commencer
          </button>
        </div>
      )}
    </div>
  );
}
