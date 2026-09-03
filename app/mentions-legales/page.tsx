import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import styles from "./page.module.css";

// Mentions légales — route physique unique, hors des route groups
// (public)/(app), même patron que /regles (T6a §3.2/§8.1) : visiteur ou
// joueur connecté, contenu identique. Contenu sourcé sur le cadrage
// juridique complet (Cadrage/Juridique/conseils_juridiques_deploiement_
// application.md + Cadrage/Juridique/mentions_legales.md, chantier RGPD du
// 02-03/09/2026) — pas improvisé ici.
export default async function MentionsLegalesPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Mentions légales</p>
          <p className={styles.intro}>Identification de l&apos;éditeur du service Panier Ballon (nba-pronos).</p>
        </div>

        <section className={`${styles.section} glass-card`} aria-label="Éditeur du site">
          <h2 className={styles.sectionTitle}>Éditeur du site</h2>
          <p className={styles.body}>Le service est édité par :</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Nom</strong> — Mathieu Lenoir
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Statut</strong> — particulier, en nom propre (pas de structure juridique déclarée à ce
                jour)
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Adresse</strong> — communicable sur demande à l&apos;autorité compétente
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Contact</strong> — panier.ballon.pronos@gmail.com
              </span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Directeur de la publication">
          <h2 className={styles.sectionTitle}>Directeur de la publication</h2>
          <p className={styles.body}>Mathieu Lenoir (même identité que l&apos;éditeur, en l&apos;absence de structure distincte).</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Hébergement">
          <h2 className={styles.sectionTitle}>Hébergement</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Hébergeur du service applicatif</strong> — Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA
                91789, États-Unis
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Hébergeur de la base de données et de l&apos;authentification</strong> — Supabase Inc.
              </span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Nature du service">
          <h2 className={styles.sectionTitle}>Nature du service</h2>
          <p className={styles.body}>
            Panier Ballon est un service gratuit de pronostics NBA à points fictifs, réservé pour l&apos;instant
            à un cercle fermé d&apos;utilisateurs invités (bêta privée, France). Aucune mise financière réelle,
            aucun paiement, aucun lot à valeur monétaire n&apos;est proposé à ce jour.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Propriété intellectuelle">
          <h2 className={styles.sectionTitle}>Propriété intellectuelle</h2>
          <p className={styles.body}>
            Le code source, les textes et l&apos;identité visuelle propre à Panier Ballon (logo de
            l&apos;application) sont la propriété de l&apos;éditeur, sauf mention contraire. Les données et
            éléments visuels relatifs à la NBA, ses équipes et ses joueurs (noms, statistiques, logos
            d&apos;équipes) appartiennent à leurs propriétaires respectifs (NBA Properties, franchises
            concernées) et sont utilisés à titre informatif, non commercial, dans le cadre d&apos;un service
            gratuit entre particuliers.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Contact">
          <h2 className={styles.sectionTitle}>Contact</h2>
          <p className={styles.body}>
            Pour toute question relative au service, à ses données ou à son fonctionnement :
            panier.ballon.pronos@gmail.com.
          </p>
        </section>
      </div>
    </ScreenShell>
  );
}
