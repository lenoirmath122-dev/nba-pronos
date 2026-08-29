import "server-only";

const GENERIC_MESSAGE = "Une erreur est survenue. Réessaie, ou contacte un admin si le problème persiste.";

/**
 * Journalise le détail Postgres/Supabase côté serveur et renvoie un message
 * générique au client — évite d'exposer noms de tables/colonnes/policies
 * dans une erreur renvoyée à un utilisateur authentifié (audit sécurité
 * 29/08/2026, finding 8).
 */
export function toClientError(context: string, error: { message: string }): string {
  console.error(`[${context}]`, error.message);
  return GENERIC_MESSAGE;
}
