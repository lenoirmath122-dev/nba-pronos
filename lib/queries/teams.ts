import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";

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
//
// Repli via getServerClient() plutôt que de rappeler fetchAllTeams() : cette
// dernière lit NEXT_PUBLIC_SUPABASE_URL, délibérément ABSENT du job `e2e` de
// la CI (.github/workflows/ci.yml : "Aucun secret nécessaire") -- levait
// "supabaseUrl is required" dès que ce repli tentait de la relire (2e bug,
// même PR). getServerClient() est mocké par chaque test d'intégration vers
// un client Supabase local réel (test/integration/fixtures.ts), donc aucune
// variable d'environnement requise ici. Sans risque de retomber dans
// l'interdiction "cookies() dans unstable_cache" : cette fonction n'est PAS
// enveloppée par unstable_cache, contrairement à fetchAllTeams ci-dessus.
async function fetchAllTeamsFallback(): Promise<Team[]> {
  const supabase = await getServerClient();
  const { data } = await supabase.from("teams").select("id, name, abbreviation, conference");
  return (data ?? []) as Team[];
}

export async function getAllTeams(): Promise<Team[]> {
  try {
    return await cachedGetAllTeams();
  } catch {
    return fetchAllTeamsFallback();
  }
}
