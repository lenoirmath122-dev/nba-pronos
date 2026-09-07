import "server-only";
import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";

// Rate limiting applicatif sur les routes AVANT authentification (p1-12,
// feuille de route Phase 1) -- login/signup/demande de reset-password.
// Clé sur l'IP DÉRIVÉE CÔTÉ SERVEUR (x-forwarded-for, posé par le proxy
// Vercel) -- jamais un champ de formulaire, qui serait trivialement
// falsifiable par l'appelant.
//
// Fail-CLOSED (contrairement à checkRateLimit(), lib/actions/rateLimit.ts,
// best-effort pour des fonctionnalités internes à un cercle fermé
// d'amis) : ces 3 routes sont justement le point d'entrée qu'un attaquant
// viserait, une panne du mécanisme lui-même ne doit pas rouvrir la porte
// en silence. Exception : si aucune IP n'est résolvable (hors du proxy
// Vercel -- dev local, tests), impossible de limiter QUI que ce soit sans
// bloquer tout le monde derrière un même compteur global -- laisse passer
// dans ce seul cas, jamais en production.
async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || null;
}

export async function checkAnonRateLimit(action: string, maxCount: number, windowSeconds: number): Promise<boolean> {
  const identifier = await clientIp();
  if (!identifier) return true; // hors Vercel (dev/test) -- voir commentaire de module.

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("check_anon_rate_limit", {
      p_identifier: identifier,
      p_action: action,
      p_max_count: maxCount,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`checkAnonRateLimit(${action}) : RPC en échec, refus par défaut (fail-closed) — ${error.message}`);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error(`checkAnonRateLimit(${action}) : exception, refus par défaut (fail-closed) —`, err);
    return false;
  }
}
