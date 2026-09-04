import { execSync } from "node:child_process";

// Résout l'URL/les clés du Supabase LOCAL (jamais le projet hébergé de
// .env.local) en lisant `supabase status`, plutôt que de dupliquer des clés
// de démo en dur -- fonctionne pareil en local et en CI tant que `supabase
// start` a tourné avant `npm run test:integration`.
function readLocalSupabaseEnv() {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error(
      "Supabase local injoignable -- lancer `npx supabase start` avant `npm run test:integration`."
    );
  }
  const vars: Record<string, string> = {};
  for (const match of raw.matchAll(/^(\w+)="(.*)"$/gm)) {
    vars[match[1]] = match[2];
  }
  if (!vars.API_URL || !vars.ANON_KEY || !vars.SERVICE_ROLE_KEY) {
    throw new Error("Sortie de `supabase status -o env` incomplète (API_URL/ANON_KEY/SERVICE_ROLE_KEY).");
  }
  return { url: vars.API_URL, anonKey: vars.ANON_KEY, serviceRoleKey: vars.SERVICE_ROLE_KEY };
}

export const LOCAL_SUPABASE = readLocalSupabaseEnv();
