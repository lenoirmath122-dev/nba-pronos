"use client";

import { useRouter } from "next/navigation";
import type { BracketData } from "@/lib/queries/bracket";
import { useImmersiveDefault } from "@/lib/hooks/useImmersiveDefault";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { RotateInvite } from "./RotateInvite";
import styles from "./TreeView.module.css";

// Vue B « arbre » + bascule (§10). SEULE feuille responsable de : le
// déclencheur « plein écran ↗ », l'overlay plein viewport, et l'invitation
// à tourner (rendue via RotateInvite, sans état propre — §3). L'état
// immersif par défaut (desktop/paysage) et sa mécanique de détection
// vivent dans useImmersiveDefault.ts (16/08/2026, extrait d'ici pour être
// partagé avec l'écran de remplissage, `/play/bracket`, qui adopte la même
// règle — mobile PORTRAIT reste sur la Vue A, seule vue sans scroll
// horizontal jamais permis ailleurs dans ce projet).
type TreeViewProps = {
  data: BracketData;
  /** `?arbre=1` déjà lu côté serveur par app/bracket/page.tsx. */
  initialShow: boolean;
  /** Cf. BracketSummary — raccourci « Parier sur cette série » (04/08/2026). */
  showBetLink: boolean;
};

export function TreeView({ data, initialShow, showBetLink }: TreeViewProps) {
  const router = useRouter();
  const { visible, showInvite, handleTriggerClick, handleSeeAnyway, dismissInvite, exit } = useImmersiveDefault({
    initialVisible: initialShow,
    seenInviteKey: "bracket-tree-seen-anyway",
    // Historique (§10.2) : entrée automatique (viewport déjà conforme, ou
    // rotation) REMPLACE, entrée explicite (bouton, ou « voir quand
    // même ») AJOUTE — sinon 3 rotations créent 3 retours.
    onEnter: (reason) => {
      if (reason === "auto") router.replace("/bracket?arbre=1");
      else router.push("/bracket?arbre=1");
    },
    onExit: () => router.replace("/bracket"),
  });

  if (visible) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <p className={styles.title}>Arbre complet</p>
          <button type="button" className={styles.close} onClick={exit}>
            × Quitter
          </button>
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
    <>
      <button type="button" className={styles.trigger} onClick={handleTriggerClick}>
        Plein écran ↗
      </button>
      {showInvite && <RotateInvite onDismiss={dismissInvite} onSeeAnyway={handleSeeAnyway} />}
    </>
  );
}
