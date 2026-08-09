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
          background: "#FFFFFF",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#0F1E33",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            background: "#FFFFFF",
            border: "1px solid rgba(15, 30, 51, 0.15)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid rgba(15, 30, 51, 0.15)",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            <span style={{ color: "rgba(15, 30, 51, 0.5)" }}>Erreur</span>
            <span style={{ color: "#2563EB" }}>Démarrage</span>
          </div>

          <div style={{ padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              L&apos;application n&apos;a pas pu démarrer
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#4A5568" }}>
              Une erreur est survenue au chargement. Recharger la page suffit
              généralement à repartir.
            </p>

            {error.digest && (
              <p
                style={{
                  margin: "16px 0 0",
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                  fontSize: 12,
                  color: "rgba(15, 30, 51, 0.4)",
                }}
              >
                Code d&apos;erreur : {error.digest}
              </p>
            )}

            <button
              onClick={reset}
              style={{
                marginTop: 20,
                height: 40,
                padding: "0 20px",
                border: "none",
                borderRadius: 0,
                background: "#0F1E33",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
