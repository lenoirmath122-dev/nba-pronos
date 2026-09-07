"use client";

import "./globals.css";

// Ne se déclenche que si le root layout lui-même plante (cas rare — voir
// app/error.tsx pour le cas courant, une erreur dans un segment). Doit poser
// son propre <html>/<body> (remplace le root layout) et importer globals.css
// explicitement : ce fichier ne l'hérite pas automatiquement (voir
// node_modules/next/dist/docs/.../error.md, "Global Error"). Pas de
// data-theme lu ici (pas de session à interroger dans ce contexte dégradé) —
// tombe sur le thème sombre par défaut de :root, cohérent avec le reste de
// l'app avant toute préférence utilisateur.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "2rem 1rem",
          background: "var(--color-surface-base)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-ui, system-ui, sans-serif)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Une erreur est survenue</h2>
        <p style={{ margin: 0, maxWidth: "42ch", color: "var(--color-text-secondary)" }}>
          L&apos;application n&apos;a pas pu se charger correctement. Réessaie dans un instant.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            minHeight: "44px",
            padding: "0.5rem 1.5rem",
            borderRadius: "3px",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-text-on-accent)",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
