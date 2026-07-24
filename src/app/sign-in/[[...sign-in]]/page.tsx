"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { fraunces, plexMono } from "@/components/landing/fonts";

const inputClass =
  "w-full border border-ink/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

const labelClass =
  "block font-mono text-[11px] uppercase tracking-widest text-ink/50 mb-2";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erreur de connexion");
        return;
      }

      // SUPER_ADMIN → back-office plateforme
      if (data.user?.role === "SUPER_ADMIN") {
        router.push("/platform");
      } else {
        router.push(redirect);
      }
      router.refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <Logo size="xl" variant="default" />
          </Link>
        </div>

        {/* Carte */}
        <div className="border border-ink/15 bg-white">
          <div className="flex items-center justify-between border-b border-ink/15 px-6 py-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
              Espace client
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
              Connexion
            </span>
          </div>

          <div className="p-8">
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink mb-1">
              Connexion
            </h1>
            <p className="text-sm text-text-secondary mb-8">
              Accédez à votre espace MyXploit
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className={labelClass}>
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="vous@exemple.fr"
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Votre mot de passe"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full flex items-center justify-center gap-3 bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Connexion…
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-accent transition-colors"
          >
            ← Retour au site
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className={`${fraunces.variable} ${plexMono.variable}`}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-paper flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-accent" />
          </div>
        }
      >
        <SignInForm />
      </Suspense>
    </div>
  );
}
