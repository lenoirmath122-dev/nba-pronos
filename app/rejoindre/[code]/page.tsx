import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/auth/AuthScreen.module.css";

// Lien d'invitation d'une ligue (/rejoindre/<code>), partagé depuis la
// pop-up « Créer une ligue » du Chat. Connecté : on rejoint la ligue (RPC
// join_league, mêmes garde-fous que le formulaire du profil) et on ouvre son
// canal de chat. Visiteur : on affiche le code et on l'envoie créer son
// compte ; il le collera dans Profil > Ligues (pas de reprise automatique
// après inscription).

export const metadata = pageMetadata({ title: "Rejoindre une ligue", path: "/rejoindre", noindex: true });

export default async function JoinLeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode).trim();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase.rpc("join_league", { p_code: code }).single<{ id: string; name: string }>();
    if (data && !error) redirect(`/chat?canal=${data.id}`);
    return (
      <main className={`${styles.page} photo-page force-photo`}>
        <p>{error?.message ?? "Code de ligue invalide."}</p>
        <Link href="/profile?tab=ligues">Aller à mes ligues</Link>
      </main>
    );
  }

  return (
    <main className={`${styles.page} photo-page force-photo`}>
      <h1>On t&apos;invite dans une ligue</h1>
      <p>
        Code de la ligue : <strong>{code}</strong>
      </p>
      <p>Crée ton compte (ou connecte-toi) : tu rejoindras la ligue automatiquement.</p>
      <p>
        <a href={`/rejoindre/${encodeURIComponent(code)}/commencer`}>Créer mon compte</a> ·{" "}
        <a href={`/rejoindre/${encodeURIComponent(code)}/commencer?vers=login`}>Me connecter</a>
      </p>
    </main>
  );
}
