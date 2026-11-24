import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

// Montant de chaque carte cadeau numérique Decathlon (lots 1 et 2), en euros.
const GIFT_CARD_EUR = 50;

// Règlement du jeu « NBA Cup 2026 », version 2 — texte validé, source :
// Cadrage/Juridique/brouillon_reglement_nba_cup_2026.md (section A).
// Classements des lots : scripts/classements-nba-cup-lots.sql.
// Route physique unique, même patron que /cgu : visiteur ou joueur connecté.
export const metadata = pageMetadata({
  title: "Règlement du jeu NBA Cup 2026",
  path: "/reglement-nba-cup",
  description: `Règlement du jeu NBA Cup 2026 de Panier Ballon : deux cartes cadeaux Decathlon de ${GIFT_CARD_EUR} € à gagner au classement, gratuit et sans achat.`,
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
            <strong>En bref</strong> : deux cartes cadeaux numériques Decathlon de {GIFT_CARD_EUR} € sont à gagner au classement. Une pour le meilleur bracket de la NBA Cup, une pour le meilleur pronostiqueur des matchs de la Cup, du premier quart de finale à la finale. C&apos;est gratuit, sans achat, et on n&apos;y joue jamais d&apos;argent.
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
              <span>Date limite du bracket : coup d&apos;envoi du premier quart de finale de la NBA Cup, prévu le 4 décembre 2026. L&apos;heure exacte (heure de Paris) est affichée dans l&apos;appli, sur l&apos;écran du bracket. Si la NBA déplace ce match, la date limite suit le nouveau coup d&apos;envoi.</span>
            </li>
            <li className={styles.listItem}>
              <span>Fin du jeu : à l&apos;issue de la finale de la NBA Cup, prévue le 11 décembre 2026.</span>
            </li>
            <li className={styles.listItem}>
              <span>Annonce des gagnants : au plus tard le 14 décembre 2026.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Qui peut participer">
          <h2 className={styles.sectionTitle}>Article 3 — Qui peut participer</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Toute personne physique de 15 ans ou plus, résidant en France, en Belgique ou en Suisse, titulaire d&apos;un compte Panier Ballon validé (adresse e-mail confirmée) à la date limite du bracket.</span>
            </li>
            <li className={styles.listItem}>
              <span>Un participant mineur doit avoir l&apos;accord de son représentant légal pour participer et pour recevoir le lot. L&apos;organisateur peut demander ce justificatif avant d&apos;envoyer le lot ; sans lui, le lot passe au suivant du classement.</span>
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
          <p className={styles.body}>Le jeu est gratuit et sans obligation d&apos;achat. Créer un compte, remplir un bracket et faire des pronos ne coûte rien. Panier Ballon est un jeu de pronos à points : on n&apos;y engage jamais d&apos;argent et on ne peut pas y en recevoir. Les points n&apos;ont aucune valeur marchande.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Comment participer">
          <h2 className={styles.sectionTitle}>Article 5 — Comment participer</h2>
          <p className={styles.body}>Le jeu se joue dans la compétition « NBA Cup » de l&apos;appli. Il y a deux lots, chacun avec son propre classement (article 6).</p>
          <p className={styles.body}>Lot 1 — bracket : il faut remplir son bracket avant la date limite. Le bracket compte un vainqueur à choisir pour chacun des 7 matchs du tableau final : les 4 quarts de finale, les 2 demi-finales et la finale. Un bracket rempli compte, même si le bouton « Valider » n&apos;a pas été utilisé. Après la date limite, le bracket ne peut plus être modifié.</p>
          <p className={styles.body}>Lot 2 — pronos de matchs : il faut faire ses pronos sur les matchs de la compétition NBA Cup, du premier quart de finale à la finale, avant le coup d&apos;envoi de chaque match.</p>
          <p className={styles.body}>Les points du bracket et des pronos sont calculés selon le barème décrit sur la page Règles.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Désignation des gagnants">
          <h2 className={styles.sectionTitle}>Article 6 — Désignation des gagnants</h2>
          <p className={styles.body}>Les gagnants sont désignés uniquement au classement, à l&apos;issue de la finale, parmi les participants remplissant les conditions de l&apos;article 3.</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Lot 1 — meilleur bracket : le compte dont le bracket, rempli avant la date limite, totalise le plus de points de bracket à l&apos;issue de la finale. En cas d&apos;égalité, les participants sont départagés dans cet ordre : 1) le plus de bons vainqueurs dans le bracket ; 2) le bon champion ; 3) le bracket créé le plus tôt.</span>
            </li>
            <li className={styles.listItem}>
              <span>Lot 2 — meilleur pronostiqueur des matchs de la Cup : le compte qui totalise le plus de points sur les pronos de matchs de la compétition NBA Cup, du premier quart de finale à la finale. Ne comptent ni le bracket, ni les pronos personnalisés, ni la saison régulière. En cas d&apos;égalité, les participants sont départagés dans cet ordre : 1) le plus de bons vainqueurs ; 2) le plus d&apos;écarts exacts ; 3) le premier prono de la Cup posé le plus tôt.</span>
            </li>
            <li className={styles.listItem}>
              <span>Pas de cumul : si le gagnant du lot 1 est aussi premier du classement du lot 2, le lot 2 passe au suivant de ce classement.</span>
            </li>
          </ul>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Lots">
          <h2 className={styles.sectionTitle}>Article 7 — Lots</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Lot 1 — meilleur bracket : une carte cadeau numérique Decathlon de {GIFT_CARD_EUR} €.</span>
            </li>
            <li className={styles.listItem}>
              <span>Lot 2 — meilleur pronostiqueur des matchs de la Cup : une carte cadeau numérique Decathlon de {GIFT_CARD_EUR} €.</span>
            </li>
          </ul>
          <p className={styles.body}>Les cartes cadeaux ne peuvent être ni échangées, ni remboursées en argent, ni cédées. Si l&apos;enseigne n&apos;est plus disponible, l&apos;organisateur peut remplacer la carte par une carte cadeau de valeur équivalente.</p>
          <p className={styles.body}>Decathlon n&apos;organise pas ce jeu et ne le parraine pas.</p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Remise des lots">
          <h2 className={styles.sectionTitle}>Article 8 — Remise des lots</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>Chaque gagnant est contacté par e-mail, à l&apos;adresse de son compte Panier Ballon. Il peut aussi être prévenu par un message dans l&apos;appli (chat et notification, s&apos;il les a activées). Son pseudo peut être annoncé sur le compte Instagram de Panier Ballon.</span>
            </li>
            <li className={styles.listItem}>
              <span>Il a 7 jours à partir de l&apos;envoi de l&apos;e-mail pour répondre. Sans réponse dans ce délai, il perd son lot, qui passe au suivant du classement, selon les mêmes règles.</span>
            </li>
            <li className={styles.listItem}>
              <span>La carte cadeau est envoyée par e-mail, à l&apos;adresse du compte, dans les 15 jours qui suivent la réponse du gagnant. Aucune adresse postale n&apos;est demandée.</span>
            </li>
            <li className={styles.listItem}>
              <span>L&apos;organisateur n&apos;est pas responsable d&apos;une adresse e-mail erronée ou qui n&apos;est plus utilisée sur le compte du gagnant.</span>
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
              <span>Données utilisées : les données du compte déjà présentes dans l&apos;appli (pseudo, e-mail, bracket, pronos de matchs) et, pour les seuls gagnants, leur réponse à l&apos;e-mail de contact.</span>
            </li>
            <li className={styles.listItem}>
              <span>Finalités : organiser le jeu, établir les classements, désigner les gagnants, les contacter, leur envoyer leur carte cadeau et annoncer leur pseudo.</span>
            </li>
            <li className={styles.listItem}>
              <span>Base légale : l&apos;exécution du présent règlement, que le participant accepte en participant.</span>
            </li>
            <li className={styles.listItem}>
              <span>Destinataires : l&apos;organisateur ; l&apos;enseigne qui émet la carte cadeau, uniquement si elle l&apos;envoie elle-même au gagnant (son adresse e-mail, pour cet envoi).</span>
            </li>
            <li className={styles.listItem}>
              <span>Publication : seul le pseudo d&apos;un gagnant peut être publié (stories Instagram, mur des champions dans l&apos;appli), jamais son nom. Le gagnant peut refuser cette publication en le disant par e-mail, sans perdre son lot.</span>
            </li>
            <li className={styles.listItem}>
              <span>Durée de conservation : les données du compte restent soumises à la politique de confidentialité de Panier Ballon. Les échanges avec les gagnants et la preuve d&apos;envoi des cartes sont supprimés 6 mois après la remise des lots (période de réclamation). Les classements établis pour désigner les gagnants sont conservés pendant la même période.</span>
            </li>
            <li className={styles.listItem}>
              <span>Droits : accès, rectification, effacement, opposition et limitation, en écrivant à panier.ballon.pronos@gmail.com. Effacer ses données avant la désignation des gagnants revient à renoncer à participer. Le participant peut aussi faire une réclamation auprès de la CNIL (www.cnil.fr).</span>
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
              <span>L&apos;organisateur peut modifier, reporter, écourter ou annuler le jeu si des circonstances indépendantes de sa volonté l&apos;imposent : panne ou bug de l&apos;appli, report ou annulation de matchs par la NBA, fraude massive. Les participants en sont informés sur cette page et dans l&apos;appli. Le cas échéant, les lots sont attribués selon les classements établis avec les matchs joués.</span>
            </li>
            <li className={styles.listItem}>
              <span>L&apos;organisateur n&apos;est pas responsable d&apos;une impossibilité de se connecter, de remplir son bracket ou de faire ses pronos due au réseau, à l&apos;appareil du participant ou à une interruption ponctuelle du service.</span>
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

        <p className={styles.note}>Version 2 du 24/11/2026.</p>
      </div>
    </ScreenShell>
  );
}
