import { getServerClient } from "@/lib/supabase/server";
import { ScreenShell } from "@/components/nav/ScreenShell";
import { BracketBaremeContent } from "@/components/regles/BracketBaremeContent";
import { MatchBaremeGrid } from "@/components/regles/MatchBaremeGrid";
import { BetDifficulteGrid } from "@/components/regles/BetDifficulteGrid";
import { RankingTiebreakList } from "@/components/regles/RankingTiebreakList";
import styles from "./page.module.css";

// Règles — route physique UNIQUE, hors des route groups (public)/(app),
// même patron que /leaderboard et /bracket (T6a §3.2/§8.1) : visiteur ou
// joueur connecté, contenu identique (page statique, pas de RLS à
// respecter ici). Contenu sourcé sur les décisions ACTÉES/le code réel
// (SPEC_TECHNIQUE_SCORING_V0_1.md T5, figé ; decisions_0.2.x ; lib/queries,
// lib/labels), pas sur les 1ers documents de cadrage (beaucoup de "à
// préciser plus tard" dans le résumé initial, depuis tranchés autrement).
export default async function ReglesPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ScreenShell authenticated={user !== null}>
      <div className={`${styles.page} photo-page`}>
        <div className={`${styles.header} glass-card`}>
          <p className={styles.title}>Règles du jeu</p>
          <p className={styles.intro}>
            Playoffs NBA entre amis : 3 façons de marquer des points, réunies dans un seul classement.
          </p>
        </div>

        <section className={`${styles.section} glass-card`} aria-label="Bracket">
          <h2 className={styles.sectionTitle}>Bracket</h2>
          <p className={styles.body}>
            En début de compétition, choisis le vainqueur et le score exact (4-0, 4-1, 4-2 ou 4-3) de chaque
            série, sur les 4 tours des playoffs. Le champion NBA n&apos;est pas choisi à part : il est déduit
            automatiquement du vainqueur de la finale.
          </p>
          <p className={styles.body}>
            Modifiable jusqu&apos;à la date limite (le 1ᵉʳ match des playoffs) — même après une première
            validation. Les points du bracket sont totalement indépendants des pronostics de matchs : un
            mauvais bracket ne pénalise jamais tes pronos, et inversement.
          </p>
          <BracketBaremeContent />
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Pronostics de matchs">
          <h2 className={styles.sectionTitle}>Pronostics de matchs</h2>
          <p className={styles.body}>
            Pour chaque match, pronostique le vainqueur et l&apos;écart de points. Le pronostic se verrouille
            à l&apos;heure exacte du coup d&apos;envoi.
          </p>
          <p className={styles.body}>
            Tant que tu n&apos;as pas validé ton pronostic pour un match, tu ne vois pas ceux déjà validés par
            les autres joueurs — valider le tien débloque leur vue, pour éviter de s&apos;inspirer des choix
            des autres avant de s&apos;engager. Une fois le match verrouillé, tous les pronostics deviennent
            publics.
          </p>
          <p className={styles.body}>
            Une fois le match verrouillé, tu peux demander à un admin de corriger ton pronostic
            (score erroné, mauvaise saisie...) directement depuis « Mes pronos » ou « Résultats ».
          </p>
          <p className={styles.baremeLabel}>Barème par match</p>
          <MatchBaremeGrid />
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Paris personnalisés">
          <h2 className={styles.sectionTitle}>Paris personnalisés</h2>
          <p className={styles.body}>
            Propose tes propres paris sur une série en cours : un pari « série » (ex. « la série ira à 7
            matchs ») et jusqu&apos;à 3 paris « match » sur des matchs différents de cette série (ex. «
            Tatum marque plus de 30 points »).
          </p>
          <p className={styles.body}>
            Chaque pari a un niveau de difficulté de 1 à 5 que tu proposes toi-même. Un pari que
            l&apos;IA sait calculer automatiquement est validé directement, sans attendre un admin ;
            un pari qu&apos;elle ne sait pas calculer (blessure, formulation trop vague...) attend
            la validation d&apos;un admin. Dans tous les cas, un admin garde la main pour corriger un
            pari après coup. Le pari « série » se verrouille au 1ᵉʳ match de la série, chaque pari
            « match » au coup d&apos;envoi du match visé.
          </p>
          <p className={styles.baremeLabel}>Barème par difficulté</p>
          <BetDifficulteGrid />
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Bien rédiger un pari">
          <h2 className={styles.sectionTitle}>Bien rédiger un pari</h2>
          <p className={styles.body}>
            Ton pari est analysé automatiquement par une IA qui le transforme en probabilité. Plus il vise un
            joueur, une équipe et un seuil chiffré précis, mieux il est reconnu — et plus vite il est validé,
            sans attendre un admin.
          </p>
          <p className={styles.baremeLabel}>Ce qui fonctionne bien</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Un joueur, une stat</strong> — « Nikola Jokic réalise un triple-double. », « Jaylen Brown
                marque plus de 30 points. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Une équipe, une stat</strong> — « Les Boston Celtics inscrivent plus de 45 rebonds. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Le match dans son ensemble</strong> — « Le match ira en prolongation. », « Aucun panier n&apos;est
                marqué au buzzer durant le match. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Un duel entre 2 joueurs ou équipes</strong> — « Jaylen Brown marque plus de points que tout
                autre joueur du match. », « Le banc des Spurs marque au moins deux fois plus de points que le banc
                des Knicks. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Plusieurs conditions à la fois</strong> — « Cade Cunningham marque plus de 25 points et
                réalise plus de 5 passes décisives. » Un « ou » peut même se glisser dans l&apos;une des conditions :
                « Nikola Jokic réalise un triple-double avec au moins 40 points et au moins 20 rebonds ou passes. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Un groupe de joueurs</strong> — « Les 10 joueurs titulaires marquent chacun plus de 8 points.
                », « Au moins un joueur réalise un triple-double durant le match. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Un événement précis</strong> — « Devin Vassell inscrit le dernier panier du match. »,
                « Victor Wembanyama réalise au moins 1 contre sur Chet Holmgren. », « Orlando Magic reçoit exactement
                2 fautes techniques dans le match. »
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Une période précise</strong> — « Les New York Knicks gagnent au moins 2 quarts-temps dans le
                match. »
              </span>
            </li>
          </ul>
          <p className={styles.baremeLabel}>Ce qui n&apos;est pas calculable automatiquement</p>
          <p className={styles.body}>
            Certains paris ne peuvent pas être résolus, faute de donnée de jeu officielle ou parce qu&apos;ils ne
            renvoient à aucun événement réel : une blessure, le score exact du match, un panier à 4 points
            (n&apos;existe pas), une égalité stricte entre deux joueurs, ou une formulation qui ne vise ni stat ni
            événement précis (décision arbitrale, private joke...). Un admin peut toujours refuser ou ajuster un pari
            qui n&apos;entre dans aucune de ces cases.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Ligues entre amis">
          <h2 className={styles.sectionTitle}>Ligues entre amis</h2>
          <p className={styles.body}>
            Rejoins une ligue avec un code pour comparer tes résultats à un groupe restreint plutôt qu&apos;à
            tout le monde. Une ligue ne change rien au calcul des points : c&apos;est une vue filtrée du même
            classement, du même bracket et des mêmes résultats. Tu peux appartenir à plusieurs ligues en même
            temps.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Classement">
          <h2 className={styles.sectionTitle}>Classement</h2>
          <p className={styles.body}>
            Un seul classement additionne les points de matchs, de bracket et de paris personnalisés. En cas
            d&apos;égalité, l&apos;ordre de départage est :
          </p>
          <RankingTiebreakList />
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Badges">
          <h2 className={styles.sectionTitle}>Badges</h2>
          <p className={styles.body}>
            En plus du classement, des badges permanents récompensent la régularité et les exploits (une
            série de bons pronos, un triple-double deviné...). Valables à vie, toutes compétitions
            confondues, la plupart sans comparaison entre joueurs — un accomplissement personnel,
            consultable dans Profil &gt; Stats. Seul « Podiumista » fait exception : il compte tes jours
            passés dans le top 3 du classement, donc par rapport aux autres.
          </p>
        </section>

        <section className={`${styles.section} glass-card`} aria-label="Superlatifs de fin de compétition">
          <h2 className={styles.sectionTitle}>Superlatifs de fin de compétition</h2>
          <p className={styles.body}>
            À la clôture d&apos;une compétition, 5 titres sont décernés d&apos;après les stats de la
            saison — un pur bonus fun, sans impact sur le classement ni sur les points. En cas d&apos;ex
            æquo, tous les joueurs à égalité reçoivent le titre ; un titre n&apos;est jamais décerné à
            0/valeur nulle.
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <span>
                <strong>Nostradamus</strong> — le plus de bons vainqueurs devinés.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Sniper</strong> — le plus d&apos;écarts exacts devinés.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Meilleur bracket</strong> — le plus de points marqués sur le bracket.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Meilleur 1ᵉʳ tour</strong> — le plus de points marqués sur les pronos du 1ᵉʳ tour.
              </span>
            </li>
            <li className={styles.listItem}>
              <span>
                <strong>Plus grosse remontée</strong> — le plus grand gain de rang entre le début et la fin
                de la compétition.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </ScreenShell>
  );
}
