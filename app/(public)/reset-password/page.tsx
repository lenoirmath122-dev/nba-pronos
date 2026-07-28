import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

// T6a §3 (arbre app/) : "reset Supabase standard (T2 §8)" — voir
// ResetPasswordForm pour le détail du mécanisme (une seule route, 2 modes).
export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Réinitialiser le mot de passe</h1>
      <ResetPasswordForm />
    </main>
  );
}
