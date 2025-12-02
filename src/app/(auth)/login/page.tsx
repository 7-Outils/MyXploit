"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulation - à remplacer par vraie auth
    setTimeout(() => {
      router.push("/overview");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background-secondary flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8">
            <Link href="/">
              <Logo size="lg" />
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary-dark mb-2">
              Connexion
            </h1>
            <p className="text-text-secondary">
              Accédez à votre tableau de bord MyExploit
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  placeholder="vous@exemple.fr"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  defaultValue="demo@myexploit.fr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
                  defaultValue="demo1234"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  defaultChecked
                />
                <span className="text-sm text-text-secondary">
                  Se souvenir de moi
                </span>
              </label>
              <a
                href="#"
                className="text-sm text-accent hover:underline"
              >
                Mot de passe oublié ?
              </a>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          {/* Demo notice */}
          <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="text-sm text-accent">
              <strong>Mode démo :</strong> Cliquez sur &quot;Se connecter&quot; pour accéder au dashboard.
            </p>
          </div>

          {/* Register link */}
          <p className="mt-8 text-center text-sm text-text-secondary">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-accent hover:underline font-medium">
              Demander un accès
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image/Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-primary-dark items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Logo size="lg" showText={false} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Pilotez vos marchés CVC en toute sérénité
          </h2>
          <p className="text-gray-400">
            Suivez vos consommations, gérez vos contrats et optimisez la performance énergétique de votre patrimoine.
          </p>
          <div className="mt-8 flex justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-accent-light">500+</p>
              <p className="text-sm text-gray-400">Sites gérés</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent-light">15%</p>
              <p className="text-sm text-gray-400">Économies</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent-light">98%</p>
              <p className="text-sm text-gray-400">Satisfaction</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
