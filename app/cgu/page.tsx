import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import styles from "./page.module.css";

// CGU — route physique unique, hors des route groups (public)/(app), même
// patron que /regles (T6a §3.2/§8.1) : visiteur ou joueur connecté, contenu
// identique. Contenu sourcé sur le cadrage juridique complet
// (Cadrage/Juridique/conseils_juridiques_deploiement_application.md §2.5,
// §2.10, §2.11 + Cadrage/Juridique/cgu.md, chantier RGPD du 02-03/09/2026).
export default async function CguPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Conditions générales d&apos;utilisation</p>
          <p className={styles.intro}>Les règles du jeu, au sens juridique cette fois.</p>
        </div>

        <section className={`${styles.section} glass-card`} aria-label="Objet">
          <h2 className={styles.sectionTitle}>1. Objet</h2>
          <p className={styles.body}>
            Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
            l&apos;utilisation du service Panier Ballon, édité par Mathieu Lenoir (voir les mentions légales).
            En créant un compte, vous acceptez ces conditions.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Nature du service">
          <h2 className={styles.sectionTitle}>2. Nature du service</h2>
          <p className={styles.body}>
            Panier Ballon est un <strong>jeu gratuit de pronostics NBA à points fictifs</strong>, entre membres
            d&apos;un cercle fermé (bêta privée, sur invitation).{" "}
            <strong>
              Il n&apos;y a aucune mise financière, aucun droit d&apos;entrée, aucun gain à valeur monétaire
              réelle
            </strong>{" "}
            — le classement se joue en points sans valeur économique.
          </p>
          <p className={styles.body}>
            Si ce modèle venait à changer (introduction de mises réelles, de récompenses à valeur, ou d&apos;un
            modèle payant), ces CGU seraient intégralement revues.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Accès au service et création de compte">
          <h2 className={styles.sectionTitle}>3. Accès au service et création de compte</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>L&apos;accès à Panier Ballon se fait sur invitation, dans le cadre de la bêta actuelle.</span>
            </li>
            <li className={styles.listItem}>
              <span>Vous devez fournir un pseudo et une adresse e-mail valides pour créer un compte.</span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>L&apos;inscription requiert de certifier avoir 15 ans ou plus</strong> (case à cocher,
                déclarative, sans justificatif demandé) — le service n&apos;est pas ouvert en dessous de ce
                seuil. Il n&apos;est en revanche pas restreint aux majeurs au-delà — voir la politique de
                confidentialité pour plus de détails.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>Vous êtes responsable de la confidentialité de vos identifiants de connexion.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Règles d'utilisation">
          <h2 className={styles.sectionTitle}>4. Règles d&apos;utilisation</h2>
          <p className={styles.body}>En utilisant Panier Ballon, vous vous engagez à :</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>ne pas usurper l&apos;identité d&apos;un autre joueur ;</span>
            </li>
            <li className={styles.listItem}>
              <span>
                ne pas publier, dans le chat ou dans vos pronostics personnalisés, de contenu injurieux,
                discriminatoire, haineux ou illégal ;
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                ne pas tenter de contourner le fonctionnement normal du service (fraude sur les pronostics,
                exploitation d&apos;un bug pour obtenir un avantage) ;
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                utiliser le service dans un esprit de jeu entre amis, cohérent avec le cadre fermé et non
                commercial de la bêta.
              </span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Contenus publiés">
          <h2 className={styles.sectionTitle}>5. Contenus publiés</h2>
          <p className={styles.body}>
            Vous restez propriétaire du contenu que vous publiez sur Panier Ballon (messages de chat,
            formulation de vos pronostics). En les publiant, vous accordez à l&apos;éditeur le droit de les
            afficher et de les traiter (y compris via un service tiers d&apos;intelligence artificielle pour vos
            pronostics personnalisés, voir la politique de confidentialité) dans le cadre du fonctionnement du
            service.
          </p>
          <p className={styles.body}>
            L&apos;éditeur se réserve le droit de retirer tout contenu contraire aux présentes CGU, notamment
            dans le chat.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Modération">
          <h2 className={styles.sectionTitle}>6. Modération</h2>
          <p className={styles.body}>
            Les messages du chat peuvent être supprimés par un administrateur en cas de contenu contraire aux
            règles d&apos;utilisation.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Suspension et suppression de compte">
          <h2 className={styles.sectionTitle}>7. Suspension et suppression de compte</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                L&apos;éditeur peut suspendre ou supprimer un compte en cas de non-respect manifeste des
                présentes CGU.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                Vous pouvez demander la suppression de votre compte et de vos données à tout moment en
                contactant panier.ballon.pronos@gmail.com — voir la politique de confidentialité pour le détail
                de la procédure.
              </span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Disponibilité du service">
          <h2 className={styles.sectionTitle}>8. Disponibilité du service</h2>
          <p className={styles.body}>
            Panier Ballon est un service en développement actif (bêta). Sa disponibilité n&apos;est pas garantie
            de façon continue : des interruptions, évolutions ou changements de fonctionnalités peuvent survenir
            sans préavis.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Responsabilité">
          <h2 className={styles.sectionTitle}>9. Responsabilité</h2>
          <p className={styles.body}>
            Panier Ballon est un service gratuit fourni &quot;en l&apos;état&quot;, dans un cadre non commercial.
            L&apos;éditeur ne saurait être tenu responsable :
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>des interruptions ou dysfonctionnements du service ;</span>
            </li>
            <li className={styles.listItem}>
              <span>
                de l&apos;exactitude des probabilités ou statistiques calculées, qui restent indicatives et
                n&apos;ont pas vocation à servir de base à une décision de pari réel ;
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                des propos tenus par les utilisateurs dans le chat ou dans leurs pronostics, dans les limites de
                la modération raisonnablement mise en œuvre.
              </span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Droit applicable et litiges">
          <h2 className={styles.sectionTitle}>10. Droit applicable et litiges</h2>
          <p className={styles.body}>
            Les présentes CGU sont soumises au droit français. En cas de différend, une solution amiable sera
            recherchée en priorité, compte tenu du cadre informel du service (cercle d&apos;amis).
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Modification des CGU">
          <h2 className={styles.sectionTitle}>11. Modification des CGU</h2>
          <p className={styles.body}>
            Ces CGU peuvent être modifiées, notamment en cas d&apos;évolution du service (ouverture à un public
            plus large, changement de modèle économique). Toute modification substantielle vous sera
            communiquée.
          </p>
        </section>
      </div>
    </ScreenShell>
  );
}
