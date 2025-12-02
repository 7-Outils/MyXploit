import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background-secondary flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo */}
        <div className="mb-8">
          <Link href="/">
            <Logo size="lg" />
          </Link>
        </div>

        <SignIn
          forceRedirectUrl="/overview"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none bg-transparent",
              headerTitle: "text-2xl font-bold text-primary-dark",
              headerSubtitle: "text-text-secondary",
              formButtonPrimary:
                "bg-accent hover:bg-accent/90 text-white rounded-lg",
              formFieldInput:
                "rounded-lg border-gray-200 focus:ring-accent focus:border-accent",
              footerActionLink: "text-accent hover:text-accent/80",
            },
          }}
        />
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-primary-dark items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Logo size="lg" showText={false} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Pilotez vos marchés CVC en toute sérénité
          </h2>
          <p className="text-gray-400">
            Suivez vos consommations, gérez vos contrats et optimisez la
            performance énergétique de votre patrimoine.
          </p>
        </div>
      </div>
    </div>
  );
}
