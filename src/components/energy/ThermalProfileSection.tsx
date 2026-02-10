"use client";

import { useState, useEffect } from "react";
import {
  Thermometer,
  Building2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Loader2,
  Save,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ReadOnlyGate } from "@/components/permissions";

interface ThermalProfileData {
  site: {
    id: string;
    name: string;
    type: string;
    constructionYear: number | null;
    surfaceChauffee: number | null;
    volumeChauffee: number | null;
    insulationLevel: string | null;
    glazingType: string | null;
    ventilationType: string | null;
    buildingHeight: number | null;
    numberOfFloors: number | null;
    djuContractuel: number;
    rendement: number;
  };
  gEstimation: {
    gMin: number;
    gMax: number;
    gTypical: number;
    insulationUsed: string;
    factors: {
      glazing: number;
      ventilation: number;
      buildingType: number;
    };
  };
  gReelBySeason: Array<{
    season: string;
    value: number;
    reliability: "HIGH" | "MEDIUM" | "LOW";
    reliabilityReason?: string;
    consumptionKwh: number;
    djuReal: number;
  }>;
  bestGReal: {
    season: string;
    value: number;
    reliability: "HIGH" | "MEDIUM" | "LOW";
    reliabilityReason?: string;
  } | null;
  diagnostic: {
    level: "PERFORMANT" | "CONFORME" | "ATTENTION" | "CRITIQUE";
    ecartPercent: number;
    message: string;
    recommendation: string;
    auditRecommended: boolean;
  } | null;
  estimations: {
    fromEstimated: {
      heatingPowerKw: number;
      theoreticalConsumptionKwh: number;
      theoreticalConsumptionMwh: number;
    };
    fromReal: {
      heatingPowerKw: number;
      theoreticalConsumptionKwh: number;
      theoreticalConsumptionMwh: number;
    } | null;
  } | null;
  occupationZones: Array<{
    id: string;
    name: string;
    surface: number | null;
    tempConsigne: number;
    tempReduit: number;
    weeklySchedule: any;
  }>;
}

interface Props {
  siteId: string;
}

const INSULATION_LABELS: Record<string, string> = {
  AUCUNE: "Aucune (avant 1974)",
  PARTIELLE: "Partielle",
  RT1974: "RT 1974",
  RT1988: "RT 1988",
  RT2000: "RT 2000",
  RT2005: "RT 2005",
  RT2012: "RT 2012",
  RE2020: "RE 2020",
};

const GLAZING_LABELS: Record<string, string> = {
  SIMPLE: "Simple vitrage",
  DOUBLE: "Double vitrage",
  DOUBLE_FE: "Double vitrage FE",
  TRIPLE: "Triple vitrage",
};

const VENTILATION_LABELS: Record<string, string> = {
  NATURELLE: "Naturelle",
  SIMPLE_FLUX: "VMC simple flux",
  HYGRO_B: "VMC hygroréglable B",
  DOUBLE_FLUX: "VMC double flux",
};

const DIAGNOSTIC_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof CheckCircle2 }
> = {
  PERFORMANT: {
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: CheckCircle2,
  },
  CONFORME: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: CheckCircle2,
  },
  ATTENTION: {
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: AlertTriangle,
  },
  CRITIQUE: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertTriangle,
  },
};

