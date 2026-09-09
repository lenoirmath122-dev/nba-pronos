import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// p1-23 (feuille de route Phase 1) : première stratégie de cache posée dans
// ce projet (zéro aujourd'hui malgré 93 revalidatePath -- qui invalident un
// cache de données qui n'existe nulle part, seulement le Router Cache
// client). `teams` choisi comme premier cas : référentiel FIXE de 30 lignes,
// jamais écrit après le seed initial (lib/sync/teams.ts n'écrit QUE
// entity_mappings, jamais teams elle-même -- voir son commentaire d'en-tête)
// et lu par .from("teams") dans ~28 fichiers, chacun son propre aller-retour
// Supabase pour la même donnée statique.
//
// Client ANON sans session (pas getServerClient(), qui lit cookies() --
// interdit à l'intérieur d'unstable_cache, exécutable hors contexte de
// requête) et pas getServiceClient() non plus (réservé aux usages
// privilégiés listés dans son commentaire d'en-tête ; teams_select autorise
// déjà la lecture publique via RLS, using (true), donc service_role serait
// une élévation de privilège non justifiée ici).
//
// TTL volontairement long (24h) plutôt qu'un revalidateTag() câblé quelque
// part : il n'existe aujourd'hui AUCUN chemin d'écriture vers teams en
// production, un revalidateTag() n'aurait rien à quoi s'accrocher. Un
// changement manuel en base (renommage de franchise, cas rarissime) attend
// au pire 24h -- compromis explicitement accepté plutôt que de construire
// un mécanisme d'invalidation pour un évènement qui ne se produit jamais.
export type Team = { id: string; name: string; abbreviation: string; conference: "EAST" | "WEST" };

async function fetchAllTeams(): Promise<Team[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.from("teams").select("id, name, abbreviation, conference");
  return (data ?? []) as Team[];
}

const cachedGetAllTeams = unstable_cache(fetchAllTeams, ["teams-all"], { revalidate: 86400, tags: ["teams"] });

// unstable_cache() a besoin d'un incrementalCache posé par le runtime Next.js
// pendant une vraie requête -- absent quand ces fonctions de lib/queries/
// sont appelées DIRECTEMENT (test/integration/*.test.ts, Vitest, jamais un
// vrai serveur Next) : lève "Invariant: incrementalCache missing" (bug réel
// découvert en CI, PR #74, 09/09/2026 -- les 6 fichiers migrés vers
// getAllTeams() cassaient tous les tests d'intégration qui les exercent).
// Repli sur l'appel direct, non caché, plutôt que de détecter l'environnement
// de test (process.env.VITEST) : couvre AUSSI tout futur appel hors runtime
// Next (script, cron autonome) sans dépendre d'un nom de runner précis.
export async function getAllTeams(): Promise<Team[]> {
  try {
    return await cachedGetAllTeams();
  } catch {
    return fetchAllTeams();
  }
}
