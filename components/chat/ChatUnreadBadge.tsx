"use client";

import { formatUnreadCount, useUnreadChatCounts, type ChatChannelKey } from "@/lib/nav/chatSeen";
import type { ChatActivity } from "@/lib/queries/chat";
import styles from "./ChatChannelList.module.css";

// Pastille de messages non lus en bout de ligne d'un canal (p3-7). Composant
// client isolé pour que ChatChannelList reste un composant serveur : seul le
// repère « lu » (localStorage) exige le navigateur.

type ChatUnreadBadgeProps = {
  channel: ChatChannelKey;
  activity: ChatActivity[];
};

export function ChatUnreadBadge({ channel, activity }: ChatUnreadBadgeProps) {
  const count = useUnreadChatCounts(activity)?.get(channel) ?? 0;
  if (count === 0) return null;

  return (
    <span className={styles.unread}>
      <span aria-hidden="true">{formatUnreadCount(count)}</span>
      <span className={styles.srOnly}>
        {` ${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}`}
      </span>
    </span>
  );
}
