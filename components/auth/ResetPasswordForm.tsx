"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";

// Flux Supabase STANDARD (T2 §8, T6a arbre app/ — UNE seule route pour les 2
// étapes) : ni server action, ni logique métier à nous — la demande ET la
// confirmation passent directement par le SDK client (contrairement à
// login/signup/logout, server actions, car il n'y a ici aucune donnée
// applicative à nous à valider avant Supabase). Le lien reçu par email dépose
// un jeton dans l'URL (fragment `#access_token=...&type=recovery`) que le
// client navigateur (session en cookie, lib/supabase/browser.ts) détecte
// automatiquement au chargement — c'est CE signal (`onAuthStateChange`,
// événement `PASSWORD_RECOVERY`) qui bascule cette page de "demander un
// email" à "choisir un nouveau mot de passe", jamais un paramètre d'URL lu
// nous-mêmes.
export function ResetPasswordForm() {
  const [mode, setMode] = useState<"checking" | "request" | "confirm">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    // Si le lien reçu par email vient d'être traité, une session de
    // récupération existe déjà au tout premier rendu.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMode(session ? "confirm" : "request");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("confirm");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = getBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (resetError) {
      setError("Impossible d'envoyer l'email pour le moment. Réessaie plus tard.");
      return;
    }
    // Message générique QUE l'email existe ou non en base (D5 : l'email
    // reste un identifiant privé, cet écran ne doit jamais confirmer/infirmer
    // l'existence d'un compte).
    setRequestSent(true);
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    const supabase = getBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError("Impossible de mettre à jour le mot de passe. Réessaie.");
      return;
    }
    // Reconnexion propre demandée plutôt que garder la session de
    // récupération (portée volontairement restreinte côté Supabase) —
    // cohérent avec logout() (lib/auth/actions.ts), même destination /login.
    await supabase.auth.signOut();
    window.location.href = "/login?resetSuccess=1";
  }

  if (mode === "checking") {
    return <p className="text-sm text-gray-500">Chargement…</p>;
  }

  if (mode === "request") {
    if (requestSent) {
      return (
        <p className="max-w-sm text-sm">
          Si un compte existe avec cet email, un lien de réinitialisation vient
          d&apos;être envoyé. Vérifie ta boîte de réception.
        </p>
      );
    }
    return (
      <form onSubmit={handleRequest} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
        </button>
        <p className="text-sm">
          <Link href="/login" className="underline">
            Retour à la connexion
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Nouveau mot de passe</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword">Confirme le mot de passe</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
      </button>
    </form>
  );
}
