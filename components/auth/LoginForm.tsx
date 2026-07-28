"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { login } from "@/lib/auth/actions";

// Pas de souscription réelle : l'URL ne change pas après le montage sur cet
// écran (pas de navigation interne qui la modifierait) — no-op suffisant.
function subscribeToNothing() {
  return () => {};
}
function getResetSuccessFromUrl() {
  return new URLSearchParams(window.location.search).get("resetSuccess") === "1";
}
function getResetSuccessServerSnapshot() {
  return false; // rendu serveur : pas de window, jamais le message au 1er rendu.
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  // Lu côté client (pas useSearchParams, pour rester hors de toute contrainte
  // Suspense) — juste un message de courtoisie après un reset réussi
  // (ResetPasswordForm.tsx). useSyncExternalStore plutôt qu'un effet +
  // setState : lit une donnée EXTERNE (l'URL) sans le rendu intermédiaire ni
  // le risque de désynchro hydratation d'un `useEffect` classique.
  const resetSuccess = useSyncExternalStore(
    subscribeToNothing,
    getResetSuccessFromUrl,
    getResetSuccessServerSnapshot
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {resetSuccess && (
        <p className="text-sm text-green-700">
          Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe.
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border px-3 py-2"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-sm">
        <Link href="/reset-password" className="underline">
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="text-sm">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="underline">
          Inscris-toi
        </Link>
      </p>
    </form>
  );
}
