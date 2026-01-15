"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  ClipboardCheck,
  Calendar,
  User,
  Eye,
  Gauge,
  Shield,
  Accessibility,
  FileCheck,
  MessageSquare,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AuditRating = "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT";

interface Equipment {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  status: string;
  site: {
    id: string;
    name: string;
    city: string;
  };
}

interface EquipmentAudit {
  id: string;
  auditDate: string;
  auditor: string | null;
  visualState: AuditRating;
  performance: AuditRating;
  security: AuditRating;
  accessibility: AuditRating;
  compliance: AuditRating;
  visualNotes: string | null;
  performanceNotes: string | null;
  securityNotes: string | null;
  accessibilityNotes: string | null;
  complianceNotes: string | null;
  generalNotes: string | null;
  photos: string[];
  createdAt: string;
}

const ratingConfig: Record<AuditRating, { label: string; color: string; bgColor: string }> = {
  NON_EVALUE: { label: "Non évalué", color: "text-gray-500", bgColor: "bg-gray-100" },
  CRITIQUE: { label: "Critique", color: "text-red-700", bgColor: "bg-red-100" },
  MAUVAIS: { label: "Mauvais", color: "text-orange-700", bgColor: "bg-orange-100" },
  MOYEN: { label: "Moyen", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  BON: { label: "Bon", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  EXCELLENT: { label: "Excellent", color: "text-green-700", bgColor: "bg-green-100" },
};

const ratingOptions: AuditRating[] = ["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"];

const equipmentTypeLabels: Record<string, string> = {
  CHAUDIERE: "Chaudière", CHAUDIERE_CONDENSATION: "Chaudière condensation",
  PAC: "Pompe à chaleur", PAC_AIR_EAU: "PAC air/eau", PAC_EAU_EAU: "PAC eau/eau", PAC_AIR_AIR: "PAC air/air",
  RADIATEUR: "Radiateur", PLANCHER_CHAUFFANT: "Plancher chauffant", CONVECTEUR: "Convecteur",
  VMC: "VMC", CTA: "CTA", GROUPE_FROID: "Groupe froid", CLIMATISATION: "Climatisation",
  BALLON_ECS: "Ballon ECS", COMPTEUR_ENERGIE: "Compteur d'énergie",
  AUTRE: "Autre",
};

export default function EquipmentAuditPage() {
  const params = useParams();
  const router = useRouter();
  const equipmentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [audits, setAudits] = useState<EquipmentAudit[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split("T")[0]);
  const [auditor, setAuditor] = useState("");
  const [visualState, setVisualState] = useState<AuditRating>("NON_EVALUE");
  const [performance, setPerformance] = useState<AuditRating>("NON_EVALUE");
  const [security, setSecurity] = useState<AuditRating>("NON_EVALUE");
  const [accessibility, setAccessibility] = useState<AuditRating>("NON_EVALUE");
  const [compliance, setCompliance] = useState<AuditRating>("NON_EVALUE");
  const [visualNotes, setVisualNotes] = useState("");
  const [performanceNotes, setPerformanceNotes] = useState("");
  const [securityNotes, setSecurityNotes] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [equipmentId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch equipment details
      const eqRes = await fetch(`/api/equipments/${equipmentId}`);
      if (!eqRes.ok) throw new Error("Équipement non trouvé");
      const eqData = await eqRes.json();
      setEquipment(eqData);

      // Fetch audits history
      const auditsRes = await fetch(`/api/equipments/${equipmentId}/audits`);
      if (auditsRes.ok) {
        const auditsData = await auditsRes.json();
        setAudits(auditsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);

      const res = await fetch(`/api/equipments/${equipmentId}/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditDate,
          auditor: auditor || null,
          visualState,
          performance,
          security,
          accessibility,
          compliance,
          visualNotes: visualNotes || null,
          performanceNotes: performanceNotes || null,
          securityNotes: securityNotes || null,
          accessibilityNotes: accessibilityNotes || null,
          complianceNotes: complianceNotes || null,
          generalNotes: generalNotes || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erreur lors de la sauvegarde");
      }

      // Refresh and go back
      router.push("/exploitation?tab=equipements");
      router.refresh();
    } catch (error) {
      console.error("Error saving audit:", error);
      alert(error instanceof Error ? error.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function RatingSelector({
    value,
    onChange,
    label,
    icon: Icon
  }: {
    value: AuditRating;
    onChange: (v: AuditRating) => void;
    label: string;
    icon: React.ElementType;
  }) {
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Icon size={16} className="text-gray-500" />
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map((rating) => {
            const config = ratingConfig[rating];
            const isSelected = value === rating;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Équipement non trouvé</p>
        <Link href="/exploitation?tab=equipements" className="text-accent hover:underline mt-2 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/exploitation?tab=equipements"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
              <ClipboardCheck className="text-accent" />
              Audit équipement
            </h1>
            <p className="text-text-secondary">
              {equipment.name} - {equipmentTypeLabels[equipment.type] || equipment.type}
            </p>
          </div>
        </div>
      </div>

      {/* Equipment info card */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Site</span>
            <p className="font-medium">{equipment.site.name}</p>
          </div>
          <div>
            <span className="text-gray-500">Marque</span>
            <p className="font-medium">{equipment.brand || "-"}</p>
          </div>
          <div>
            <span className="text-gray-500">Modèle</span>
            <p className="font-medium">{equipment.model || "-"}</p>
          </div>
          <div>
            <span className="text-gray-500">Année</span>
            <p className="font-medium">{equipment.year || "-"}</p>
          </div>
        </div>
      </div>

      {/* Audit history toggle */}
      {audits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-500" />
              <span className="font-medium">Historique des audits ({audits.length})</span>
            </div>
            {showHistory ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {showHistory && (
            <div className="border-t border-gray-100 p-4 space-y-3">
              {audits.map((audit) => (
                <div key={audit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(audit.auditDate).toLocaleDateString("fr-FR")}
                      </p>
                      {audit.auditor && (
                        <p className="text-xs text-gray-500">Par {audit.auditor}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${ratingConfig[audit.visualState].bgColor} ${ratingConfig[audit.visualState].color}`}>
                      {ratingConfig[audit.visualState].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Nouvel audit</h2>

        {/* Date and auditor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="text-gray-500" />
              Date de l&apos;audit
            </label>
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
              required
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User size={16} className="text-gray-500" />
              Auditeur
            </label>
            <input
              type="text"
              value={auditor}
              onChange={(e) => setAuditor(e.target.value)}
              placeholder="Nom de l'auditeur"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>

        {/* Ratings */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Évaluations</h3>

          <RatingSelector
            value={visualState}
            onChange={setVisualState}
            label="État visuel"
            icon={Eye}
          />
          <div>
            <textarea
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
              placeholder="Notes sur l'état visuel..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <RatingSelector
            value={performance}
            onChange={setPerformance}
            label="Performance"
            icon={Gauge}
          />
          <div>
            <textarea
              value={performanceNotes}
              onChange={(e) => setPerformanceNotes(e.target.value)}
              placeholder="Notes sur la performance..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <RatingSelector
            value={security}
            onChange={setSecurity}
            label="Sécurité"
            icon={Shield}
          />
          <div>
            <textarea
              value={securityNotes}
              onChange={(e) => setSecurityNotes(e.target.value)}
              placeholder="Notes sur la sécurité..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <RatingSelector
            value={accessibility}
            onChange={setAccessibility}
            label="Accessibilité"
            icon={Accessibility}
          />
          <div>
            <textarea
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
              placeholder="Notes sur l'accessibilité..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <RatingSelector
            value={compliance}
            onChange={setCompliance}
            label="Conformité réglementaire"
            icon={FileCheck}
          />
          <div>
            <textarea
              value={complianceNotes}
              onChange={(e) => setComplianceNotes(e.target.value)}
              placeholder="Notes sur la conformité..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>

        {/* General notes */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <MessageSquare size={16} className="text-gray-500" />
            Observations générales
          </label>
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Observations générales sur l'équipement..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link href="/exploitation?tab=equipements">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Enregistrer l&apos;audit
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
