import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyExploit - Pilotage des marchés d'exploitation CVC",
  description:
    "Plateforme SaaS de pilotage des marchés d'exploitation CVC et suivi de performance énergétique des bâtiments publics.",
  keywords: [
    "CVC",
    "exploitation",
    "énergie",
    "bâtiments publics",
    "performance énergétique",
    "chauffage",
    "climatisation",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
