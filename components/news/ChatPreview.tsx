import Link from "next/link";
import type { ChatPreviewMessage } from "@/lib/queries/chat";
import styles from "./ChatPreview.module.css";

// Aperçu du chat sur l'Actualité (13/11/2026) : les 2 derniers messages,
// tous canaux visibles confondus. Les non-lus restent comptés par la
// pastille de l'onglet Chat (TabBar), pas recomptés ici.

const MAX_BODY_LENGTH = 120;

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > MAX_BODY_LENGTH ? `${flat.slice(0, MAX_BODY_LENGTH - 1)}…` : flat;
}

export function ChatPreview({ messages }: { messages: ChatPreviewMessage[] }) {
  const latest = messages[0];
  return (
    <section className={`${styles.card} glass-card`} aria-label="Dernières discussions">
      <div className={styles.heading}>
        <h2 className={styles.title}>Ça discute</h2>
      </div>
      {messages.length > 0 ? (
        <ul className={styles.list}>
          {messages.map((message) => (
            <li key={message.id} className={styles.message}>
              <span className={styles.avatar} aria-hidden="true">
                {message.pseudo.slice(0, 1).toUpperCase()}
              </span>
              <div className={styles.text}>
                <p className={styles.meta}>
                  <span className={styles.pseudo}>{message.pseudo}</span> · {message.channelName}
                </p>
                <p className={styles.body}>{excerpt(message.body)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Pas encore de message. Lance la discussion !</p>
      )}
      <Link href={latest ? `/chat?canal=${latest.channel}` : "/chat"} className={styles.open}>
        Ouvrir le chat
      </Link>
    </section>
  );
}
