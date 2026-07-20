"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="pseudo">Pseudo</label>
        <input
          id="pseudo"
          name="pseudo"
          type="text"
          required
          autoComplete="username"
          className="rounded border px-3 py-2"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className="rounded border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="code">Code compétition</label>
        <input
          id="code"
          name="code"
          type="text"
          required
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
        {pending ? "Création…" : "Créer mon compte"}
      </button>
      <p className="text-sm">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline">
          Connecte-toi
        </Link>
      </p>
    </form>
  );
}
