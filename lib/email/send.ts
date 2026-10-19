import "server-only";
import { createUnsubscribeToken, type UnsubscribeScope } from "./unsubscribe";

// Envoi d'e-mails planifiés via l'API HTTP de Resend (1B). Le SMTP de Supabase
// Auth (modèles de validation / connexion) est configuré à part.
// Variables : RESEND_API_KEY, EMAIL_FROM (ex. « Panier Ballon <noreply@panierballon.fr> »),
// EMAIL_UNSUBSCRIBE_SECRET (signe les liens de désinscription), NEXT_PUBLIC_SITE_URL.
const RESEND_URL = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://panierballon.fr").replace(/\/$/, "");
}

export function unsubscribeUrl(userId: string, scope: UnsubscribeScope): string {
  const token = createUnsubscribeToken(userId, scope, requiredEnv("EMAIL_UNSUBSCRIBE_SECRET"));
  return `${siteUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

// Retourne l'identifiant Resend du message. Lève en cas d'échec : l'appelant
// n'écrit `email_log` qu'après un envoi réussi, pour qu'un échec soit retenté.
export async function sendEmail(
  email: OutgoingEmail,
  // null pour la relance : compte en attente, aucune préférence à couper.
  unsubscribe: { userId: string; scope: UnsubscribeScope } | null
): Promise<string> {
  const link = unsubscribe ? unsubscribeUrl(unsubscribe.userId, unsubscribe.scope) : null;
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: requiredEnv("EMAIL_FROM"),
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(link
        ? { headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend ${response.status} : ${(await response.text()).slice(0, 200)}`);
  }
  const { id } = (await response.json()) as { id: string };
  return id;
}
