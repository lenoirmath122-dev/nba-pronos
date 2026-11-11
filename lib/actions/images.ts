"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { processImage, type ImageKind } from "@/lib/images/processImage";

// Avatar du joueur et logo de ligue. Fichier -> sharp (lib/images/processImage.ts)
// -> bucket public -> URL enregistrée. Le chemin change à chaque envoi (?v=) pour
// contourner le cache du navigateur et du CDN.
export type ImageActionResult = { ok: true; url: string | null } | { ok: false; error: string };

async function currentUserId(): Promise<string | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function store(bucket: string, path: string, kind: ImageKind, file: File | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!(file instanceof File)) return { ok: false, error: "Choisis une image." };
  const processed = await processImage(file, kind);
  if (!processed.ok) return processed;
  const service = getServiceClient();
  const { error } = await service.storage.from(bucket).upload(path, processed.buffer, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return { ok: false, error: "Envoi impossible, réessaie." };
  const { data } = service.storage.from(bucket).getPublicUrl(path);
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

export async function uploadAvatarAction(formData: FormData): Promise<ImageActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Connecte-toi." };
  const stored = await store("avatars", `${userId}.webp`, "avatar", formData.get("file") as File | null);
  if (!stored.ok) return stored;
  const { error } = await getServiceClient().from("users").update({ avatar_url: stored.url }).eq("id", userId);
  if (error) return { ok: false, error: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, url: stored.url };
}

export async function removeAvatarAction(): Promise<ImageActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Connecte-toi." };
  const service = getServiceClient();
  await service.storage.from("avatars").remove([`${userId}.webp`]);
  const { error } = await service.from("users").update({ avatar_url: null }).eq("id", userId);
  if (error) return { ok: false, error: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}

// Seul le créateur de la ligue change son logo.
export async function uploadLeagueLogoAction(leagueId: string, formData: FormData): Promise<ImageActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Connecte-toi." };
  const service = getServiceClient();
  const { data: league } = await service
    .from("leagues")
    .select("created_by_user_id")
    .eq("id", leagueId)
    .maybeSingle<{ created_by_user_id: string }>();
  if (!league || league.created_by_user_id !== userId) return { ok: false, error: "Seul le créateur de la ligue peut changer son logo." };
  const stored = await store("league-logos", `${leagueId}.webp`, "league-logo", formData.get("file") as File | null);
  if (!stored.ok) return stored;
  const { error } = await service.from("leagues").update({ logo_url: stored.url }).eq("id", leagueId);
  if (error) return { ok: false, error: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, url: stored.url };
}
