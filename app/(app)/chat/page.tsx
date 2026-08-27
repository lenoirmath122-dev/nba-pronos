import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { getChatMessages, getChatRoster, getMutedChannels, type ChatScope } from "@/lib/queries/chat";
import { getMyLeagues, resolveLeagueScope } from "@/lib/queries/leagues";
import { ChatChannelList } from "@/components/chat/ChatChannelList";
import { ChatSubscriber } from "@/components/chat/ChatSubscriber";
import styles from "./page.module.css";

// Écran Chat (SPEC_CHAT_V0_1.md, addendum 27/08/2026 -- liste de canaux
// plutôt que des chips, demande explicite de l'utilisateur). `/chat` seul =
// liste (Général + une ligne par ligue) ; `/chat?canal=general` ou
// `/chat?canal=<leagueId>` = la conversation ouverte. Contrairement à
// l'ancien `?ligue=` (repli silencieux sur Général si invalide, cohérent
// avec un simple FILTRE de classement), un id de ligue invalide ici renvoie
// à LA LISTE -- ouvrir "Général" à la place serait trompeur pour un écran de
// navigation entre canaux distincts, pas un filtre. L'auth est déjà gardée
// par app/(app)/layout.tsx.

type ChatPageProps = { searchParams: Promise<{ canal?: string }> };

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { canal } = await searchParams;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [myLeagues, roster, muted] = await Promise.all([getMyLeagues(), getChatRoster(), getMutedChannels()]);

  if (!canal) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Chat</h1>
        </div>
        <ChatChannelList myLeagues={myLeagues} muted={muted} />
      </div>
    );
  }

  let scope: ChatScope;
  let channelName: string;
  if (canal === "general") {
    scope = { type: "GLOBAL" };
    channelName = "Général";
  } else {
    const resolved = await resolveLeagueScope(supabase, canal);
    if (!resolved) redirect("/chat");
    scope = { type: "LEAGUE", leagueId: resolved.id };
    channelName = resolved.name;
  }

  const messages = await getChatMessages(scope);
  const currentUserRole = roster.find((u) => u.id === user!.id);
  const isCurrentUserAdmin = currentUserRole?.isAdmin ?? false;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/chat" className={styles.back} aria-label="Retour aux canaux">
          ←
        </Link>
        <h1 className={styles.title}>{channelName}</h1>
      </div>

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
