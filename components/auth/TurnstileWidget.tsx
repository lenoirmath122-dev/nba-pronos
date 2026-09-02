"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Widget CAPTCHA Cloudflare Turnstile (audit de sécurité, finding 3,
 * security-audit-report.md §1) — protège login/signup du brute-force
 * distribué, en complément du rate-limiting par défaut de Supabase Auth.
 *
 * Rendu EXPLICITE (window.turnstile.render), pas la classe `cf-turnstile`
 * implicite — nécessaire pour pouvoir `reset()` le widget après un échec de
 * soumission : un token Turnstile est à usage unique, renvoyer le même après
 * un mot de passe refusé serait rejeté par Supabase. `resetKey` doit changer
 * (référence de `state` de `useActionState`, pas son contenu) à chaque
 * nouvelle réponse d'action pour déclencher le reset.
 *
 * Le widget insère lui-même un `<input type="hidden" name="cf-turnstile-response">`
 * dans son conteneur — aucun état contrôlé nécessaire ici, la valeur part
 * avec le FormData du formulaire natif comme n'importe quel autre champ.
 *
 * Si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` n'est pas configurée (dev local sans
 * `.env.local` à jour), le widget ne s'affiche simplement pas — jamais
 * bloquant pour le développement, la vérification CAPTCHA échoue alors côté
 * Supabase avec un message clair plutôt qu'un crash côté client.
 */
export function TurnstileWidget({ resetKey }: { resetKey: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile || !SITE_KEY) return;
    if (widgetIdRef.current === null) {
      widgetIdRef.current = window.turnstile.render(containerRef.current, { sitekey: SITE_KEY });
    } else {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [scriptLoaded, resetKey]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
