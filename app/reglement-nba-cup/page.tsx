import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

// Option « meilleur pronostiqueur » (article 6 bis et seconde puce de l'article 7) :
// prévue mais désactivée. À passer à true, avec décision du lot et de l'enseigne
// de la carte cadeau, avant l'ouverture du bracket (28/11/2026).
const BEST_PREDICTOR_PRIZE_ENABLED = false;

// Règlement du jeu « NBA Cup 2026 » — texte validé, source :
// Cadrage/Juridique/brouillon_reglement_nba_cup_2026.md (section A).
// Route physique unique, même patron que /cgu : visiteur ou joueur connecté.
export const metadata = pageMetadata({
  title: "Règlement du jeu NBA Cup 2026",
  path: "/reglement-nba-cup",
  description: "Règlement du jeu NBA Cup 2026 de Panier Ballon : tirage au sort d'un maillot NBA, gratuit et sans achat.",
});

export default async function ReglementNbaCupPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Règlement du jeu « NBA Cup 2026 » de Panier Ballon</p>
          <p className={styles.intro}>
            <strong>En bref</strong> : remplis ton bracket de la NBA Cup avant le coup d&apos;envoi du premier quart de finale, le 4 décembre 2026, et tu participes au tirage au sort d&apos;un maillot NBA. C&apos;est gratuit, sans achat, et on n&apos;y joue jamais d&apos;argent.
          </p>
        </div>

        <section className={`${styles.section} glass-card`} aria-label="Organisateur">
          <h2 className={styles.sectionTitle}>Article 1 — Organisateur</h2>
          <p className={styles.body}>Le jeu est organisé par Mathieu Lenoir, particulier, éditeur du service Panier Ballon (https://panierballon.fr), ci-après « l&apos;organisateur ». Contact : panier.ballon.pronos@gmail.com. L&apos;adresse postale de l&apos;organisateur est communicable sur demande à l&apos;autorité compétente (voir les mentions légales).</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Dates">
          <h2 className={styles.sectionTitle}>Article 2 — Dates</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Ouverture du bracket NBA Cup : 28 novembre 2026.</span>
            </li>
            <li className={styles.listItem}>
              <span>Date limite : coup d&apos;envoi du premier quart de finale de la NBA Cup, prévu le 4 décembre 2026. L&apos;heure exacte (heure de Paris) est affichée dans l&apos;appli, sur l&apos;écran du bracket. Si la NBA déplace ce match, la date limite suit le nouveau coup d&apos;envoi.</span>
            </li>
            <li className={styles.listItem}>
              <span>Tirage au sort : le 4 décembre 2026, après la date limite.</span>
            </li>
            <li className={styles.listItem}>
              <span>Annonce du gagnant : au plus tard le 6 décembre 2026.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Qui peut participer">
          <h2 className={styles.sectionTitle}>Article 3 — Qui peut participer</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Toute personne physique de 15 ans ou plus, résidant en France, en Belgique ou en Suisse, titulaire d&apos;un compte Panier Ballon validé (adresse e-mail confirmée) à la date limite.</span>
            </li>
            <li className={styles.listItem}>
              <span>Un participant mineur doit avoir l&apos;accord de son représentant légal pour participer et pour recevoir le lot. L&apos;organisateur peut demander ce justificatif avant d&apos;envoyer le lot ; sans lui, le lot est remis en jeu.</span>
            </li>
            <li className={styles.listItem}>
              <span>Une seule participation par personne. Utiliser plusieurs comptes est interdit : dans ce cas, tous les comptes de la personne sont exclus du jeu.</span>
            </li>
            <li className={styles.listItem}>
              <span>Sont exclus : les comptes d&apos;administration de Panier Ballon (dont celui de l&apos;organisateur) et les comptes de test.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Gratuité">
          <h2 className={styles.sectionTitle}>Article 4 — Gratuité</h2>
          <p className={styles.body}>Le jeu est gratuit et sans obligation d&apos;achat. Créer un compte et remplir un bracket ne coûte rien. Panier Ballon est un jeu de pronos à points : on n&apos;y engage jamais d&apos;argent et on ne peut pas y en recevoir. Les points n&apos;ont aucune valeur marchande.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Comment participer">
          <h2 className={styles.sectionTitle}>Article 5 — Comment participer</h2>
          <p className={styles.body}>Pour participer au tirage au sort, il faut avoir rempli un bracket complet dans la compétition « NBA Cup » de l&apos;appli avant la date limite.</p>
          <p className={styles.body}>Un bracket est complet quand un vainqueur est choisi pour les 7 matchs du tableau final : les 4 quarts de finale, les 2 demi-finales et la finale. Un bracket rempli compte, même si le bouton « Valider » n&apos;a pas été utilisé. Après la date limite, le bracket ne peut plus être modifié.</p>
          <p className={styles.body}>Les points marqués avec le bracket et les pronos (décrits sur la page Règles) n&apos;ont aucune influence sur le tirage au sort : chaque bracket complet a la même chance d&apos;être tiré.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Désignation du gagnant">
          <h2 className={styles.sectionTitle}>Article 6 — Désignation du gagnant</h2>
          <p className={styles.body}>Le gagnant est tiré au sort parmi tous les participants remplissant les conditions des articles 3 et 5, avec un outil de tirage aléatoire. Le tirage est filmé et la vidéo est conservée jusqu&apos;à la fin de la période de réclamation (article 10). Un seul gagnant est désigné.</p>
        </section>

        {BEST_PREDICTOR_PRIZE_ENABLED && (
          <section className={`${styles.section} glass-card`} aria-label="Lot du meilleur pronostiqueur">
            <h2 className={styles.sectionTitle}>Article 6 bis — Lot du meilleur pronostiqueur</h2>
            <p className={styles.body}>Le participant classé premier du classement de la compétition « NBA Cup » à l&apos;issue de la finale (11 décembre 2026) remporte le lot décrit à l&apos;article 7. Ce classement additionne les points des pronos de matchs, du bracket et des pronos personnalisés, selon le barème de la page Règles. En cas d&apos;égalité, les participants sont départagés dans cet ordre : nombre de bons vainqueurs de match, nombre d&apos;écarts exacts, points de bracket. Si l&apos;égalité persiste, un tirage au sort filmé désigne le gagnant parmi les ex aequo. Les conditions de l&apos;article 3 s&apos;appliquent. Annonce le 12 décembre 2026.</p>
          </section>
        )}

        <section className={`${styles.section} glass-card`} aria-label="Lots">
          <h2 className={styles.sectionTitle}>Article 7 — Lots</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Tirage au sort : un maillot NBA Nike Swingman, équipe et taille au choix du gagnant parmi les modèles disponibles, d&apos;une valeur indicative de 104,99 € TTC (prix public constaté sur nike.com France en novembre 2026).</span>
            </li>
            {BEST_PREDICTOR_PRIZE_ENABLED && (
              <li className={styles.listItem}>
                <span>Meilleur pronostiqueur : une carte cadeau numérique de 50 €.</span>
              </li>
            )}
          </ul>
          <p className={styles.body}>Les lots ne peuvent être ni échangés, ni remboursés en argent, ni cédés. Si un lot n&apos;est plus disponible, l&apos;organisateur peut le remplacer par un lot de valeur égale ou supérieure.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Remise des lots">
          <h2 className={styles.sectionTitle}>Article 8 — Remise des lots</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Le gagnant est prévenu par e-mail, à l&apos;adresse de son compte Panier Ballon, et par un message dans l&apos;appli (chat et notification, s&apos;il les a activées). Son pseudo peut aussi être annoncé sur le compte Instagram de Panier Ballon.</span>
            </li>
            <li className={styles.listItem}>
              <span>Il a 7 jours à partir de l&apos;envoi de l&apos;e-mail pour répondre et donner son nom, son adresse postale et, pour le maillot, l&apos;équipe et la taille choisies. Sans réponse dans ce délai, il perd son lot et un nouveau tirage au sort est fait parmi les autres participants, selon les mêmes règles.</span>
            </li>
            <li className={styles.listItem}>
              <span>Le maillot est envoyé en colis suivi, aux frais de l&apos;organisateur, dans les 30 jours qui suivent la réception de ces informations. Une carte cadeau numérique est envoyée par e-mail.</span>
            </li>
            <li className={styles.listItem}>
              <span>L&apos;organisateur n&apos;est pas responsable d&apos;une perte ou d&apos;un retard dû au transporteur, ni d&apos;une adresse incomplète ou erronée donnée par le gagnant.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Fraude">
          <h2 className={styles.sectionTitle}>Article 9 — Fraude</h2>
          <p className={styles.body}>L&apos;organisateur peut annuler la participation de toute personne qui triche : comptes multiples, fausse déclaration d&apos;âge ou de résidence, exploitation d&apos;un bug, contournement de la date limite ou tout autre moyen contraire au présent règlement ou aux conditions générales d&apos;utilisation. Un lot obtenu de cette façon n&apos;est pas remis, ou doit être restitué.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Données personnelles">
          <h2 className={styles.sectionTitle}>Article 10 — Données personnelles</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Responsable du traitement : Mathieu Lenoir (contact : panier.ballon.pronos@gmail.com).</span>
            </li>
            <li className={styles.listItem}>
              <span>Données utilisées : les données du compte déjà présentes dans l&apos;appli (pseudo, e-mail, bracket) et, pour le seul gagnant, son nom, son adresse postale et son choix de maillot.</span>
            </li>
            <li className={styles.listItem}>
              <span>Finalités : organiser le jeu, désigner le gagnant, le contacter, lui remettre son lot et annoncer son pseudo.</span>
            </li>
            <li className={styles.listItem}>
              <span>Base légale : l&apos;exécution du présent règlement, que le participant accepte en participant.</span>
            </li>
            <li className={styles.listItem}>
              <span>Destinataires : l&apos;organisateur ; le transporteur chargé du colis (nom et adresse du gagnant) ; le commerçant auprès duquel le lot est commandé, si le lot lui est envoyé directement.</span>
            </li>
            <li className={styles.listItem}>
              <span>Publication : seul le pseudo du gagnant peut être publié (stories Instagram, mur des champions dans l&apos;appli), jamais son nom. Le gagnant peut refuser cette publication en le disant par e-mail, sans perdre son lot.</span>
            </li>
            <li className={styles.listItem}>
              <span>Durée de conservation : les données du compte restent soumises à la politique de confidentialité de Panier Ballon. Le nom, l&apos;adresse et le choix de lot du gagnant sont supprimés 6 mois après la remise du lot (période de réclamation). La liste des participants tirés au sort et la vidéo du tirage sont conservées pendant la même période.</span>
            </li>
            <li className={styles.listItem}>
              <span>Droits : accès, rectification, effacement, opposition et limitation, en écrivant à panier.ballon.pronos@gmail.com. Effacer ses données avant le tirage revient à renoncer à participer. Le participant peut aussi faire une réclamation auprès de la CNIL (www.cnil.fr).</span>
            </li>
            <li className={styles.listItem}>
              <span>Participer au jeu n&apos;oblige à accepter aucune prospection commerciale.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Plateformes">
          <h2 className={styles.sectionTitle}>Article 11 — Plateformes</h2>
          <p className={styles.body}>Ce jeu n&apos;est ni organisé, ni parrainé, ni géré par Instagram ou Meta, ni associé à ces plateformes. Chaque participant dégage Instagram et Meta de toute responsabilité.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Responsabilité, modification, annulation, droit applicable">
          <h2 className={styles.sectionTitle}>Article 12 — Responsabilité, modification, annulation, droit applicable</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>L&apos;organisateur peut modifier, reporter, écourter ou annuler le jeu si des circonstances indépendantes de sa volonté l&apos;imposent : panne ou bug de l&apos;appli, report ou annulation de matchs par la NBA, fraude massive. Les participants en sont informés sur cette page et dans l&apos;appli. Le cas échéant, le tirage au sort est maintenu parmi les brackets complets enregistrés.</span>
            </li>
            <li className={styles.listItem}>
              <span>L&apos;organisateur n&apos;est pas responsable d&apos;une impossibilité de se connecter ou de remplir son bracket due au réseau, à l&apos;appareil du participant ou à une interruption ponctuelle du service.</span>
            </li>
            <li className={styles.listItem}>
              <span>Participer implique d&apos;accepter le présent règlement. Le règlement est soumis au droit français. En cas de désaccord, une solution amiable est recherchée en priorité, en écrivant à panier.ballon.pronos@gmail.com ; à défaut, les tribunaux compétents sont ceux désignés par la loi.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Consultation du règlement">
          <h2 className={styles.sectionTitle}>Article 13 — Consultation du règlement</h2>
          <p className={styles.body}>Ce règlement est consultable gratuitement pendant toute la durée du jeu à l&apos;adresse https://panierballon.fr/reglement-nba-cup. Il n&apos;est pas déposé chez un commissaire de justice : ce dépôt n&apos;est plus obligatoire depuis la loi n° 2014-1545 du 20 décembre 2014.</p>
        </section>

        <p className={styles.note}>Version du 24/11/2026.</p>
      </div>
    </ScreenShell>
  );
}
