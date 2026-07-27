import { getServerClient } from "@/lib/supabase/server";

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

  const rows: PlayerRow[] = users.map((u) => ({
    userId: u.id,
    pseudo: u.pseudo,
    role: u.role,
    status: u.status,
    isSelf: u.id === user?.id,
    isLastActiveAdmin: u.role === "ADMIN" && u.status === "ACTIVE" && activeAdminCount === 1,
  }));

  // ADMIN d'abord, puis PLAYER — alphabétique déjà garanti par l'ORDER BY
  // dans chaque groupe (tri stable).
  return rows.sort((a, b) => (a.role === b.role ? 0 : a.role === "ADMIN" ? -1 : 1));
}
