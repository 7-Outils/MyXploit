"use client";

import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";

interface ProviderStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  tokenExpiresAt: string | null;
}

interface ProvidersData {
  grdf: ProviderStatus;
  enedis: ProviderStatus;
}

interface TelereleveCardProps {
  /** When provided, the GRDF sync is scoped to sites belonging to this contract only */
  contractId?: string;
}

export function TelereleveCard({ contractId }: TelereleveCardProps = {}) {
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<"grdf" | "enedis" | null>(null);
  const [showGRDFModal, setShowGRDFModal] = useState(false);
  const [grdfForm, setGrdfForm] = useState({ clientId: "", clientSecret: "", sandbox: false });
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/energy/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();

    // Check for Enedis callback messages in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("enedis_success") === "true") {
      setMessage({ type: "success", text: "Connexion Enedis établie avec succès !" });
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      fetchProviders();
    } else if (params.get("enedis_error")) {
      setMessage({ type: "error", text: `Erreur Enedis: ${params.get("enedis_error")}` });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleGRDFConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/energy/grdf/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(grdfForm),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Connexion GRDF établie avec succès !" });
        setShowGRDFModal(false);
        setGrdfForm({ clientId: "", clientSecret: "", sandbox: false });
        fetchProviders();
      } else {
        setMessage({ type: "error", text: data.error || "Erreur de connexion GRDF" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setConnecting(false);
    }
  };

  const handleEnedisConnect = async () => {
    try {
      const res = await fetch("/api/energy/enedis/authorize");
      if (res.ok) {
        const data = await res.json();
        // Redirect to Enedis OAuth
        window.location.href = data.authorizationUrl;
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erreur Enedis" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur réseau" });
    }
  };

  const handleSync = async (provider: "grdf" | "enedis") => {
    setSyncing(provider);
    setMessage(null);

    try {
      // Scope GRDF sync to the current contract when one is selected so we
      // don't sync sites from unrelated clients (e.g. Gonesse PCEs when on
      // Avray contract page).
      const body = provider === "grdf" && contractId ? { contractId } : {};
      const res = await fetch(`/api/energy/${provider}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        // Build detailed message with per-site results
        let text = `${provider.toUpperCase()}: ${data.message}`;
        if (data.results && data.results.length > 0) {
          const details = data.results
            .map((r: { siteName: string; pce: string; success: boolean; imported: number; error?: string }) =>
              r.success
                ? `${r.siteName} (${r.pce}): ${r.imported} relevé(s)`
                : `${r.siteName} (${r.pce}): ${r.error}`
            )
            .join(" | ");
          text += ` — ${details}`;
        }
        setMessage({
          type: data.sites?.failed > 0 ? "error" : "success",
          text,
        });
        fetchProviders();
      } else {
        setMessage({ type: "error", text: data.error || "Erreur de synchronisation" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (provider: "grdf" | "enedis") => {
    if (!confirm(`Êtes-vous sûr de vouloir déconnecter ${provider.toUpperCase()} ?`)) {
      return;
    }

    try {
      const endpoint = provider === "grdf" ? "/api/energy/grdf/connect" : "/api/energy/enedis/disconnect";
      const res = await fetch(endpoint, { method: "DELETE" });

      if (res.ok) {
        setMessage({ type: "success", text: `${provider.toUpperCase()} déconnecté` });
        fetchProviders();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur de déconnexion" });
    }
  };

  if (loading) {
    return (
      <ChartCard title="Télérelève automatique">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  return (
    <>
      <ChartCard
        title="Télérelève automatique"
        subtitle="Récupération automatique des données GRDF et Enedis"
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
            {message.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <XCircle size={18} />
            )}
            <span className="text-sm">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto p-1 hover:bg-black/10 rounded"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* GRDF Card */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  providers?.grdf.isConnected
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {providers?.grdf.isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-dark">GRDF</h3>
                <p className="text-xs text-text-secondary">Gaz naturel</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  providers?.grdf.isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {providers?.grdf.isConnected ? "Connecté" : "Non connecté"}
              </span>
            </div>

            {providers?.grdf.isConnected && providers.grdf.lastSyncAt && (
              <p className="text-xs text-text-secondary mb-3">
                Dernière sync:{" "}
                {new Date(providers.grdf.lastSyncAt).toLocaleString("fr-FR")}
              </p>
            )}

            {providers?.grdf.lastError && (
              <p className="text-xs text-red-600 mb-3">{providers.grdf.lastError}</p>
            )}

            <div className="flex gap-2">
              {providers?.grdf.isConnected ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync("grdf")}
                    disabled={syncing === "grdf"}
                    className="flex-1"
                  >
                    {syncing === "grdf" ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-1" />
                    )}
                    Synchroniser
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDisconnect("grdf")}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Déconnecter
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  {/* Présentation GRDF */}
                  <div className="text-xs text-gray-700 leading-relaxed">
                    <p className="mb-2">
                      <strong>GRDF</strong> gère le réseau de distribution de gaz naturel en France.
                      Pour le suivi énergétique de vos bâtiments, connectez votre compte GRDF ADICT
                      pour récupérer automatiquement les données de consommation gaz.
                    </p>
                    <p className="text-gray-500 text-[11px]">
                      GRDF ADICT est le service d&apos;accès aux données individuelles de consommation
                      par télérelève. Un contrat GRDF ADICT est nécessaire pour accéder aux données.
                    </p>
                  </div>

                  {/* Texte avant le bouton */}
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded">
                    Renseignez vos identifiants GRDF ADICT (Client ID et Client Secret) pour
                    autoriser la récupération automatique des consommations gaz de vos sites.
                  </p>

                  <Button
                    size="sm"
                    onClick={() => setShowGRDFModal(true)}
                    className="w-full"
                  >
                    <Settings size={14} className="mr-1" />
                    Configurer GRDF ADICT
                  </Button>

                  {/* Lien portail GRDF */}
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    <p>
                      Vous n&apos;avez pas de contrat GRDF ADICT ?{" "}
                      <a
                        href="https://sites.grdf.fr/web/portail-api-grdf-adict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        Consultez le portail GRDF ADICT
                      </a>
                      {" "}pour en savoir plus et faire votre demande d&apos;accès.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enedis Card */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  providers?.enedis.isConnected
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {providers?.enedis.isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-dark">Enedis</h3>
                <p className="text-xs text-text-secondary">Électricité</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  providers?.enedis.isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {providers?.enedis.isConnected ? "Connecté" : "Non connecté"}
              </span>
            </div>

            {providers?.enedis.isConnected && providers.enedis.lastSyncAt && (
              <p className="text-xs text-text-secondary mb-3">
                Dernière sync:{" "}
                {new Date(providers.enedis.lastSyncAt).toLocaleString("fr-FR")}
              </p>
            )}

            {providers?.enedis.lastError && (
              <p className="text-xs text-red-600 mb-3">{providers.enedis.lastError}</p>
            )}

            <div className="flex flex-col gap-3">
              {providers?.enedis.isConnected ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync("enedis")}
                    disabled={syncing === "enedis"}
                    className="flex-1"
                  >
                    {syncing === "enedis" ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-1" />
                    )}
                    Synchroniser
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDisconnect("enedis")}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Déconnecter
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Présentation Enedis */}
                  <div className="text-xs text-gray-700 leading-relaxed">
                    <p className="mb-2">
                      <strong>Enedis</strong> gère le réseau d&apos;électricité jusqu&apos;au compteur d&apos;électricité.
                      Pour le suivi énergétique de vos bâtiments, autorisez Enedis à nous transmettre vos données Linky.
                    </p>
                    <p className="text-gray-500 text-[11px]">
                      Enedis est le gestionnaire du réseau public de distribution d&apos;électricité sur 95% du territoire français continental.
                    </p>
                  </div>

                  {/* Texte avant le bouton d'action */}
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded">
                    En cliquant sur ce bouton, vous allez accéder à votre compte personnel Enedis où vous pourrez
                    donner votre accord pour qu&apos;Enedis nous transmette vos données.
                  </p>

                  {/* Bouton ENEDIS officiel - Logo cliquable */}
                  <button
                    onClick={handleEnedisConnect}
                    className="w-full flex items-center justify-center p-3 rounded-lg transition-all hover:opacity-80 hover:shadow-md"
                  >
                    <img
                      src="/enedis-logo.png"
                      alt="Accéder à mes données avec Enedis"
                      className="h-12 w-auto"
                    />
                  </button>

                  {/* Lien création de compte */}
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    <p>
                      Vous n&apos;avez pas de compte Enedis ?{" "}
                      <a
                        href="https://mon-compte-client.enedis.fr/inscription"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        Créez votre espace personnel
                      </a>
                      . Il vous permet de suivre et gérer vos données de consommation d&apos;électricité.
                      Munissez-vous de votre facture d&apos;électricité pour créer votre espace.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Note :</strong> Pour utiliser la télérelève, vous devez avoir un contrat GRDF ADICT
            et/ou autoriser l&apos;accès à vos données Enedis. Les PCE (gaz) et PDL (électricité) doivent être
            configurés sur vos sites.
          </p>
        </div>
      </ChartCard>

      {/* GRDF Configuration Modal */}
      {showGRDFModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-primary-dark">
                Configuration GRDF ADICT
              </h2>
              <button
                onClick={() => setShowGRDFModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGRDFConnect} className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">
                Entrez vos identifiants GRDF ADICT. Vous pouvez les obtenir depuis votre{" "}
                <a
                  href="https://monespace.grdf.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Espace Client GRDF
                </a>
                .
              </p>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Client ID *
                </label>
                <input
                  type="text"
                  required
                  value={grdfForm.clientId}
                  onChange={(e) => setGrdfForm({ ...grdfForm, clientId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Votre Client ID GRDF"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1">
                  Client Secret *
                </label>
                <input
                  type="password"
                  required
                  value={grdfForm.clientSecret}
                  onChange={(e) => setGrdfForm({ ...grdfForm, clientSecret: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="Votre Client Secret GRDF"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="grdf-sandbox"
                  checked={grdfForm.sandbox}
                  onChange={(e) => setGrdfForm({ ...grdfForm, sandbox: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent/20"
                />
                <label htmlFor="grdf-sandbox" className="text-sm text-amber-800 cursor-pointer">
                  <span className="font-medium">Mode Bac \u00e0 Sable</span>
                  <span className="block text-xs text-amber-600">
                    Utiliser l&apos;environnement de test GRDF (donn\u00e9es fictives)
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowGRDFModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={connecting}>
                  {connecting ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    "Connecter"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
