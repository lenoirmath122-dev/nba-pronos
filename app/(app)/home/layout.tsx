import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

// Écran réservé aux comptes : le layout (app) laisse entrer les invités (lecture
// de /play et /chat), cette garde renvoie vers la connexion (défense en
// profondeur derrière le proxy).
export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return children;
}
