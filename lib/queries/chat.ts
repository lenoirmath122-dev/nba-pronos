import { getServerClient } from "@/lib/supabase/server";

// Lecture du chat (SPEC_CHAT_V0_1.md, 27/08/2026) : 200 derniers messages du
// canal actif (pas de pagination en V0.1), RLS seule autorité côté portée
// (chat_messages_select — Général ouvert à tous, ligue réservée aux
// membres). Requête messages + requête users séparées puis jointure en
// mémoire par Map, même patron que getMyLeagues() (lib/queries/leagues.ts) —
// pas d'embed Supabase ailleurs dans ce projet.

const CHAT_HISTORY_LIMIT = 200;

export type ChatScope = { type: "GLOBAL" } | { type: "LEAGUE"; leagueId: string };

export type ChatMessage = {
  id: string;
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  body: string;
  createdAt: string;
};

export type ChatRosterEntry = { id: string; pseudo: string; avatarUrl: string | null; isAdmin: boolean };

/** Trombinoscope complet (petit groupe d'amis, table `users` déjà lisible de
 *  tous — `users_select using (true)`) : sert à résoudre pseudo/avatar/admin
 *  d'un message reçu en direct par Realtime, qui ne porte que `user_id` (pas
 *  de jointure côté Realtime). Récupéré une fois au chargement de la page,
 *  passé en seed à ChatSubscriber. */
export async function getChatRoster(): Promise<ChatRosterEntry[]> {
  const supabase = await getServerClient();
  const { data } = await supabase.from("users").select("id, pseudo, avatar_url, role");
  return (data ?? []).map((u) => ({
    id: u.id as string,
    pseudo: u.pseudo as string,
    avatarUrl: u.avatar_url as string | null,
    isAdmin: u.role === "ADMIN",
  }));
}

export async function getChatMessages(scope: ChatScope): Promise<ChatMessage[]> {
  const supabase = await getServerClient();

  let query = supabase
    .from("chat_messages")
    .select("id, user_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  query =
    scope.type === "GLOBAL"
      ? query.eq("scope_type", "GLOBAL")
      : query.eq("scope_type", "LEAGUE").eq("league_id", scope.leagueId);

  const { data: rows } = await query;
  const messages = (rows ?? []) as { id: string; user_id: string; body: string; created_at: string }[];
  if (messages.length === 0) return [];

  const userIds = [...new Set(messages.map((m) => m.user_id))];
  const { data: userRows } = await supabase
    .from("users")
    .select("id, pseudo, avatar_url, role")
    .in("id", userIds);
  const userById = new Map(
    (userRows ?? []).map((u) => [u.id as string, u as { id: string; pseudo: string; avatar_url: string | null; role: string }])
  );

  // Le plus récent en dernier (ordre de lecture d'un chat), la requête
  // ci-dessus est DESC pour que .limit() garde les 200 DERNIERS et non les
  // 200 premiers de l'historique.
  return messages
    .slice()
    .reverse()
    .map((m) => {
      const author = userById.get(m.user_id);
      return {
        id: m.id,
        userId: m.user_id,
        pseudo: author?.pseudo ?? "Joueur",
        avatarUrl: author?.avatar_url ?? null,
        isAdmin: author?.role === "ADMIN",
        body: m.body,
        createdAt: m.created_at,
      };
    });
}
