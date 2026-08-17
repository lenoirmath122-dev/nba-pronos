"use client";

import { useRouter } from "next/navigation";
import type { BracketData } from "@/lib/queries/bracket";
import { usePosterToggle } from "@/lib/hooks/usePosterToggle";
import { SeriesDrillDown } from "./SeriesDrillDown";
import styles from "./TreeView.module.css";

// Vue B « arbre » — TOUJOURS l'écran d'arrivée depuis le 17/08/2026 (demandé
// par l'utilisateur : « peu importe le device, on arrive sur l'arbre »),
// avec un bouton « Quitter » en haut à GAUCHE pour revenir à la Vue A
// (résumé par tour). Avant cette date, réservée à desktop/paysage
// (useImmersiveDefault.ts, remplacé par usePosterToggle.ts, bien plus
// simple — plus de détection de viewport ni d'invitation à tourner).
type TreeViewProps = {
  data: BracketData;
  /** Cf. BracketSummary — raccourci « Parier sur cette série » (04/08/2026). */
  showBetLink: boolean;
};

export function TreeView({ data, showBetLink }: TreeViewProps) {
  const router = useRouter();
  const { visible, enter, exit } = usePosterToggle({
    onExit: () => router.replace("/bracket"),
  });

  if (visible) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <button type="button" className={styles.close} onClick={exit}>
            × Quitter
          </button>
          <p className={styles.title}>Arbre complet</p>
        </div>
        <SeriesDrillDown
          rounds={data.rounds}
          isDeadlinePassed={data.isDeadlinePassed}
          view="B"
          competitionType={data.competitionType}
          showBetLink={showBetLink}
        />
      </div>
    );
  }

  return (
    <button type="button" className={styles.trigger} onClick={enter}>
      Voir l&rsquo;arbre complet ↗
    </button>
  );
}
