"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { fraunces, plexMono } from "@/components/landing/fonts";

const inputClass =
  "w-full border border-ink/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

const labelClass =
  "block font-mono text-[11px] uppercase tracking-widest text-ink/50 mb-2";

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    firstName: string | null;
  } | null>(null);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/set-password?token=${token}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setUserInfo(data.user);
          setTokenValid(true);
        } else {
          setError(data.error || "Lien invalide ou expiré");
        }
      } catch {
        setError("Erreur de vérification");
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erreur lors de l'activation");
        return;
      }

      router.push("/overview");
      router.refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-accent mx-auto mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Vérification du lien…
          </p>
        </div>
      </div>
    );
  }

  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Link href="/" className="inline-block">
              <Logo size="lg" className="justify-center" />
            </Link>
          </div>

          <div className="border border-ink/15 bg-white">
            <div className="flex items-center justify-between border-b border-ink/15 px-6 py-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                Activation de compte
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-red-600">
                Lien invalide
              </span>
            </div>
            <div className="p-8 text-center">
              <h1 className="font-display text-3xl font-medium tracking-tight text-ink mb-3">
                Lien invalide
              </h1>
              <p className="text-sm text-text-secondary mb-8">
                {error || "Ce lien d'invitation est invalide ou a expiré."}
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
              >
                Retour à la connexion
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <Logo size="lg" className="justify-center" />
          </Link>
        </div>

        <div className="border border-ink/15 bg-white">
          <div className="flex items-center justify-between border-b border-ink/15 px-6 py-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
              Activation de compte
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
              {userInfo?.email}
            </span>
          </div>

          <div className="p-8">
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink mb-1">
              Bienvenue{userInfo?.firstName ? ` ${userInfo.firstName}` : ""}
            </h1>
            <p className="text-sm text-text-secondary mb-8">
              Créez votre mot de passe pour activer votre compte
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="password" className={labelClass}>
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={`${inputClass} pr-12`}
                    placeholder="Minimum 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink transition-colors"
                    title={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder="Confirmez votre mot de passe"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Activation…" : "Activer mon compte"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className={`${fraunces.variable} ${plexMono.variable}`}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-paper flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-accent" />
          </div>
        }
      >
        <SetPasswordContent />
      </Suspense>
    </div>
  );
}
