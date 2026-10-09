import { timingSafeEqual } from "node:crypto";

// Authentification partagée des routes /api/sync/* et /api/heartbeat
// (SPEC_TECHNIQUE_SYNCHRO_V0.1 §6, ACTÉ §12.2) : Bearer + SYNC_SECRET,
// vérifié ici — sinon n'importe qui sur Internet pourrait déclencher une
// synchro (ces routes utilisent service_role, contournent la RLS).
function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${secret}`;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expectedHeader);
  // timingSafeEqual throws on length mismatch, so compare hashed-length
  // buffers first — this length check itself is not timing-sensitive
  // since the secret's length isn't a secret worth protecting.
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export function isAuthorizedSyncRequest(request: Request): boolean {
  return bearerMatches(request, process.env.SYNC_SECRET);
}

// Routes déclenchées par un cron Vercel : Vercel envoie
// `Authorization: Bearer ${CRON_SECRET}` (on ne peut pas y mettre SYNC_SECRET).
// Accepte les deux, pour garder les déclenchements GitHub et manuels.
export function isAuthorizedCronRequest(request: Request): boolean {
  return (
    bearerMatches(request, process.env.SYNC_SECRET) ||
    bearerMatches(request, process.env.CRON_SECRET)
  );
}
