import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background-secondary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/">
            <Logo size="lg" className="justify-center" />
          </Link>
        </div>

        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-soft bg-white rounded-2xl",
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
    </div>
  );
}
