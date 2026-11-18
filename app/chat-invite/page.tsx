import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { GuestChatComposer } from "@/components/guest/GuestChatComposer";
import { PublicShell } from "@/components/nav/PublicShell";
import { getGuestChatMessages } from "@/lib/guest/query";
import { pageMetadata } from "@/lib/seo";
import styles from "@/components/guest/guest.module.css";

// Chat Général en lecture seule pour un visiteur (mode invité, lot A). Atteinte
// par réécriture : proxy.ts sert cette page à un invité qui ouvre /chat (l'URL
// reste /chat). Seul le canal Général est lu ; les ligues privées restent
// invisibles. Pas de Realtime ni de ChatSubscriber (lot G : JS minimal).
export const revalidate = 30;

export const metadata = pageMetadata({
  title: "Chat",
  path: "/chat",
  noindex: true,
});

export default async function GuestChatPage() {
  const messages = await getGuestChatMessages();
  return (
    <PublicShell>
      <AuthGateProvider authenticated={false}>
        <div className={`${styles.page} photo-page`}>
          <div className={`${styles.header} glass-card`}>
            <h1 className={styles.title}>Chat · Général</h1>
          </div>
          {messages.length > 0 ? (
            <ul className={styles.messages}>
              {messages.map((m) => (
                <li key={m.id} className={`${styles.message} glass-card`}>
                  <span className={styles.author}>{m.pseudo}</span>
                  <p className={styles.body}>{m.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.text}>Aucun message pour le moment.</p>
          )}
          <GuestChatComposer />
        </div>
      </AuthGateProvider>
    </PublicShell>
  );
}
