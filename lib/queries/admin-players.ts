import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

// Lecture de l'écran Gestion des joueurs (SPEC_ECRAN_ADMIN_PLAYERS_V0_1
// §1/§2). Tous les joueurs, ADMIN d'abord puis PLAYER, alphabétique par
// pseudo dans chaque groupe.

export type PlayerRow = {
  userId: string;
  pseudo: string;
  role: "PLAYER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  isSelf: boolean;
  isLastActiveAdmin: boolean;
  email: string | null;
  pushDevices: number;
};

type UserRow = { id: string; pseudo: string; role: "PLAYER" | "ADMIN"; status: "ACTIVE" | "DISABLED" };

export async function getPlayers(): Promise<PlayerRow[]> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("users")
    .select("id, pseudo, role, status")
    .order("pseudo", { ascending: true });

  const users = (data ?? []) as UserRow[];
  const activeAdminCount = users.filter((u) => u.role === "ADMIN" && u.status === "ACTIVE").length;

  // Contact + push : e-mail dans auth.users et abonnements push (RLS
  // verrouillée sur user_id = auth.uid()) → lecture service_role, côté
  // serveur uniquement. Cette page n'est atteignable que par un ADMIN.
  const service = getServiceClient();
  const emailById = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data: list } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = list?.users ?? [];
    for (const au of batch) if (au.email) emailById.set(au.id, au.email);
    if (batch.length < 1000) break;
  }
  const { data: subs } = await service.from("push_subscriptions").select("user_id");
  const devicesById = new Map<string, number>();
  for (const s of (subs ?? []) as { user_id: string }[]) {
    devicesById.set(s.user_id, (devicesById.get(s.user_id) ?? 0) + 1);
  }

  const rows: PlayerRow[] = users.map((u) => ({
    userId: u.id,
    pseudo: u.pseudo,
    role: u.role,
    status: u.status,
    isSelf: u.id === user?.id,
    isLastActiveAdmin: u.role === "ADMIN" && u.status === "ACTIVE" && activeAdminCount === 1,
    email: emailById.get(u.id) ?? null,
    pushDevices: devicesById.get(u.id) ?? 0,
  }));

  // ADMIN d'abord, puis PLAYER — alphabétique déjà garanti par l'ORDER BY
  // dans chaque groupe (tri stable).
  return rows.sort((a, b) => (a.role === b.role ? 0 : a.role === "ADMIN" ? -1 : 1));
}