export default function ThermalProfileSection({ siteId }: Props) {
  const [data, setData] = useState<ThermalProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    constructionYear: "",
    numberOfFloors: "",
    buildingHeight: "",
    volumeChauffee: "",
    insulationLevel: "",
    glazingType: "",
    ventilationType: "",
  });

  useEffect(() => {
    fetchProfile();
  }, [siteId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sites/${siteId}/thermal-profile`);
      if (res.ok) {
        const profile = await res.json();
        setData(profile);
        // Pré-remplir le formulaire
        setForm({
          constructionYear: profile.site.constructionYear?.toString() || "",
          numberOfFloors: profile.site.numberOfFloors?.toString() || "",
          buildingHeight: profile.site.buildingHeight?.toString() || "",
          volumeChauffee: profile.site.volumeChauffee?.toString() || "",
          insulationLevel: profile.site.insulationLevel || "",
          glazingType: profile.site.glazingType || "",
          ventilationType: profile.site.ventilationType || "",
        });
      }
    } catch (error) {
      console.error("Error fetching thermal profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        fetchProfile();
      }
    } catch (error) {
      console.error("Error saving building characteristics:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ChartCard title="Profil thermique" icon={Thermometer}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (!data) return null;

  const { site, gEstimation, bestGReal, diagnostic, estimations, gReelBySeason } =
    data;

  const hasCharacteristics =
    site.constructionYear || site.insulationLevel;
  const hasRealG = bestGReal && bestGReal.value > 0;

  // Barre de jauge G
  const gMax = 2.0; // Échelle max pour la jauge
  const gEstPercent = Math.min((gEstimation.gTypical / gMax) * 100, 100);
  const gRealPercent = hasRealG
    ? Math.min((bestGReal.value / gMax) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Caractéristiques bâtiment */}
      <ChartCard title="Profil thermique" icon={Thermometer}>
        <div className="space-y-6">
          {/* Résumé caractéristiques ou formulaire */}
          {!showForm ? (
            <div>
              {hasCharacteristics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Construction</p>
                    <p className="font-semibold">
                      {site.constructionYear || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Isolation</p>
                    <p className="font-semibold">
                      {site.insulationLevel
                        ? INSULATION_LABELS[site.insulationLevel]
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vitrage</p>
                    <p className="font-semibold">
                      {site.glazingType
                        ? GLAZING_LABELS[site.glazingType]
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ventilation</p>
                    <p className="font-semibold">
                      {site.ventilationType
                        ? VENTILATION_LABELS[site.ventilationType]
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Surface chauffée</p>
                    <p className="font-semibold">
                      {site.surfaceChauffee
                        ? `${site.surfaceChauffee.toLocaleString("fr-FR")} m²`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Volume chauffé</p>
                    <p className="font-semibold">
                      {site.volumeChauffee
                        ? `${site.volumeChauffee.toLocaleString("fr-FR")} m³`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hauteur</p>
                    <p className="font-semibold">
                      {site.buildingHeight ? `${site.buildingHeight} m` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Niveaux</p>
                    <p className="font-semibold">
                      {site.numberOfFloors || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Building2
                    size={40}
                    className="mx-auto text-gray-300 mb-3"
                  />
                  <p>
                    Aucune caractéristique bâtiment renseignée.
                  </p>
                  <p className="text-sm">
                    Renseignez les données pour obtenir un profil thermique.
                  </p>
                </div>
              )}

              <ReadOnlyGate>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(!showForm)}
                  >
                    {hasCharacteristics ? "Modifier" : "Renseigner"}
                  </Button>
                </div>
              </ReadOnlyGate>
            </div>
          ) : (
            /* Formulaire d'édition */
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Année de construction
                  </label>
                  <input
                    type="number"
                    value={form.constructionYear}
                    onChange={(e) =>
                      setForm({ ...form, constructionYear: e.target.value })
                    }
                    placeholder="Ex: 1985"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Isolation
                  </label>
                  <select
                    value={form.insulationLevel}
                    onChange={(e) =>
                      setForm({ ...form, insulationLevel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">-- Auto (année) --</option>
                    {Object.entries(INSULATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vitrage
                  </label>
                  <select
                    value={form.glazingType}
                    onChange={(e) =>
                      setForm({ ...form, glazingType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">-- Non renseigné --</option>
                    {Object.entries(GLAZING_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ventilation
                  </label>
                  <select
                    value={form.ventilationType}
                    onChange={(e) =>
                      setForm({ ...form, ventilationType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">-- Non renseigné --</option>
                    {Object.entries(VENTILATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hauteur sous plafond (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.buildingHeight}
                    onChange={(e) =>
                      setForm({ ...form, buildingHeight: e.target.value })
                    }
                    placeholder="Ex: 3.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de niveaux
                  </label>
                  <input
                    type="number"
                    value={form.numberOfFloors}
                    onChange={(e) =>
                      setForm({ ...form, numberOfFloors: e.target.value })
                    }
                    placeholder="Ex: 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume chauffé (m³)
                  </label>
                  <input
                    type="number"
                    value={form.volumeChauffee}
                    onChange={(e) =>
                      setForm({ ...form, volumeChauffee: e.target.value })
                    }
                    placeholder={
                      site.surfaceChauffee && form.buildingHeight
                        ? `Auto: ${(site.surfaceChauffee * parseFloat(form.buildingHeight || "0")).toLocaleString("fr-FR")} m³`
                        : "Ex: 5000"
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      </ChartCard>

      {/* Comparaison G estimé vs G réel */}
      {(hasCharacteristics || hasRealG) && (
        <ChartCard
          title="Coefficient G — Estimé vs Réel"
          icon={TrendingUp}
        >
          <div className="space-y-6">
            {/* Jauge comparative */}
            <div className="space-y-4">
              {/* G Estimé */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    G estimé ({gEstimation.insulationUsed})
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {gEstimation.gTypical} W/m³.°C
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4 relative">
                  <div
                    className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${gEstPercent}%` }}
                  />
                  {/* Plage min-max */}
                  <div
                    className="absolute top-0 h-4 border-l-2 border-blue-300"
                    style={{
                      left: `${Math.min((gEstimation.gMin / gMax) * 100, 100)}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 h-4 border-l-2 border-blue-300"
                    style={{
                      left: `${Math.min((gEstimation.gMax / gMax) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Plage : {gEstimation.gMin} — {gEstimation.gMax} W/m³.°C
                </p>
              </div>

              {/* G Réel */}
              {hasRealG ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      G réel (saison {bestGReal.season})
                    </span>
                    <span className="text-sm font-bold text-emerald-600">
                      {bestGReal.value} W/m³.°C
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="bg-emerald-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${gRealPercent}%` }}
                    />
                  </div>
                  {bestGReal.reliability !== "HIGH" && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Fiabilité {bestGReal.reliability === "MEDIUM" ? "moyenne" : "faible"}
                      {bestGReal.reliabilityReason && ` — ${bestGReal.reliabilityReason}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  G réel non disponible — nécessite au moins 1 saison de
                  consommation + DJU
                </div>
              )}

              {/* Légende échelle */}
              <div className="flex justify-between text-xs text-gray-400 px-1">
                <span>0</span>
                <span>0.5</span>
                <span>1.0</span>
                <span>1.5</span>
                <span>2.0</span>
              </div>
            </div>

            {/* Historique G réel par saison */}
            {gReelBySeason.length > 1 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Évolution par saison
                </p>
                <div className="flex gap-4">
                  {gReelBySeason.map((g) => (
                    <div
                      key={g.season}
                      className="flex-1 text-center bg-gray-50 rounded-lg p-3"
                    >
                      <p className="text-xs text-gray-500">{g.season}</p>
                      <p className="text-lg font-bold text-gray-900">
                        {g.value}
                      </p>
                      <p className="text-xs text-gray-500">W/m³.°C</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estimations */}
            {estimations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-700 mb-2 uppercase">
                    Depuis G estimé
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-gray-600">Puissance :</span>{" "}
                      <strong>
                        {estimations.fromEstimated.heatingPowerKw} kW
                      </strong>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Conso théorique :</span>{" "}
                      <strong>
                        {estimations.fromEstimated.theoreticalConsumptionMwh} MWh/an
                      </strong>
                    </p>
                  </div>
                </div>
                {estimations.fromReal && (
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-emerald-700 mb-2 uppercase">
                      Depuis G réel
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-gray-600">Puissance :</span>{" "}
                        <strong>
                          {estimations.fromReal.heatingPowerKw} kW
                        </strong>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-600">Conso théorique :</span>{" "}
                        <strong>
                          {estimations.fromReal.theoreticalConsumptionMwh} MWh/an
                        </strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ChartCard>
      )}

      {/* Diagnostic */}
      {diagnostic && hasRealG && (
        <div
          className={`rounded-xl border p-6 ${DIAGNOSTIC_CONFIG[diagnostic.level].bg} ${DIAGNOSTIC_CONFIG[diagnostic.level].border}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-2 rounded-lg ${DIAGNOSTIC_CONFIG[diagnostic.level].color}`}
            >
              {diagnostic.level === "PERFORMANT" || diagnostic.level === "CONFORME" ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3
                  className={`font-semibold text-lg ${DIAGNOSTIC_CONFIG[diagnostic.level].color}`}
                >
                  {diagnostic.level === "PERFORMANT" && "Bâtiment performant"}
                  {diagnostic.level === "CONFORME" && "Bâtiment conforme"}
                  {diagnostic.level === "ATTENTION" && "Attention — Écart détecté"}
                  {diagnostic.level === "CRITIQUE" && "Critique — Anomalie thermique"}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${DIAGNOSTIC_CONFIG[diagnostic.level].color}`}
                >
                  {diagnostic.ecartPercent > 0 ? "+" : ""}
                  {diagnostic.ecartPercent}%
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{diagnostic.message}</p>
              <p className="text-sm text-gray-600">{diagnostic.recommendation}</p>

              {diagnostic.auditRecommended && (
                <div className="mt-4 flex items-center gap-3">
                  <ClipboardCheck
                    size={18}
                    className="text-yellow-700"
                  />
                  <span className="text-sm font-medium text-yellow-800">
                    Mission d'audit énergétique recommandée
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
