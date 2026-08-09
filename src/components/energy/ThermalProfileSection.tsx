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
  Clock,
  Plus,
  Trash2,
  Pencil,
  X,
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

interface OccupationZone {
  id: string;
  name: string;
  surface: number | null;
  tempConsigne: number;
  tempReduit: number;
  weeklySchedule: Record<string, Array<{ start: string; end: string }>> | null;
}

const DAYS_OF_WEEK = [
  { key: "lundi", label: "Lun" },
  { key: "mardi", label: "Mar" },
  { key: "mercredi", label: "Mer" },
  { key: "jeudi", label: "Jeu" },
  { key: "vendredi", label: "Ven" },
  { key: "samedi", label: "Sam" },
  { key: "dimanche", label: "Dim" },
];

const DEFAULT_SCHEDULE: Record<string, Array<{ start: string; end: string }>> = {
  lundi: [{ start: "08:00", end: "18:00" }],
  mardi: [{ start: "08:00", end: "18:00" }],
  mercredi: [{ start: "08:00", end: "18:00" }],
  jeudi: [{ start: "08:00", end: "18:00" }],
  vendredi: [{ start: "08:00", end: "18:00" }],
  samedi: [],
  dimanche: [],
};

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
    border: "border-green-600/20",
    icon: CheckCircle2,
  },
  CONFORME: {
    color: "text-ink",
    bg: "bg-white",
    border: "border-ink/15",
    icon: CheckCircle2,
  },
  ATTENTION: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-600/20",
    icon: AlertTriangle,
  },
  CRITIQUE: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-600/20",
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

  // Zones d'occupation
  const [zones, setZones] = useState<OccupationZone[]>([]);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editingZone, setEditingZone] = useState<OccupationZone | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    surface: "",
    tempConsigne: "19",
    tempReduit: "16",
    weeklySchedule: DEFAULT_SCHEDULE,
  });

  useEffect(() => {
    fetchProfile();
    fetchZones();
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

  const fetchZones = async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/occupation-zones`);
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  };

  const resetZoneForm = () => {
    setZoneForm({
      name: "",
      surface: "",
      tempConsigne: "19",
      tempReduit: "16",
      weeklySchedule: DEFAULT_SCHEDULE,
    });
    setEditingZone(null);
    setShowZoneForm(false);
  };

  const openEditZone = (zone: OccupationZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      surface: zone.surface?.toString() || "",
      tempConsigne: zone.tempConsigne.toString(),
      tempReduit: zone.tempReduit.toString(),
      weeklySchedule: zone.weeklySchedule || DEFAULT_SCHEDULE,
    });
    setShowZoneForm(true);
  };

  const handleSaveZone = async () => {
    setSavingZone(true);
    try {
      const url = editingZone
        ? `/api/sites/${siteId}/occupation-zones/${editingZone.id}`
        : `/api/sites/${siteId}/occupation-zones`;
      const method = editingZone ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zoneForm),
      });

      if (res.ok) {
        resetZoneForm();
        fetchZones();
      }
    } catch (error) {
      console.error("Error saving zone:", error);
    } finally {
      setSavingZone(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Supprimer cette zone d'occupation ?")) return;
    try {
      const res = await fetch(
        `/api/sites/${siteId}/occupation-zones/${zoneId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchZones();
      }
    } catch (error) {
      console.error("Error deleting zone:", error);
    }
  };

  const updateScheduleSlot = (
    day: string,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setZoneForm((prev) => {
      const schedule = { ...prev.weeklySchedule };
      const daySlots = [...(schedule[day] || [])];
      daySlots[index] = { ...daySlots[index], [field]: value };
      schedule[day] = daySlots;
      return { ...prev, weeklySchedule: schedule };
    });
  };

  const addScheduleSlot = (day: string) => {
    setZoneForm((prev) => {
      const schedule = { ...prev.weeklySchedule };
      const daySlots = [...(schedule[day] || [])];
      daySlots.push({ start: "08:00", end: "18:00" });
      schedule[day] = daySlots;
      return { ...prev, weeklySchedule: schedule };
    });
  };

  const removeScheduleSlot = (day: string, index: number) => {
    setZoneForm((prev) => {
      const schedule = { ...prev.weeklySchedule };
      const daySlots = [...(schedule[day] || [])];
      daySlots.splice(index, 1);
      schedule[day] = daySlots;
      return { ...prev, weeklySchedule: schedule };
    });
  };

  const formatScheduleSummary = (
    schedule: Record<string, Array<{ start: string; end: string }>> | null
  ) => {
    if (!schedule) return "Non défini";
    const activeDays = DAYS_OF_WEEK.filter(
      (d) => schedule[d.key] && schedule[d.key].length > 0
    );
    if (activeDays.length === 0) return "Aucun";
    return activeDays.map((d) => d.label).join(", ");
  };

  if (loading) {
    return (
      <ChartCard title={<span className="flex items-center gap-2"><Thermometer className="h-5 w-5 text-accent" />Profil thermique</span>}>
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
      <ChartCard title={<span className="flex items-center gap-2"><Thermometer className="h-5 w-5 text-accent" />Profil thermique</span>}>
        <div className="space-y-6">
          {/* Résumé caractéristiques ou formulaire */}
          {!showForm ? (
            <div>
              {hasCharacteristics ? (
                <div className="grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 md:grid-cols-4">
                  <div className="bg-white p-3">
                    <p className="label-tech">Construction</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {site.constructionYear || "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Isolation</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {site.insulationLevel
                        ? INSULATION_LABELS[site.insulationLevel]
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Vitrage</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {site.glazingType
                        ? GLAZING_LABELS[site.glazingType]
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Ventilation</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {site.ventilationType
                        ? VENTILATION_LABELS[site.ventilationType]
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Surface chauffée</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {site.surfaceChauffee
                        ? `${site.surfaceChauffee.toLocaleString("fr-FR")} m²`
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Volume chauffé</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {site.volumeChauffee
                        ? `${site.volumeChauffee.toLocaleString("fr-FR")} m³`
                        : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Hauteur</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {site.buildingHeight ? `${site.buildingHeight} m` : "-"}
                    </p>
                  </div>
                  <div className="bg-white p-3">
                    <p className="label-tech">Niveaux</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                      {site.numberOfFloors || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-ink/15 py-6 text-center">
                  <Building2 size={40} className="mx-auto mb-3 text-ink/20" />
                  <p className="text-sm font-medium text-ink">
                    Aucune caractéristique bâtiment renseignée.
                  </p>
                  <p className="mt-1 text-xs text-ink/50">
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
                  <label className="label-tech mb-1 block">
                    Année de construction
                  </label>
                  <input
                    type="number"
                    value={form.constructionYear}
                    onChange={(e) =>
                      setForm({ ...form, constructionYear: e.target.value })
                    }
                    placeholder="Ex: 1985"
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">
                    Isolation
                  </label>
                  <select
                    value={form.insulationLevel}
                    onChange={(e) =>
                      setForm({ ...form, insulationLevel: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
                  <label className="label-tech mb-1 block">
                    Vitrage
                  </label>
                  <select
                    value={form.glazingType}
                    onChange={(e) =>
                      setForm({ ...form, glazingType: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
                  <label className="label-tech mb-1 block">
                    Ventilation
                  </label>
                  <select
                    value={form.ventilationType}
                    onChange={(e) =>
                      setForm({ ...form, ventilationType: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
                  <label className="label-tech mb-1 block">
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
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">
                    Nombre de niveaux
                  </label>
                  <input
                    type="number"
                    value={form.numberOfFloors}
                    onChange={(e) =>
                      setForm({ ...form, numberOfFloors: e.target.value })
                    }
                    placeholder="Ex: 2"
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label-tech mb-1 block">
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
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
          title={<span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-accent" />Coefficient G — Estimé vs Réel</span>}
        >
          <div className="space-y-6">
            {/* Jauge comparative */}
            <div className="space-y-4">
              {/* G Estimé */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label-tech">
                    G estimé ({gEstimation.insulationUsed})
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-accent">
                    {gEstimation.gTypical} W/m³.°C
                  </span>
                </div>
                <div className="relative h-3 w-full border border-ink/10 bg-ink/[0.03]">
                  <div
                    className="h-full bg-accent transition-all duration-500"
                    style={{ width: `${gEstPercent}%` }}
                  />
                  {/* Plage min-max */}
                  <div
                    className="absolute top-0 h-full border-l border-accent/40"
                    style={{
                      left: `${Math.min((gEstimation.gMin / gMax) * 100, 100)}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 h-full border-l border-accent/40"
                    style={{
                      left: `${Math.min((gEstimation.gMax / gMax) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-ink/50">
                  Plage : {gEstimation.gMin} — {gEstimation.gMax} W/m³.°C
                </p>
              </div>

              {/* G Réel */}
              {hasRealG ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="label-tech">
                      G réel (saison {bestGReal.season})
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {bestGReal.value} W/m³.°C
                    </span>
                  </div>
                  <div className="h-3 w-full border border-ink/10 bg-ink/[0.03]">
                    <div
                      className="h-full bg-ink transition-all duration-500"
                      style={{ width: `${gRealPercent}%` }}
                    />
                  </div>
                  {bestGReal.reliability !== "HIGH" && (
                    <p className="mt-1 text-xs text-amber-700">
                      Fiabilité {bestGReal.reliability === "MEDIUM" ? "moyenne" : "faible"}
                      {bestGReal.reliabilityReason && ` — ${bestGReal.reliabilityReason}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-ink/50">
                  G réel non disponible — nécessite au moins 1 saison de
                  consommation + DJU
                </div>
              )}

              {/* Légende échelle */}
              <div className="flex justify-between px-1 font-mono text-[11px] tabular-nums text-ink/40">
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
                <p className="label-tech mb-2">Évolution par saison</p>
                <div className="flex gap-px border border-ink/10 bg-ink/10">
                  {gReelBySeason.map((g) => (
                    <div key={g.season} className="flex-1 bg-white p-3 text-center">
                      <p className="label-tech">{g.season}</p>
                      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">
                        {g.value}
                      </p>
                      <p className="font-mono text-[11px] text-ink/50">W/m³.°C</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estimations */}
            {estimations && (
              <div className="grid grid-cols-1 gap-4 border-t border-ink/10 pt-4 md:grid-cols-2">
                <div className="border border-ink/10 bg-white p-4">
                  <p className="label-tech mb-2 text-accent/70">
                    Depuis G estimé
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm text-ink">
                      <span className="text-ink/50">Puissance :</span>{" "}
                      <strong className="font-mono tabular-nums">
                        {estimations.fromEstimated.heatingPowerKw} kW
                      </strong>
                    </p>
                    <p className="text-sm text-ink">
                      <span className="text-ink/50">Conso théorique :</span>{" "}
                      <strong className="font-mono tabular-nums">
                        {estimations.fromEstimated.theoreticalConsumptionMwh} MWh/an
                      </strong>
                    </p>
                  </div>
                </div>
                {estimations.fromReal && (
                  <div className="border border-ink/10 bg-white p-4">
                    <p className="label-tech mb-2">Depuis G réel</p>
                    <div className="space-y-1">
                      <p className="text-sm text-ink">
                        <span className="text-ink/50">Puissance :</span>{" "}
                        <strong className="font-mono tabular-nums">
                          {estimations.fromReal.heatingPowerKw} kW
                        </strong>
                      </p>
                      <p className="text-sm text-ink">
                        <span className="text-ink/50">Conso théorique :</span>{" "}
                        <strong className="font-mono tabular-nums">
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
          className={`border p-4 ${DIAGNOSTIC_CONFIG[diagnostic.level].bg} ${DIAGNOSTIC_CONFIG[diagnostic.level].border}`}
        >
          <div className="flex items-start gap-4">
            <div className={DIAGNOSTIC_CONFIG[diagnostic.level].color}>
              {diagnostic.level === "PERFORMANT" || diagnostic.level === "CONFORME" ? (
                <CheckCircle2 size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
            </div>
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h3
                  className={`text-base font-semibold ${DIAGNOSTIC_CONFIG[diagnostic.level].color}`}
                >
                  {diagnostic.level === "PERFORMANT" && "Bâtiment performant"}
                  {diagnostic.level === "CONFORME" && "Bâtiment conforme"}
                  {diagnostic.level === "ATTENTION" && "Attention — Écart détecté"}
                  {diagnostic.level === "CRITIQUE" && "Critique — Anomalie thermique"}
                </h3>
                <span
                  className={`border border-ink/15 px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${DIAGNOSTIC_CONFIG[diagnostic.level].color}`}
                >
                  {diagnostic.ecartPercent > 0 ? "+" : ""}
                  {diagnostic.ecartPercent}%
                </span>
              </div>
              <p className="mb-3 text-sm text-ink">{diagnostic.message}</p>
              <p className="text-sm text-ink/60">{diagnostic.recommendation}</p>

              {diagnostic.auditRecommended && (
                <div className="mt-4 flex items-center gap-3 border-t border-ink/10 pt-3">
                  <ClipboardCheck size={18} className="text-amber-700" />
                  <span className="text-sm font-medium text-amber-700">
                    Mission d&apos;audit énergétique recommandée
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zones d'occupation & Températures */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Zones d'occupation & Températures de consigne
          </span>
        }
      >
        <div className="space-y-4">
          {/* Liste des zones */}
          {zones.length > 0 ? (
            <div className="space-y-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="border border-ink/10 bg-white p-4 transition-colors hover:border-ink/25"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h4 className="font-semibold text-ink">{zone.name}</h4>
                        {zone.surface && (
                          <span className="border border-ink/15 px-2 py-0.5 font-mono text-[11px] tabular-nums text-ink/60">
                            {zone.surface} m²
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                          <span className="text-ink/50">T° consigne :</span>{" "}
                          <strong className="font-mono tabular-nums text-ink">
                            {zone.tempConsigne}°C
                          </strong>
                        </div>
                        <div>
                          <span className="text-ink/50">T° réduit :</span>{" "}
                          <strong className="font-mono tabular-nums text-accent">
                            {zone.tempReduit}°C
                          </strong>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-ink/50">Occupation :</span>{" "}
                          <strong className="text-ink">
                            {formatScheduleSummary(zone.weeklySchedule)}
                          </strong>
                        </div>
                      </div>
                      {/* Grille visuelle planning */}
                      {zone.weeklySchedule && (
                        <div className="mt-3 flex gap-1">
                          {DAYS_OF_WEEK.map((day) => {
                            const slots = zone.weeklySchedule?.[day.key] || [];
                            const isActive = slots.length > 0;
                            return (
                              <div
                                key={day.key}
                                className="flex-1 text-center"
                                title={
                                  isActive
                                    ? slots
                                        .map((s) => `${s.start}-${s.end}`)
                                        .join(", ")
                                    : "Fermé"
                                }
                              >
                                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-ink/40">
                                  {day.label}
                                </div>
                                <div
                                  className={`h-2 ${
                                    isActive ? "bg-ink" : "bg-ink/10"
                                  }`}
                                />
                                {isActive && (
                                  <div className="mt-0.5 font-mono text-[9px] tabular-nums text-ink/40">
                                    {slots[0].start}-{slots[0].end}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <ReadOnlyGate>
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => openEditZone(zone)}
                          className="p-1.5 text-ink/40 transition-colors hover:text-accent"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-1.5 text-ink/40 transition-colors hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </ReadOnlyGate>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-ink/15 py-6 text-center">
              <Clock size={36} className="mx-auto mb-3 text-ink/20" />
              <p className="text-sm font-medium text-ink">
                Aucune zone d&apos;occupation définie.
              </p>
              <p className="mt-1 text-xs text-ink/50">
                Ajoutez des zones pour définir les températures de consigne et
                les horaires d&apos;occupation.
              </p>
            </div>
          )}

          {/* Formulaire ajout/édition zone */}
          {showZoneForm ? (
            <div className="space-y-4 border border-ink/15 bg-white p-4">
              <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                <h4 className="label-tech text-ink">
                  {editingZone ? "Modifier la zone" : "Nouvelle zone"}
                </h4>
                <button
                  onClick={resetZoneForm}
                  className="p-1 text-ink/40 transition-colors hover:text-accent"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nom + Surface */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="label-tech mb-1 block">
                    Nom de la zone
                  </label>
                  <input
                    type="text"
                    value={zoneForm.name}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, name: e.target.value })
                    }
                    placeholder="Ex: Salles de classe, Bureaux, Gymnase..."
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">
                    Surface (m²)
                  </label>
                  <input
                    type="number"
                    value={zoneForm.surface}
                    onChange={(e) =>
                      setZoneForm({ ...zoneForm, surface: e.target.value })
                    }
                    placeholder="Optionnel"
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Températures */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">
                    T° consigne occupation (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={zoneForm.tempConsigne}
                    onChange={(e) =>
                      setZoneForm({
                        ...zoneForm,
                        tempConsigne: e.target.value,
                      })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-ink/50">
                    Température maintenue pendant l'occupation
                  </p>
                </div>
                <div>
                  <label className="label-tech mb-1 block">
                    T° réduit hors occupation (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={zoneForm.tempReduit}
                    onChange={(e) =>
                      setZoneForm({
                        ...zoneForm,
                        tempReduit: e.target.value,
                      })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-ink/50">
                    Température de nuit / week-end / vacances
                  </p>
                </div>
              </div>

              {/* Planning hebdomadaire */}
              <div>
                <label className="label-tech mb-2 block">
                  Planning hebdomadaire
                </label>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const slots = zoneForm.weeklySchedule[day.key] || [];
                    return (
                      <div
                        key={day.key}
                        className="flex items-start gap-3"
                      >
                        <span className="w-10 pt-2 font-mono text-xs uppercase tracking-widest text-ink/50">
                          {day.label}
                        </span>
                        <div className="flex-1 space-y-1">
                          {slots.length === 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="py-2 text-xs italic text-ink/40">
                                Fermé
                              </span>
                              <button
                                onClick={() => addScheduleSlot(day.key)}
                                className="text-xs text-accent hover:underline"
                              >
                                + Ajouter
                              </button>
                            </div>
                          ) : (
                            slots.map((slot, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(e) =>
                                    updateScheduleSlot(
                                      day.key,
                                      idx,
                                      "start",
                                      e.target.value
                                    )
                                  }
                                  className="border border-ink/20 bg-white px-2 py-1 font-mono text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
                                />
                                <span className="text-ink/40">—</span>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(e) =>
                                    updateScheduleSlot(
                                      day.key,
                                      idx,
                                      "end",
                                      e.target.value
                                    )
                                  }
                                  className="border border-ink/20 bg-white px-2 py-1 font-mono text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
                                />
                                <button
                                  onClick={() =>
                                    removeScheduleSlot(day.key, idx)
                                  }
                                  className="p-1 text-ink/40 transition-colors hover:text-red-600"
                                  title="Supprimer ce créneau"
                                >
                                  <X size={14} />
                                </button>
                                {idx === slots.length - 1 && (
                                  <button
                                    onClick={() =>
                                      addScheduleSlot(day.key)
                                    }
                                    className="text-xs text-accent hover:underline"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetZoneForm}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveZone}
                  disabled={savingZone || !zoneForm.name.trim()}
                >
                  {savingZone ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  {editingZone ? "Modifier" : "Ajouter"}
                </Button>
              </div>
            </div>
          ) : (
            <ReadOnlyGate>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetZoneForm();
                    setShowZoneForm(true);
                  }}
                >
                  <Plus size={16} className="mr-2" />
                  Ajouter une zone
                </Button>
              </div>
            </ReadOnlyGate>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
