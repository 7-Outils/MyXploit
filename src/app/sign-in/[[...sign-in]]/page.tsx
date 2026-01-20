"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Loader2, Mail, Lock, AlertCircle, ArrowRight, Zap, BarChart3, Shield } from "lucide-react";

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

      router.push(redirect);
      router.refresh();
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="inline-block mb-12">
            <Logo size="lg" />
          </Link>

          {/* Welcome text */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenue
            </h1>
            <p className="text-gray-500">
              Connectez-vous pour accéder à votre espace MyXploit
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Adresse email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00A19A]/20 focus:border-[#00A19A] transition-all bg-gray-50/50"
                  placeholder="vous@exemple.fr"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00A19A]/20 focus:border-[#00A19A] transition-all bg-gray-50/50"
                  placeholder="Votre mot de passe"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#00A19A] text-white font-semibold rounded-xl hover:bg-[#008f89] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#00A19A]/20"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-[#1a2742] via-[#1e3050] to-[#0d1829] items-center justify-center p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#00A19A] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#00A19A] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-[#00A19A]/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-8 border border-[#00A19A]/30">
            <Logo size="lg" showText={false} />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white mb-4">
            Pilotez vos marchés CVC en toute sérénité
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            La plateforme complète pour optimiser la gestion énergétique de votre patrimoine immobilier.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="w-10 h-10 bg-[#00A19A]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <BarChart3 size={20} className="text-[#00A19A]" />
              </div>
              <p className="text-sm text-gray-300">Suivi des consommations</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="w-10 h-10 bg-[#00A19A]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Zap size={20} className="text-[#00A19A]" />
              </div>
              <p className="text-sm text-gray-300">Performance énergétique</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="w-10 h-10 bg-[#00A19A]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield size={20} className="text-[#00A19A]" />
              </div>
              <p className="text-sm text-gray-300">Gestion des contrats</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 size={40} className="animate-spin text-[#00A19A]" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
