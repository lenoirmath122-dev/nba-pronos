import Link from "next/link";

// Destination du lien de confirmation reçu par email (`emailRedirectTo` du
// signUp(), lib/auth/actions.ts) — Supabase a déjà marqué le compte confirmé
// côté serveur avant cette redirection, cette page n'a rien à vérifier.
export default function EmailConfirmedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">Adresse confirmée</h1>
      <p className="max-w-sm text-sm">
        Ton adresse email est confirmée. Tu peux te connecter.
      </p>
      <Link
        href="/login"
        className="rounded bg-black px-4 py-2 text-white"
      >
        Se connecter
      </Link>
    </main>
  );
}
