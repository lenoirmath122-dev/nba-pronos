import { createHmac, timingSafeEqual } from "node:crypto";

// Jeton de désinscription en un clic (1B) : signé, sans connexion requise.
// Format `<userId>.<scope>.<signature>` ; la signature couvre userId et scope,
// donc un jeton « rappels » ne peut pas servir à couper les résultats.
// Le scope « validate » sert au bouton de la relance (jeton lié au compte, pas à une préférence).
export type UnsubscribeScope = "results" | "reminders" | "validate";

const SCOPES: readonly UnsubscribeScope[] = ["results", "reminders", "validate"];

function sign(userId: string, scope: UnsubscribeScope, secret: string): string {
  return createHmac("sha256", secret).update(`${userId}:${scope}`).digest("base64url");
}

export function createUnsubscribeToken(userId: string, scope: UnsubscribeScope, secret: string): string {
  return `${userId}.${scope}.${sign(userId, scope, secret)}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string
): { userId: string; scope: UnsubscribeScope } | null {
  const [userId, scope, signature, ...rest] = token.split(".");
  if (!userId || !signature || rest.length > 0) return null;
  if (!SCOPES.includes(scope as UnsubscribeScope)) return null;
  const expected = Buffer.from(sign(userId, scope as UnsubscribeScope, secret));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return { userId, scope: scope as UnsubscribeScope };
}
