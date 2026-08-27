import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getChatMessages, getChatRoster, type ChatScope } from "@/lib/queries/chat";
import { getMyLeagues, resolveLeagueScope } from "@/lib/queries/leagues";
import { ChatScopeChips } from "@/components/chat/ChatScopeChips";
import { ChatSubscriber } from "@/components/chat/ChatSubscriber";
import styles from "./page.module.css";

// Écran Chat (SPEC_CHAT_V0_1.md, 27/08/2026) : Général (défaut) + un canal
// par ligue dont le joueur est membre, sélection par `?ligue=` (même patron
// que /leaderboard, /play/results). L'auth est déjà gardée par
// app/(app)/layout.tsx -- pas de double vérification ici, contrairement aux
// 2 écrans partagés hors route group (Classement/Bracket, ScreenShell).

type ChatPageProps = { searchParams: Promise<{ ligue?: string }> };

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { ligue } = await searchParams;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myLeagues, roster, resolvedScope] = await Promise.all([
    getMyLeagues(),
    getChatRoster(),
    resolveLeagueScope(supabase, ligue),
  ]);

  // resolveLeagueScope retombe silencieusement sur `null` si l'id est
  // invalide ou si le joueur n'est plus membre -- repli sur Général, même
  // garantie que /leaderboard.
  const scope: ChatScope = resolvedScope ? { type: "LEAGUE", leagueId: resolvedScope.id } : { type: "GLOBAL" };
  const messages = await getChatMessages(scope);

  const currentUserRole = roster.find((u) => u.id === user!.id);
  const isCurrentUserAdmin = currentUserRole?.isAdmin ?? false;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Chat</h1>
        {resolvedScope && <p className={styles.subtitle}>{resolvedScope.name}</p>}
      </div>

      <ChatScopeChips myLeagues={myLeagues} activeLeagueId={resolvedScope?.id ?? null} />

      <ChatSubscriber
        key={scope.type === "LEAGUE" ? scope.leagueId : "GLOBAL"}
        seed={messages}
        roster={roster}
        scope={scope}
        currentUserId={user!.id}
        isCurrentUserAdmin={isCurrentUserAdmin}
      />
    </div>
  );
}
