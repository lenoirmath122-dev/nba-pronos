"use client";

import { useState } from "react";

// Copie l'e-mail d'un joueur dans le presse-papiers (contact admin).
export function CopyEmailButton({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible : l'e-mail reste sélectionnable en un clic.
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}
