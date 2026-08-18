import Link from "next/link";

// Destination après un signup() réussi mais en attente de confirmation
// (lib/auth/actions.ts) — distinct du cas "compte déjà existant" (identities
// vides), qui reste géré comme une erreur sur le formulaire d'inscription.
export default function VerifyEmailPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">Vérifie ta boîte mail</h1>
      <p className="max-w-sm text-sm">
        Ton compte a bien été créé. Clique sur le lien reçu par email pour le
        confirmer avant de te connecter.
      </p>
      <Link href="/login" className="text-sm underline">
        Retour à la connexion
      </Link>
    </main>
  );
}
