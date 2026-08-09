import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F6F7] p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <FileQuestion size={22} className="text-gray-500" />
        </div>

        <h1 className="text-lg font-semibold text-primary-dark">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Cette adresse ne correspond à aucun écran de l&apos;application. Le lien
          est peut-être obsolète, ou l&apos;élément a été supprimé.
        </p>

        <Link
          href="/overview"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          <Home size={15} />
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
