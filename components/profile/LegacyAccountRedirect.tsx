"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_MENU_URL } from "@/lib/nav/profileMenu";

// Ancienne ancre `#settings-xxx` de /profile?tab=compte -> page dédiée.
const ROUTE_BY_ANCHOR: Record<string, string> = {
  "settings-pseudo": "/profile/pseudo",
  "settings-identifiants": "/profile/identifiants",
  "settings-donnees": "/profile/donnees",
  "settings-rappels": "/profile/notifications",
  "settings-theme": "/profile/theme",
  "settings-prefs": "/profile/preferences",
  "settings-aide": "/profile/aide",
  "settings-legal": "/profile/legal",
  "settings-danger": "/profile/danger",
};

export function LegacyAccountRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ROUTE_BY_ANCHOR[window.location.hash.slice(1)] ?? PROFILE_MENU_URL);
  }, [router]);
  return null;
}
