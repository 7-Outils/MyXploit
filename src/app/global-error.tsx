"use client";

import { useEffect } from "react";

/**
 * Dernier filet : une erreur survenue dans le layout racine lui-même.
 * Ce composant remplace tout le document, y compris <html> et <body>, donc
 * la feuille de style de l'application n'est pas garantie — tout est en
 * styles inline pour qu'il s'affiche dans tous les cas.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", { digest: error.digest, message: error.message, stack: error.stack });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F6F7",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#14181B",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 32,
            background: "#FFFFFF",
            border: "1px solid #E1E5E7",
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            L&apos;application n&apos;a pas pu démarrer
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5A666D" }}>
            Une erreur est survenue au chargement. Recharger la page suffit
            généralement à repartir.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "20px 0 0",
                fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                fontSize: 12,
                color: "#9AA4AA",
              }}
            >
              Code d&apos;erreur : {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: "0 20px",
              border: "none",
              borderRadius: 8,
              background: "#17505E",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
