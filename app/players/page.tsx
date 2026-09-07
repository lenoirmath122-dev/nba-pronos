import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { getPlayersDirectory } from "@/lib/queries/players-directory";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { EmptyState } from "@/components/home/EmptyState";
import { TeamLogo } from "@/components/ui/TeamLogo";
import styles from "./page.module.css";

// Index de `/players/[userId]` (BACKLOG, "Phase 0" — la route dynamique
// existait sans page d'index, tomber dessus directement donnait un 404).
// Même patron que /leaderboard : route physique hors des route groups,
// visiteur ou joueur connecté voient la même liste (RLS `users_select using
// (true)` seule autorité).
export default async function PlayersDirectoryPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const players = await getPlayersDirectory();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Joueurs</p>
        </div>

        {players.length === 0 ? (
          <EmptyState title="Aucun joueur pour l'instant" subtitle="Reviens plus tard." />
        ) : (
          <ul className={`${styles.list} glass-card`}>
            {players.map((player) => (
              <li key={player.userId}>
                <Link href={`/players/${player.userId}`} className={styles.row}>
                  {player.favoriteTeam ? (
                    <TeamLogo abbreviation={player.favoriteTeam.abbreviation} alt={player.favoriteTeam.name} size={28} />
                  ) : (
                    <span className={styles.noTeam} aria-hidden="true" />
                  )}
                  <span className={styles.pseudo}>{player.pseudo}</span>
                  {player.isAdmin && <span className={styles.badge}>Admin</span>}
                  {player.isInactive && <span className={styles.badge}>Compte désactivé</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ScreenShell>
  );
}
