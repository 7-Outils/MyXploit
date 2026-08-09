import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-md border border-ink/15 bg-white">
        <div className="flex items-center justify-between border-b border-ink/15 px-4 py-2.5">
          <span className="label-tech">Erreur</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
            404
          </span>
        </div>

        <div className="p-6">
          <h1 className="text-xl font-semibold text-ink">Page introuvable</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Cette adresse ne correspond à aucun écran de l&apos;application. Le
            lien est peut-être obsolète, ou l&apos;élément a été supprimé.
          </p>

          <Link
            href="/overview"
            className="mt-6 inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            <Home size={15} />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
