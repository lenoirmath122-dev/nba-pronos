import "server-only";
import { sendPushToAdmins } from "@/lib/push/admins";
import { getServiceClient } from "@/lib/supabase/service";
import type { WeeklyPopupDoubtCode, WeeklyPopupKind } from "./types";

// Alerte admin d'une génération terminée (plan §5.1). Une seule fois par
// brouillon (`admin_notified_at is null`, posé AVANT l'envoi), jamais pour un
// déclenchement manuel (l'admin est déjà devant l'écran : décidé par
// `generate.ts`). Ne lève jamais. Textes fixes, aucune donnée de joueur.

const REASONS: Record<WeeklyPopupDoubtCode, string> = {
  invalid_output: "sortie illisible",
  max_tokens: "sortie trop longue",
  api_error: "erreur de l'API",
  timeout: "délai dépassé",
  cap_reached: "plafond de dépense atteint",
  refusal: "refus du modèle",
  structure: "contrôles non passés",
  budget: "temps insuffisant",
  stale: "semaine trop ancienne",
  internal: "erreur interne",
};

export function doubtReason(code: WeeklyPopupDoubtCode | null): string {
  return code ? REASONS[code] : "motif inconnu";
}

export interface DraftNotice {
  status: "READY" | "DOUBTFUL";
  kind: WeeklyPopupKind;
  doubtCode: WeeklyPopupDoubtCode | null;
  weekEnd: string;
}

type Client = ReturnType<typeof getServiceClient>;

export function draftPayload(info: DraftNotice): { title: string; body: string; url: string } {
  const week = `${info.weekEnd.slice(8, 10)}/${info.weekEnd.slice(5, 7)}`;
  if (info.status === "DOUBTFUL") {
    return {
      title: `Popup hebdo bloquée : ${doubtReason(info.doubtCode)}`,
      body: `Semaine du ${week} : à régénérer ou à rédiger à la main.`,
      url: "/admin/popup",
    };
  }
  return {
    title: "Popup hebdo prête à relire",
    body:
      info.kind === "FALLBACK"
        ? `Semaine du ${week} : texte de repli, à relire avant publication.`
        : `Semaine du ${week} : brouillon prêt, à relire avant publication.`,
    url: "/admin/popup",
  };
}

export async function notifyAdminsOfDraft(
  popupId: string,
  info: DraftNotice,
  deps: { client?: Client; send?: typeof sendPushToAdmins; now?: () => number } = {},
): Promise<{ sent: boolean }> {
  try {
    const supabase = deps.client ?? getServiceClient();
    const send = deps.send ?? sendPushToAdmins;
    const stamp = new Date((deps.now ?? Date.now)()).toISOString();
    const { data, error } = await supabase
      .from("weekly_popups")
      .update({ admin_notified_at: stamp })
      .eq("id", popupId)
      .is("admin_notified_at", null)
      .select("id");
    if (error || !data || data.length === 0) return { sent: false };
    const delivery = await send(draftPayload(info));
    if (!delivery.ok) {
      // Aucun admin abonné, ou envoi en échec : le tampon est retiré, sinon
      // l'alerte serait perdue pour de bon (aucun passage ne renotifie).
      await supabase.from("weekly_popups").update({ admin_notified_at: null }).eq("id", popupId);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("notifyAdminsOfDraft : échec non bloquant", error instanceof Error ? error.name : "Error");
    return { sent: false };
  }
}
