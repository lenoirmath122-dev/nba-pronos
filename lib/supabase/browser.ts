import { createBrowserClient } from "@supabase/ssr";

// Client NAVIGATEUR (composants "use client") : clé anon, session en cookie.
// Lecture + souscription Realtime uniquement (T6a §2.4).
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
