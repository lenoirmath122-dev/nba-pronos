import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import styles from "./page.module.css";

// Politique de confidentialité — route physique unique, hors des route
// groups (public)/(app), même patron que /regles (T6a §3.2/§8.1) : visiteur
// ou joueur connecté, contenu identique. Contenu sourcé sur le cadrage
// juridique complet (Cadrage/Juridique/conseils_juridiques_deploiement_
// application.md §9 registre des traitements + Cadrage/Juridique/
// politique_confidentialite.md, chantier RGPD du 02-03/09/2026).
export default async function ConfidentialitePage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Politique de confidentialité</p>
          <p className={styles.intro}>Ce que Panier Ballon fait de vos données, et comment les contrôler.</p>
        </div>

        <section className={`${styles.section} glass-card`} aria-label="Qui est responsable de vos données">
          <h2 className={styles.sectionTitle}>1. Qui est responsable de vos données ?</h2>
          <p className={styles.body}>
            Panier Ballon est édité par Mathieu Lenoir, particulier, en nom propre — voir les mentions légales
            pour les coordonnées complètes. C&apos;est cette personne qui est responsable du traitement de vos
            données au sens du RGPD.
          </p>
          <p className={styles.body}>
            Panier Ballon est aujourd&apos;hui un service <strong>gratuit, réservé à un cercle fermé
            d&apos;utilisateurs invités</strong> (bêta privée, France). <strong>Aucun mineur n&apos;est vérifié à
            l&apos;inscription</strong> : le service reste théoriquement accessible à tous âges (voir §7
            &quot;Mineurs&quot; ci-dessous).
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Données collectées">
          <h2 className={styles.sectionTitle}>2. Quelles données on collecte, pourquoi, et combien de temps</h2>
          <p className={styles.body}>Voici toutes les données que Panier Ballon collecte à ce jour :</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Pseudo et e-mail</strong> — pour créer votre compte et vous authentifier (exécution du
                contrat), conservés tant que votre compte est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Bio, équipe favorite, préférences d&apos;affichage</strong> — pour personnaliser votre
                profil (exécution du contrat), conservés tant que votre compte est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Vos pronostics</strong> (paris, résultats, statuts) — le cœur du service (exécution du
                contrat), conservés tant que votre compte est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Le texte libre de vos paris personnalisés</strong> — structuré automatiquement par une
                intelligence artificielle (Anthropic/Claude) pour calculer une probabilité (exécution du
                contrat), conservé tant que votre compte est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Vos messages de chat</strong> — pour les échanges entre membres d&apos;une ligue ou du
                canal général (exécution du contrat / intérêt légitime), conservés tant que votre compte est
                actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Vos signalements de bug</strong> — pour le support technique (intérêt légitime),
                conservés tant que votre compte est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Abonnement aux notifications push</strong> — si vous les activez (votre consentement),
                conservé tant que l&apos;abonnement est actif.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Actions des administrateurs</strong> (validation de paris, changements de rôle...) —
                traçabilité des décisions (intérêt légitime), conservées tant que le compte concerné est actif.
              </span>
            </li>
          </ul>
          <p className={styles.note}>
            Ce qu&apos;on ne collecte pas : date de naissance, adresse postale, données professionnelles, adresse
            IP.
          </p>
          <p className={styles.body}>
            Panier Ballon ne supprime aujourd&apos;hui aucune donnée automatiquement — vos données restent tant
            que votre compte existe, et sont supprimées seulement si vous en faites la demande (voir §5, &quot;Vos
            droits&quot;). C&apos;est un choix assumé, adapté à la taille actuelle du service, pas un oubli — il
            sera revu si le service s&apos;ouvre plus largement.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Prestataires">
          <h2 className={styles.sectionTitle}>3. Qui a accès à vos données (nos prestataires)</h2>
          <p className={styles.body}>
            Nous faisons appel aux prestataires suivants pour faire fonctionner Panier Ballon. Aucun d&apos;eux
            n&apos;est autorisé à utiliser vos données pour son propre compte.
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Supabase</strong> — hébergement de la base de données, authentification. Toutes vos
                données de compte et d&apos;activité.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Vercel</strong> — hébergement technique de l&apos;application. Vos requêtes lorsque vous
                utilisez l&apos;application.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Cloudflare (Turnstile)</strong> — protection anti-robot à l&apos;inscription. Signal
                technique de vérification, pas de donnée de profil.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Anthropic (Claude)</strong> — structuration automatique par IA du texte de vos paris
                personnalisés. Le texte que vous saisissez pour un pari personnalisé.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Service de notification push de votre navigateur</strong> (Google, Mozilla ou Apple
                selon le cas) — relais technique des notifications, si vous les activez.
              </span>
            </li>
          </ul>
          <p className={styles.note}>
            Anthropic est une société américaine — le texte de vos paris personnalisés lui est transmis pour être
            analysé, ce qui constitue un transfert hors de l&apos;Union européenne.
          </p>
          <p className={styles.body}>
            Nous ne faisons appel à aucun service de mesure d&apos;audience, de publicité, ni de paiement.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Cookies">
          <h2 className={styles.sectionTitle}>4. Cookies</h2>
          <p className={styles.body}>
            Panier Ballon utilise uniquement des cookies et technologies strictement nécessaires au
            fonctionnement du service : un cookie de session pour vous garder connecté, un cookie technique lié
            à la vérification anti-robot à l&apos;inscription, et une préférence d&apos;affichage enregistrée
            localement sur votre appareil (jamais transmise à nos serveurs).
          </p>
          <p className={styles.body}>
            Aucun de ces éléments ne nécessite votre consentement — nous ne les utilisons pas pour vous suivre ou
            vous cibler publicitairement, et nous n&apos;utilisons aucun autre traceur.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Vos droits">
          <h2 className={styles.sectionTitle}>5. Vos droits</h2>
          <p className={styles.body}>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement
            et de portabilité de vos données, ainsi que du droit de vous opposer à certains traitements.
          </p>
          <p className={styles.body}>
            Pour exercer ces droits, contactez panier.ballon.pronos@gmail.com. Étant donné la taille actuelle du
            service, votre demande est traitée manuellement par l&apos;exploitant — un accès direct depuis
            l&apos;application (export de vos données, suppression de votre compte) est prévu mais pas encore
            disponible.
          </p>
          <p className={styles.body}>
            Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL (www.cnil.fr) si
            vous estimez que vos droits ne sont pas respectés.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Sécurité">
          <h2 className={styles.sectionTitle}>6. Sécurité</h2>
          <p className={styles.body}>
            Nous mettons en œuvre des mesures de sécurité proportionnées à la nature du service : séparation des
            rôles administrateur/joueur, restrictions d&apos;accès à la base de données, protection des secrets
            techniques.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Mineurs">
          <h2 className={styles.sectionTitle}>7. Mineurs</h2>
          <p className={styles.body}>
            Panier Ballon n&apos;a pas mis en place de vérification d&apos;âge à l&apos;inscription : le service
            reste, en théorie, ouvert à tous âges, même si en pratique ses utilisateurs actuels sont des adultes
            (cercle d&apos;amis). Si vous êtes mineur et que vous utilisez Panier Ballon, vos données sont
            traitées selon les mêmes règles que celles décrites ci-dessus.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Modification de cette politique">
          <h2 className={styles.sectionTitle}>8. Modification de cette politique</h2>
          <p className={styles.body}>
            Cette politique de confidentialité peut évoluer, notamment si le service change de modèle économique
            ou s&apos;ouvre à un public plus large. Toute modification substantielle vous sera communiquée.
          </p>
        </section>
      </div>
    </ScreenShell>
  );
}
