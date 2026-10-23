"use client";

import type { BetWithoutProno, OtherBet, OtherPrediction, RevealedPrediction } from "@/lib/queries/play";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { RevealPanelUpcoming } from "./RevealPanelUpcoming";
import styles from "./OthersOnMatch.module.css";

// Pronos ET paris des autres joueurs sur un match verrouillé, derrière un
// seul bouton (p3-6, retour alpha #12 : l'ancien panneau <details> des pronos
// + le bouton séparé des paris prenaient trop de place dans la carte).
// Fusion de l'ex-RevealPanelLocked.tsx et de l'ex-OtherBetsModal.tsx. Données
// déjà chargées côté serveur : la RLS révèle tout sur un match verrouillé
// (pronos) et bet_is_public() a déjà fait le tri (paris), jamais re-filtré
// ici (C-6). Chaque pari montre aussi son statut, ses points et sa proba
// calculée (retour alpha #15).

// Contrôlée (open/onClose) depuis le 22/10/2026 : plus de bouton propre, la
// zone « Mon pari » et l'icône « personnes » des cartes l'ouvrent. Deux modes :
// match verrouillé (tout est révélé) ou à venir (pronos des autres seulement
// si mon prono est validé). Les paris des autres n'ont plus de section :
// chacun s'affiche en italique sous le prono du joueur (visibles dès que mon
// pari est soumis, ou au coup d'envoi).
type OthersOnMatchProps = { open: boolean; onClose: () => void } & (
  | {
      mode: "locked";
      /** Résultats : deux popups distinctes (icône « personnes » = pronos,
       *  bouton « Voir les paris des autres » = paris). */
      view: "pronos" | "bets";
      others: RevealedPrediction[];
      absenteeCount: number;
      bets: OtherBet[];
    }
  | {
      mode: "upcoming";
      isRevealed: boolean;
      predictedCount: number;
      eligibleCount: number;
      others: OtherPrediction[];
      absentees: string[];
      betsWithoutProno: BetWithoutProno[];
    }
);

export function OthersOnMatch(props: OthersOnMatchProps) {
  if (!props.open) return null;

  if (props.mode === "upcoming") {
    return (
      <ModalDialog title="Les autres sur ce match" onClose={props.onClose}>
        <div className={styles.content}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Pronos</h2>
            <RevealPanelUpcoming
              isRevealed={props.isRevealed}
              predictedCount={props.predictedCount}
              eligibleCount={props.eligibleCount}
              others={props.others}
              absentees={props.absentees}
              betsWithoutProno={props.betsWithoutProno}
            />
          </section>
        </div>
      </ModalDialog>
    );
  }

  const { others, absenteeCount, bets } = props;

  // Paris seuls (bouton « Voir les paris des autres ») : énoncé + résultat
  // justifié (statut, proba, points, motif de règlement), plus gros gain en haut.
  if (props.view === "bets") {
    const sorted = [...bets].sort(byPointsDesc((b) => b.pointsAwarded));
    return (
      <ModalDialog title="Paris des autres" onClose={props.onClose}>
        <div className={styles.content}>
          {sorted.length === 0 ? (
            <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a parié sur ce match.</p>
          ) : (
            <ul className={styles.list}>
              {sorted.map((bet) => (
                <li key={bet.userId} className={styles.betItem}>
                  <div className={styles.betHeader}>
                    <PlayerLink userId={bet.userId} pseudo={bet.userName} className={styles.pseudo} />
                  </div>
                  <p className={bet.status === "CANCELLED" ? styles.betDescriptionCancelled : styles.betDescription}>
                    {bet.description}
                  </p>
                  <p className={styles.betMeta}>{betVerdict(bet)}</p>
                  {bet.statLines.length > 0 ? (
                    bet.statLines.map((line) => (
                      <p key={line} className={styles.betMeta}>
                        {line}
                      </p>
                    ))
                  ) : (
                    bet.resolutionReason && <p className={styles.betMeta}>{bet.resolutionReason}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalDialog>
    );
  }

  // Pronos seuls (icône « personnes ») : résultats uniquement, plus gros
  // nombre de points en haut, non scorés en bas.
  const sorted = [...others].sort(byPointsDesc((o) => o.points));
  return (
    <ModalDialog title="Pronos des autres" onClose={props.onClose}>
      <div className={styles.content}>
        {sorted.length === 0 && absenteeCount === 0 ? (
          <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a pronostiqué sur ce match.</p>
        ) : (
          <>
            {sorted.length > 0 && (
              <ul className={styles.list}>
                {sorted.map((other) => (
                  <li key={other.userId} className={styles.predictionItem}>
                    <PlayerLink userId={other.userId} pseudo={other.userName} className={styles.pseudo} />
                    <span className={styles.pick}>
                      {/* "+" pas "−" : predictedMargin est toujours
                              l'écart de victoire, jamais un déficit. */}
                      {other.predictedWinner
                        ? `${other.predictedWinner.abbreviation} +${other.predictedMargin}`
                        : "—"}
                    </span>
                    <span className={styles.predictionPoints}>
                      {other.points === null ? "—" : `${other.points} pts`}
                    </span>
                    {other.adminCorrection && (
                      <span className={styles.correctedBadge}>
                        Saisi par {other.adminCorrection.adminName} à la demande de {other.userName}
                        {other.adminCorrection.reason ? ` — ${other.adminCorrection.reason}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {absenteeCount > 0 && (
              <p className={styles.empty}>
                {absenteeCount} n&rsquo;{absenteeCount > 1 ? "ont" : "a"} pas pronostiqué
              </p>
            )}
          </>
        )}
      </div>
    </ModalDialog>
  );
}

function byPointsDesc<T>(points: (item: T) => number | null) {
  return (a: T, b: T) => (points(b) ?? -1) - (points(a) ?? -1);
}

const BET_STATUS_LABEL: Record<OtherBet["status"], string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "En attente",
  VALIDATED: "En cours",
  REJECTED: "Refusé",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELLED: "Neutralisé",
};

// « Perdu · 26 % · 3 pts en jeu » / « Gagné · 26 % · +3 pts ».
function betVerdict(bet: OtherBet): string {
  const parts = [BET_STATUS_LABEL[bet.status]];
  if (bet.calculatedProba !== null) {
    const pct = bet.calculatedProba * 100;
    parts.push(pct > 0 && pct < 1 ? "< 1 %" : `${Math.round(pct)} %`);
  }
  if (bet.status === "WON" && bet.pointsAwarded !== null) parts.push(`+${bet.pointsAwarded} pts`);
  else if (bet.pointsAtStake !== null) parts.push(`${bet.pointsAtStake} pts${bet.status === "LOST" ? "" : " en jeu"}`);
  return parts.join(" · ");
}
