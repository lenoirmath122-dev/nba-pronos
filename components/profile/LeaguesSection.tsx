import { createLeagueFormAction, joinLeagueFormAction, leaveLeagueFormAction } from "@/lib/actions/leagues";
import { uploadLeagueLogoAction } from "@/lib/actions/images";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { BadgeCheckOnMount } from "@/components/badges/BadgeCheckOnMount";
import type { getMyLeagues } from "@/lib/queries/leagues";
import styles from "./profileShared.module.css";

type LeaguesSectionProps = {
  leagues: Awaited<ReturnType<typeof getMyLeagues>>;
  error?: string;
  joinedName?: string;
  newLeagueName?: string;
  newLeagueCode?: string;
};

export function LeaguesSection({ leagues, error, joinedName, newLeagueName, newLeagueCode }: LeaguesSectionProps) {
  return (
    <section className={`${styles.section} glass-card`}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {joinedName && (
        <p className={styles.success} role="status">
          Tu as rejoint « {joinedName} ».
        </p>
      )}
      {newLeagueName && newLeagueCode && (
        <p className={styles.success} role="status">
          Ligue « {newLeagueName} » créée. Code à partager : <span className={styles.leagueCode}>{newLeagueCode}</span>
        </p>
      )}
      {(joinedName || newLeagueName) && <BadgeCheckOnMount />}

      {leagues.length > 0 && (
        <div className={styles.leagueList}>
          {leagues.map((league) => (
            <div key={league.id} className={styles.leagueRow}>
              <div className={styles.leagueInfo}>
                {league.isCreator ? (
                  <ImageUploader
                    currentUrl={league.logoUrl}
                    fallback={league.name.slice(0, 2).toUpperCase()}
                    shape="square"
                    label="Changer le logo"
                    upload={uploadLeagueLogoAction.bind(null, league.id)}
                  />
                ) : (
                  league.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={league.logoUrl} alt="" width={48} height={48} style={{ borderRadius: 8, objectFit: "cover" }} />
                  )
                )}
                <span className={styles.leagueName}>{league.name}</span>
                <span className={styles.leagueMeta}>
                  {league.memberCount} membre{league.memberCount > 1 ? "s" : ""} · code{" "}
                  <span className={styles.leagueCode}>{league.code}</span>
                </span>
              </div>
              <form action={leaveLeagueFormAction}>
                <input type="hidden" name="leagueId" value={league.id} />
                <button type="submit" className={styles.leaveButton}>
                  Quitter
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className={styles.leagueForms}>
        <form action={createLeagueFormAction} className={styles.leagueForm}>
          <input type="text" name="name" placeholder="Nom de la nouvelle ligue" required className={styles.leagueInput} />
          <button type="submit" className={styles.secondaryButton}>
            Créer
          </button>
        </form>

        <form action={joinLeagueFormAction} className={styles.leagueForm}>
          <input
            type="text"
            name="code"
            placeholder="Code de ligue reçu d'un ami"
            required
            className={styles.leagueInput}
          />
          <button type="submit" className={styles.secondaryButton}>
            Rejoindre
          </button>
        </form>
      </div>
    </section>
  );
}
