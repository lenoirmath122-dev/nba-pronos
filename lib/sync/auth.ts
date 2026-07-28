// Authentification partagée des routes /api/sync/* et /api/heartbeat
// (SPEC_TECHNIQUE_SYNCHRO_V0.1 §6, ACTÉ §12.2) : Bearer + SYNC_SECRET,
// vérifié ici — sinon n'importe qui sur Internet pourrait déclencher une
// synchro (ces routes utilisent service_role, contournent la RLS).
export function isAuthorizedSyncRequest(request: Request): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
