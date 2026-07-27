import type { PlayerRow as PlayerRowData } from "@/lib/queries/admin-players";
import { setPlayerRoleFormAction, setPlayerStatusFormAction } from "@/lib/actions/admin-players";
import styles from "./PlayerRow.module.css";

// Une ligne de Gestion des joueurs (SPEC_ECRAN_ADMIN_PLAYERS_V0_1 §2) :
// actions contextuelles reflétant EXACTEMENT ce que le trigger DB autorise,
// jamais plus. Composant serveur, formulaires natifs indépendants.

type PlayerRowProps = {
  player: PlayerRowData;
  error?: string;
};

export function PlayerRow({ player, error }: PlayerRowProps) {
  const targetRole = player.role === "ADMIN" ? "PLAYER" : "ADMIN";
  const roleActionLabel = player.role === "ADMIN" ? "Rétrograder joueur" : "Promouvoir admin";
  const targetStatus = player.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  const statusActionLabel = player.status === "ACTIVE" ? "Désactiver" : "Réactiver";

  const roleDisabled = player.role === "ADMIN" && (player.isSelf || player.isLastActiveAdmin);
  const statusDisabled = player.role === "ADMIN" && player.status === "ACTIVE" && player.isLastActiveAdmin;
  const roleDisabledReason = player.isSelf ? "Toi-même" : player.isLastActiveAdmin ? "Dernier admin actif" : null;

  return (
    <li className={styles.row}>
      <div className={styles.identity}>
        <span className={styles.pseudo}>{player.pseudo}</span>
        <span className={player.role === "ADMIN" ? styles.roleBadgeAdmin : styles.roleBadgePlayer}>
          {player.role === "ADMIN" ? "Admin" : "Joueur"}
        </span>
        <span className={player.status === "ACTIVE" ? styles.statusBadgeActive : styles.statusBadgeDisabled}>
          {player.status === "ACTIVE" ? "Actif" : "Désactivé"}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <form action={setPlayerRoleFormAction}>
          <input type="hidden" name="userId" value={player.userId} />
          <input type="hidden" name="role" value={targetRole} />
          <button type="submit" className={styles.actionButton} disabled={roleDisabled} title={roleDisabledReason ?? undefined}>
            {roleDisabledReason ? `${roleActionLabel} (${roleDisabledReason})` : roleActionLabel}
          </button>
        </form>

        <form action={setPlayerStatusFormAction}>
          <input type="hidden" name="userId" value={player.userId} />
          <input type="hidden" name="status" value={targetStatus} />
          <button
            type="submit"
            className={styles.actionButton}
            disabled={statusDisabled}
            title={statusDisabled ? "Dernier admin actif" : undefined}
          >
            {statusDisabled ? `${statusActionLabel} (Dernier admin actif)` : statusActionLabel}
          </button>
        </form>
      </div>
    </li>
  );
}
