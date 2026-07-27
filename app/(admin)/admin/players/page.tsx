import { getPlayers } from "@/lib/queries/admin-players";
import { PlayerRow } from "@/components/admin/PlayerRow";
import styles from "./page.module.css";

// Gestion des joueurs (SPEC_ECRAN_ADMIN_PLAYERS_V0_1, VALIDÉ) — troisième
// écran du lot Admin. Composant serveur, aucun "use client".

type SearchParams = { playersError?: string; userId?: string };

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const players = await getPlayers();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Gestion des joueurs</h1>

      <ul className={styles.list}>
        {players.map((player) => (
          <PlayerRow
            key={player.userId}
            player={player}
            error={sp.userId === player.userId ? sp.playersError : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
