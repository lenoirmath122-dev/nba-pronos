import { timingSafeEqual } from "node:crypto";

// Authentification partagée des routes /api/sync/* et /api/heartbeat
// (SPEC_TECHNIQUE_SYNCHRO_V0.1 §6, ACTÉ §12.2) : Bearer + SYNC_SECRET,
// vérifié ici — sinon n'importe qui sur Internet pourrait déclencher une
// synchro (ces routes utilisent service_role, contournent la RLS).
export function isAuthorizedSyncRequest(request: Request): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expectedHeader);
  // timingSafeEqual throws on length mismatch, so compare hashed-length
  // buffers first — this length check itself is not timing-sensitive
  // since SYNC_SECRET's length isn't a secret worth protecting.
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
