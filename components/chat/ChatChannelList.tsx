import Link from "next/link";
import type { MyLeague } from "@/lib/queries/leagues";
import type { ChatActivity, MutedChannels } from "@/lib/queries/chat";
import { ChatNotificationToggle } from "./ChatNotificationToggle";
import { ChatUnreadBadge } from "./ChatUnreadBadge";
import styles from "./ChatChannelList.module.css";

// Liste de canaux (addendum SPEC_CHAT_V0_1.md, 27/08/2026 -- demande
// explicite de l'utilisateur : liste de haut en bas plutôt que des chips,
// clic pour ouvrir, bouton de notif en bout de ligne). Général toujours en
// 1er, puis une ligne par ligue dont le joueur est membre (getMyLeagues(),
// déjà utilisé ailleurs -- lib/queries/leagues.ts). Le lien (navigation) et
// le bouton de notif (ChatNotificationToggle) sont FRÈRES, jamais imbriqués
// -- un <button> dans un <a> est invalide en HTML.

type ChatChannelListProps = {
  myLeagues: MyLeague[];
  muted: MutedChannels;
  /** Messages récents des autres joueurs, pour les pastilles de non-lus (p3-7). */
  activity: ChatActivity[];
};

export function ChatChannelList({ myLeagues, muted, activity }: ChatChannelListProps) {
  return (
    <div className={styles.list}>
      <div className={`${styles.row} glass-card`}>
        <Link href="/chat?canal=general" className={styles.rowLink}>
          Général
          <ChatUnreadBadge channel="general" activity={activity} />
        </Link>
        <ChatNotificationToggle scope={{ type: "GLOBAL" }} initialEnabled={!muted.generalMuted} />
      </div>
      {myLeagues.map((league) => (
        <div key={league.id} className={`${styles.row} glass-card`}>
          <Link href={`/chat?canal=${league.id}`} className={styles.rowLink}>
            {league.name}
            <ChatUnreadBadge channel={league.id} activity={activity} />
          </Link>
          <ChatNotificationToggle
            scope={{ type: "LEAGUE", leagueId: league.id }}
            initialEnabled={!muted.mutedLeagueIds.has(league.id)}
          />
        </div>
      ))}
    </div>
  );
}
