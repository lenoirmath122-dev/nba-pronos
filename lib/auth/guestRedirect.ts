import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

/** Écrans d'écriture (nouveau pari, bracket) : un invité les ouvre en lecture
 *  ailleurs ; ici il est renvoyé sur /play, où la modale de compte s'ouvre à
 *  l'action. Défense en profondeur : l'écriture reste refusée par la RLS. */
export async function redirectGuestToPlay(): Promise<void> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/play");
}
