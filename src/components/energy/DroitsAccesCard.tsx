"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Plus,
  Loader2,
  X,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface DroitAcces {
  id_droit_acces: string;
  id_pce: string;
  etat_droit_acces: string;
  role_tiers: string;
  raison_sociale_du_tiers: string;
  nom_titulaire: string;
  courriel_titulaire: string;
  code_postal: string;
  perim_donnees_techniques_et_contractuelles: string;
  perim_historique_de_donnees: string;
  perim_flux_de_donnees: string;
  perim_donnees_informatives: string;
  perim_donnees_publiees: string;
  date_creation: string;
  date_fin_autorisation: string;
  parcours: string;
  statut_controle_preuve: string | null;
  date_limite_transmission_preuve: string | null;
}

const ETAT_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; bg: string }> = {
  Active: { icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50" },
  "Révoquée": { icon: ShieldX, color: "text-red-600", bg: "bg-red-50" },
  "Refusée": { icon: ShieldX, color: "text-red-600", bg: "bg-red-50" },
  "Obsolète": { icon: ShieldAlert, color: "text-gray-500", bg: "bg-gray-50" },
  "A valider": { icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  "A revérifier": { icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-50" },
  "En attente": { icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
};

const DEFAULT_ETAT = { icon: Shield, color: "text-gray-500", bg: "bg-gray-50" };

export function DroitsAccesCard() {
  const [droits, setDroits] = useState<DroitAcces[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPreuveModal, setShowPreuveModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDroits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/energy/grdf/droits-acces");
      if (res.ok) {
        const data = await res.json();
        setDroits(data.droits || []);
        setError(null);
      } else if (res.status === 400) {
        // GRDF not connected - not an error, just no data
        setDroits([]);
        setError(null);
      } else {
        const data = await res.json();
        setError(data.error || "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDroits();
  }, []);

  if (loading) {
    return (
      <ChartCard title="Droits d'accès GRDF">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard title="Droits d'accès GRDF">
        <p className="text-sm text-red-600">{error}</p>
      </ChartCard>
    );
  }

  const actifs = droits.filter((d) => d.etat_droit_acces === "Active");
  const enAttente = droits.filter(
    (d) => d.statut_controle_preuve === "Preuve en attente" || d.statut_controle_preuve === "Preuve en cours de vérification"
  );

  return (
    <>
      <ChartCard
        title="Droits d'accès GRDF"
        subtitle={`${actifs.length} actif(s) sur ${droits.length} total`}
        action={
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} className="mr-1" />
            Déclarer un accès
          </Button>
        }
      >
        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto p-1 hover:bg-black/10 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Alert for pending proofs */}
        {enAttente.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert size={16} />
              <span className="text-sm font-medium">
                {enAttente.length} droit(s) d&apos;accès en attente de preuve
              </span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              GRDF peut vous demander de transmettre une preuve de consentement sous 20 jours ouvrés.
            </p>
          </div>
        )}

        {droits.length === 0 ? (
          <div className="text-center py-8">
            <Shield size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Aucun droit d&apos;accès déclaré</p>
            <p className="text-xs text-gray-400 mt-1">
              Déclarez un droit d&apos;accès pour chaque PCE dont vous souhaitez récupérer les données
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {droits.map((droit) => {
              const config = ETAT_CONFIG[droit.etat_droit_acces] || DEFAULT_ETAT;
              const Icon = config.icon;
              const needsProof =
                droit.statut_controle_preuve === "Preuve en attente" &&
                droit.date_limite_transmission_preuve;

              return (
                <div
                  key={droit.id_droit_acces}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <Icon size={18} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-primary-dark">
                          {droit.id_pce}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}
                        >
                          {droit.etat_droit_acces}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {droit.nom_titulaire} &middot; {droit.role_tiers.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                        <span>
                          Créé : {droit.date_creation?.split(" ")[0]} → Fin : {droit.date_fin_autorisation?.split(" ")[0]}
                        </span>
                        <span>
                          {droit.perim_historique_de_donnees === "Vrai" ? "Historique" : ""}
                          {droit.perim_flux_de_donnees === "Vrai" ? " + Flux" : ""}
                          {droit.perim_donnees_publiees === "Vrai" ? " + Publiées" : ""}
                        </span>
                      </div>
                      {droit.statut_controle_preuve && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <FileText size={12} className="text-gray-400" />
                          <span className="text-[11px] text-gray-500">
                            {droit.statut_controle_preuve}
                          </span>
                          {needsProof && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-2 h-6 text-[11px] px-2"
                              onClick={() => setShowPreuveModal(droit.id_droit_acces)}
                            >
                              <Upload size={12} className="mr-1" />
                              Transmettre
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Modal: Déclarer un droit d'accès */}
      {showModal && (
        <DeclarerDroitModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            setMessage({ type: "success", text: "Droit d'accès déclaré avec succès" });
            fetchDroits();
          }}
          onError={(err) => setMessage({ type: "error", text: err })}
        />
      )}

      {/* Modal: Transmettre preuve */}
      {showPreuveModal && (
        <TransmettrePreuveModal
          idDroitAcces={showPreuveModal}
          onClose={() => setShowPreuveModal(null)}
          onSuccess={() => {
            setShowPreuveModal(null);
            setMessage({ type: "success", text: "Preuve(s) transmise(s) avec succès" });
            fetchDroits();
          }}
          onError={(err) => setMessage({ type: "error", text: err })}
        />
      )}
    </>
  );
}

// ─── Modal: Déclarer un droit d'accès ──────────────────────────────────────

function DeclarerDroitModal({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  onSuccess: () => void;
  onError: (err: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    pce: "",
    role_tiers: "AUTORISE_CONTRAT_FOURNITURE",
    raison_sociale: "",
    nom_titulaire: "",
    code_postal: "",
    courriel_titulaire: "",
    date_consentement_declaree: new Date().toISOString().replace("Z", "").split(".")[0],
    date_fin_autorisation_demandee: (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split("T")[0];
    })(),
    perim_donnees_techniques_et_contractuelles: "Vrai",
    perim_historique_de_donnees: "Vrai",
    perim_flux_de_donnees: "Vrai",
    perim_donnees_informatives: "Vrai",
    perim_donnees_publiees: "Vrai",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/energy/grdf/droits-acces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        onError(data.error || "Erreur lors de la déclaration");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-primary-dark">
            Déclarer un droit d&apos;accès
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-text-secondary">
            Déclarez un droit d&apos;accès pour récupérer les données de consommation d&apos;un PCE.
            Le titulaire recevra un email/SMS de validation de GRDF.
          </p>

          {/* PCE */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Numéro PCE *
            </label>
            <input
              type="text"
              required
              value={form.pce}
              onChange={(e) => updateField("pce", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="14 chiffres ou GI + 6 chiffres"
            />
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Rôle tiers *
            </label>
            <select
              value={form.role_tiers}
              onChange={(e) => updateField("role_tiers", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="AUTORISE_CONTRAT_FOURNITURE">Autorisé - Contrat de fourniture</option>
              <option value="AUTORISE_HORS_CONTRAT_FOURNITURE">Autorisé - Hors contrat de fourniture</option>
              <option value="DETENTEUR">Détenteur (titulaire du PCE)</option>
            </select>
          </div>

          {/* Raison sociale + Titulaire */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Raison sociale *
              </label>
              <input
                type="text"
                required
                value={form.raison_sociale}
                onChange={(e) => updateField("raison_sociale", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Votre entreprise"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Nom titulaire *
              </label>
              <input
                type="text"
                required
                value={form.nom_titulaire}
                onChange={(e) => updateField("nom_titulaire", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Nom du client"
              />
            </div>
          </div>

          {/* Code postal + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Code postal *
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={form.code_postal}
                onChange={(e) => updateField("code_postal", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="75001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                Email titulaire *
              </label>
              <input
                type="email"
                required
                value={form.courriel_titulaire}
                onChange={(e) => updateField("courriel_titulaire", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="contact@mairie.fr"
              />
            </div>
          </div>

          {/* Fin autorisation */}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Fin autorisation demandée *
            </label>
            <input
              type="date"
              required
              value={form.date_fin_autorisation_demandee}
              onChange={(e) => updateField("date_fin_autorisation_demandee", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* Périmètre données */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary-dark">Périmètre des données</p>
            {[
              { key: "perim_donnees_techniques_et_contractuelles", label: "Données techniques et contractuelles" },
              { key: "perim_historique_de_donnees", label: "Historique de données" },
              { key: "perim_flux_de_donnees", label: "Flux de données" },
              { key: "perim_donnees_informatives", label: "Données informatives" },
              { key: "perim_donnees_publiees", label: "Données publiées" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] === "Vrai"}
                  onChange={(e) => updateField(key, e.target.checked ? "Vrai" : "Faux")}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Parcours Tiers Direct :</strong> GRDF enverra un email/SMS au titulaire
              pour valider la demande. Pour une entité morale, l&apos;accès est activé sous 2 jours
              sans réponse.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Déclaration...
                </>
              ) : (
                "Déclarer le droit d'accès"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Transmettre preuve ─────────────────────────────────────────────

function TransmettrePreuveModal({
  idDroitAcces,
  onClose,
  onSuccess,
  onError,
}: {
  idDroitAcces: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (err: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 3));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setSubmitting(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("preuves", file));

      const res = await fetch(
        `/api/energy/grdf/droits-acces/${idDroitAcces}/preuves`,
        {
          method: "PUT",
          body: formData,
        }
      );

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        onError(data.error || "Erreur lors de la transmission");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-primary-dark">
            Transmettre une preuve
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-text-secondary">
            Transmettez jusqu&apos;à 3 preuves de consentement (max 4 Mo chacune).
            Formats acceptés : PDF, image, document.
          </p>

          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
            <Upload size={24} className="mx-auto text-gray-400 mb-2" />
            <label className="cursor-pointer">
              <span className="text-sm text-accent hover:underline">
                Choisir des fichiers
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">
              {3 - files.length} fichier(s) restant(s)
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(1)} Mo
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || files.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                "Transmettre"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
